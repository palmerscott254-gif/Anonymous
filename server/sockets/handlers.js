import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { verifyMessageSignature } from '../utils/crypto.js';
import { enforceSocketRateLimit } from '../services/rateLimit.js';
import {
  addMessage,
  addRoomMember,
  addUserSession,
  cleanupExpiredRooms,
  createRoom,
  generateInviteCode,
  generatePeerId,
  getRoomByCode,
  getUserSession,
  isMessageDuplicate,
  markMessageDelivered,
  normalizeRoomCode,
  removeRoomMember,
  removeUserSession,
  updateUserSession,
} from '../services/room.js';
import { makeError, toSocketErrorPayload } from '../lib/errors.js';
import { sanitizeEmoji, sanitizeText, sanitizeUsername } from '../lib/sanitize.js';

const SessionHelloSchema = z.object({
  deviceId: z.string().optional(),
  identity: z.object({
    username: z.string().max(80).optional(),
    emoji: z.string().max(8).optional(),
    keys: z
      .object({
        encryptionPublicKey: z.string().min(1).max(4096).optional(),
        signingPublicKey: z.string().min(1).max(4096).optional(),
      })
      .optional(),
  }).optional(),
  token: z.string().optional(),
});

const RoomGenerateSchema = z.object({
  kind: z.enum(['direct', 'group']).optional(),
  ttlMinutes: z.coerce.number().int().min(1).max(24 * 60).optional(),
  roomCode: z.string().optional(),
  name: z.string().max(120).optional(),
});

const RoomJoinSchema = z.object({
  roomCode: z.string().min(3).max(16),
  identity: z.object({
    username: z.string().max(80).optional(),
    emoji: z.string().max(8).optional(),
    keys: z
      .object({
        encryptionPublicKey: z.string().min(1).max(4096),
        signingPublicKey: z.string().min(1).max(4096),
      })
      .optional(),
  }).optional(),
});

const MessageSendSchema = z.object({
  roomId: z.string().optional(),
  roomCode: z.string().optional(),
  clientMsgId: z.string().min(1).max(120),
  bodyCiphertext: z.string().min(1).max(24000),
  bodyIv: z.string().min(1).max(1024),
  bodyFormat: z.string().min(1).max(32),
  wrappedKeys: z.record(z.any()),
  sentAt: z.number().int().positive(),
  autoShredSeconds: z.number().int().min(0).max(24 * 60 * 60).optional(),
  attachment: z.any().optional(),
  signature: z.string().min(1).max(4096),
  signingPublicKey: z.string().min(1).max(4096),
});

const TypingSchema = z.object({
  roomCode: z.string().optional(),
  roomId: z.string().optional(),
  isTyping: z.boolean(),
});

function socketMeta(socket) {
  return {
    ip: socket.handshake.address || socket.request?.socket?.remoteAddress || 'unknown-ip',
  };
}

function emitCompat(socketOrIo, roomCode, eventName, payload) {
  socketOrIo.emit(eventName, payload);
  if (eventName.includes('.')) {
    socketOrIo.emit(eventName.replaceAll('.', ':'), payload);
  }
  if (eventName.includes(':')) {
    socketOrIo.emit(eventName.replaceAll(':', '.'), payload);
  }
}

function emitAck(ack, payload) {
  if (typeof ack === 'function') {
    ack(payload);
  }
}

function withError(socket, eventName, ack, fn) {
  return async (payload = {}, ...rest) => {
    const maybeAck = typeof rest[rest.length - 1] === 'function' ? rest[rest.length - 1] : ack;
    try {
      await fn(payload, maybeAck);
    } catch (error) {
      const normalized = error?.code ? error : makeError('INTERNAL', 'Unexpected socket error', 500);
      const response = toSocketErrorPayload(normalized, eventName);
      emitCompat(socket, null, 'error', response.error);
      emitAck(maybeAck, response);
    }
  };
}

function registerAliases(socket, aliases, handler) {
  for (const eventName of aliases) {
    socket.on(eventName, handler);
  }
}

export function setupSocketHandlers(io, deps) {
  const { env, authService, roomRepository, messageRepository } = deps;

  io.use(async (socket, next) => {
    const tokenFromAuth = socket.handshake.auth?.token;
    const tokenFromHeader = String(socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    const token = tokenFromAuth || tokenFromHeader || null;
    if (!token) {
      socket.data.auth = null;
      next();
      return;
    }

    const claims = authService.verifyAccessToken(token);
    if (!claims) {
      next(new Error('Invalid socket token'));
      return;
    }

    socket.data.auth = claims;
    next();
  });

  io.on('connection', (socket) => {
    const sessionId = socket.id;
    const meta = socketMeta(socket);

    registerAliases(
      socket,
      ['session.hello'],
      withError(socket, 'session.hello', null, async (payload, ack) => {
        const parsed = SessionHelloSchema.parse(payload || {});
        const username = sanitizeUsername(parsed.identity?.username || socket.data.auth?.username || 'Ghost');
        const emoji = sanitizeEmoji(parsed.identity?.emoji || '👤');

        let accessToken = null;
        let claims = socket.data.auth || null;

        if (!claims) {
          const guest = await authService.guest({
            username,
            publicKey: parsed.identity?.keys?.encryptionPublicKey,
          });
          accessToken = guest.tokens.accessToken;
          claims = authService.verifyAccessToken(accessToken);
          socket.data.auth = claims;
        }

        const session = {
          sessionId,
          peerId: generatePeerId(),
          userId: claims?.sub || null,
          username,
          emoji,
          roomCode: null,
          e2ee: parsed.identity?.keys || null,
          guest: Boolean(claims?.guest),
          ip: meta.ip,
          connectedAt: Date.now(),
        };

        addUserSession(sessionId, session);

        const readyPayload = {
          sessionId,
          peerId: session.peerId,
          serverTime: Date.now(),
          features: {
            e2ee: true,
            messageSigning: true,
            autoShred: true,
            groups: true,
            fileSharing: true,
          },
          accessToken,
        };

        emitCompat(socket, null, 'session.ready', readyPayload);
        emitAck(ack, { ok: true, ...readyPayload });
      })
    );

    registerAliases(
      socket,
      ['room.generate_code', 'room:generate'],
      withError(socket, 'room.generate_code', null, async (payload, ack) => {
        const session = getUserSession(sessionId);
        if (!session) {
          throw makeError('UNAUTHORIZED', 'Session not initialized', 401);
        }

        const allowed = enforceSocketRateLimit({
          socketId: sessionId,
          eventName: 'room.generate_code',
          limitPerMinute: env.NODE_ENV === 'production' ? 30 : 300,
          ip: session.ip,
          userId: session.userId || 'guest',
        });
        if (!allowed) {
          throw makeError('RATE_LIMITED', 'Too many room generation requests', 429);
        }

        const parsed = RoomGenerateSchema.parse(payload || {});
        const ttlMinutes = parsed.ttlMinutes || env.ROOM_TTL_DEFAULT_MINUTES;
        const kind = parsed.kind === 'group' ? 'group' : 'direct';
        const code = normalizeRoomCode(parsed.roomCode || generateInviteCode());
        const name = sanitizeText(parsed.name || 'Ghost Link', 'Ghost Link').slice(0, 120);

        const room = createRoom(code, ttlMinutes, kind, name);

        const persisted = await roomRepository.createRoom({
          code: room.code,
          codeNormalized: room.key,
          name: room.name,
          kind: room.kind,
          expiresAt: room.expiresAt,
          createdBy: session.userId,
        });

        if (persisted?.id) {
          room.id = persisted.id;
        }

        const response = {
          ok: true,
          room: {
            id: room.id,
            code: room.code,
            kind: room.kind,
            name: room.name,
            createdAt: room.createdAt,
            expiresAt: room.expiresAt,
          },
        };

        emitCompat(socket, null, 'room.code_generated', {
          roomId: room.id,
          roomCode: room.code,
          expiresAt: room.expiresAt,
          kind: room.kind,
        });
        emitAck(ack, response);
      })
    );

    registerAliases(
      socket,
      ['room.join', 'room:join'],
      withError(socket, 'room.join', null, async (payload, ack) => {
        const session = getUserSession(sessionId);
        if (!session) {
          throw makeError('UNAUTHORIZED', 'Session not initialized', 401);
        }

        const allowed = enforceSocketRateLimit({
          socketId: sessionId,
          eventName: 'room.join',
          limitPerMinute: env.NODE_ENV === 'production' ? 60 : 300,
          ip: session.ip,
          userId: session.userId || 'guest',
        });
        if (!allowed) {
          throw makeError('RATE_LIMITED', 'Too many room join requests', 429);
        }

        const parsed = RoomJoinSchema.parse(payload || {});
        const normalizedCode = normalizeRoomCode(parsed.roomCode);

        let room = getRoomByCode(normalizedCode);
        if (!room) {
          const persisted = await roomRepository.findRoomByCode(normalizedCode.replace('-', ''));
          if (!persisted || Number(persisted.expiresAt) <= Date.now()) {
            throw makeError('ROOM_EXPIRED', 'Room not found or expired', 404);
          }
          room = createRoom(persisted.code, 10, persisted.kind, persisted.name);
          room.id = persisted.id;
          room.createdAt = Number(persisted.createdAt);
          room.expiresAt = Number(persisted.expiresAt);
        }

        if (room.expiresAt <= Date.now()) {
          throw makeError('ROOM_EXPIRED', 'Room has expired', 404);
        }

        updateUserSession(sessionId, {
          roomCode: room.code,
          username: sanitizeUsername(parsed.identity?.username || session.username),
          emoji: sanitizeEmoji(parsed.identity?.emoji || session.emoji),
          e2ee: parsed.identity?.keys || session.e2ee || null,
        });

        const nextSession = getUserSession(sessionId);
        const member = {
          peerId: nextSession.peerId,
          username: nextSession.username,
          emoji: nextSession.emoji,
          online: true,
          joinedAt: Date.now(),
          e2ee: nextSession.e2ee,
        };

        addRoomMember(room, nextSession.peerId, member);
        await roomRepository.addMember(room.id, nextSession.userId);

        socket.join(`room:${room.code}`);
        socket.join(room.code);

        const recentMessages = room.messages.slice(-50);
        const persistedMessages = await messageRepository.getRecentMessages(room.id, 50, 0);

        const joinedPayload = {
          roomId: room.id,
          roomCode: room.code,
          kind: room.kind,
          joinedAt: Date.now(),
          members: Array.from(room.members.values()),
          security: {
            e2eeRequired: true,
            algorithm: 'AES-GCM-256 + ECDH-P256 + ECDSA-P256',
          },
          recentMessages: persistedMessages.length > 0 ? persistedMessages : recentMessages,
        };

        emitCompat(socket, null, 'room.joined', joinedPayload);
        io.to(`room:${room.code}`).emit('room.member_joined', {
          roomId: room.id,
          peerId: member.peerId,
          username: member.username,
          emoji: member.emoji,
          e2ee: member.e2ee || null,
        });

        emitAck(ack, { ok: true, room, recentMessages: joinedPayload.recentMessages });
      })
    );

    registerAliases(
      socket,
      ['msg.send', 'msg:send'],
      withError(socket, 'msg.send', null, async (payload, ack) => {
        const session = getUserSession(sessionId);
        if (!session || !session.roomCode) {
          throw makeError('UNAUTHORIZED', 'Join room before sending', 401);
        }

        const allowed = enforceSocketRateLimit({
          socketId: sessionId,
          eventName: 'msg.send',
          limitPerMinute: env.NODE_ENV === 'production' ? 60 : 360,
          ip: session.ip,
          userId: session.userId || 'guest',
        });
        if (!allowed) {
          throw makeError('RATE_LIMITED', 'Message rate limit exceeded', 429);
        }

        const parsed = MessageSendSchema.parse(payload || {});
        const room = getRoomByCode(parsed.roomCode || session.roomCode);
        if (!room) {
          throw makeError('ROOM_EXPIRED', 'Room not found or expired', 404);
        }

        if (!room.members.has(session.peerId)) {
          throw makeError('FORBIDDEN', 'Room membership required', 403);
        }

        if (isMessageDuplicate(room, parsed.clientMsgId)) {
          emitAck(ack, { ok: true, deduped: true });
          return;
        }

        const activeMemberIds = Array.from(room.members.keys());
        const hasAllWrappedKeys = activeMemberIds.every((peerId) => {
          const wrapped = parsed.wrappedKeys?.[peerId];
          return Boolean(wrapped?.ciphertext && wrapped?.iv && wrapped?.salt);
        });
        if (!hasAllWrappedKeys) {
          throw makeError('BAD_REQUEST', 'Missing wrapped key for one or more room members', 400);
        }

        const signatureValid = await verifyMessageSignature({
          clientMsgId: parsed.clientMsgId,
          sentAt: parsed.sentAt,
          bodyCiphertext: parsed.bodyCiphertext,
          bodyIv: parsed.bodyIv,
          bodyFormat: parsed.bodyFormat,
          wrappedKeys: parsed.wrappedKeys,
          signature: parsed.signature,
          signingPublicKey: parsed.signingPublicKey,
        });
        if (!signatureValid) {
          throw makeError('INVALID_SIGNATURE', 'Message signature verification failed', 400);
        }

        const msgId = randomUUID();
        const autoShredAt = parsed.autoShredSeconds ? Date.now() + parsed.autoShredSeconds * 1000 : undefined;

        const message = {
          msgId,
          clientMsgId: parsed.clientMsgId,
          roomId: room.id,
          roomCode: room.code,
          fromPeerId: session.peerId,
          fromEmoji: session.emoji,
          fromUsername: session.username,
          bodyCiphertext: parsed.bodyCiphertext,
          bodyIv: parsed.bodyIv,
          bodyFormat: parsed.bodyFormat,
          wrappedKeys: parsed.wrappedKeys,
          signature: parsed.signature,
          signingPublicKey: parsed.signingPublicKey,
          sentAt: parsed.sentAt,
          autoShredAt,
          attachment: parsed.attachment || null,
        };

        addMessage(room, message);
        markMessageDelivered(room, parsed.clientMsgId);

        await messageRepository.createMessage({
          roomId: room.id,
          senderUserId: session.userId,
          clientMsgId: parsed.clientMsgId,
          bodyCiphertext: parsed.bodyCiphertext,
          bodyIv: parsed.bodyIv,
          bodyFormat: parsed.bodyFormat,
          wrappedKeys: parsed.wrappedKeys,
          signature: parsed.signature,
          signingPublicKey: parsed.signingPublicKey,
          sentAt: parsed.sentAt,
          autoShredAt,
          attachment: parsed.attachment || null,
        });

        emitCompat(socket, null, 'msg.ack', {
          roomCode: room.code,
          roomId: room.id,
          clientMsgId: parsed.clientMsgId,
          msgId,
          deliveredAt: Date.now(),
        });

        io.to(`room:${room.code}`).emit('msg.new', message);
        io.to(room.code).emit('msg:new', message);
        emitAck(ack, { ok: true, messageId: msgId });
      })
    );

    registerAliases(
      socket,
      ['typing.set', 'typing:set'],
      withError(socket, 'typing.set', null, async (payload) => {
        const session = getUserSession(sessionId);
        if (!session || !session.roomCode) return;

        const allowed = enforceSocketRateLimit({
          socketId: sessionId,
          eventName: 'typing.set',
          limitPerMinute: env.NODE_ENV === 'production' ? 180 : 800,
          ip: session.ip,
          userId: session.userId || 'guest',
        });
        if (!allowed) return;

        const parsed = TypingSchema.parse(payload || {});
        const room = getRoomByCode(parsed.roomCode || session.roomCode);
        if (!room) return;
        if (!room.members.has(session.peerId)) return;

        io.to(`room:${room.code}`).emit('typing.update', {
          roomCode: room.code,
          roomId: room.id,
          peerId: session.peerId,
          username: session.username,
          emoji: session.emoji,
          isTyping: Boolean(parsed.isTyping),
          ts: Date.now(),
        });
      })
    );

    registerAliases(
      socket,
      ['room.leave', 'room:leave'],
      withError(socket, 'room.leave', null, async (_payload, ack) => {
        const session = getUserSession(sessionId);
        if (!session || !session.roomCode) {
          emitAck(ack, { ok: true });
          return;
        }

        const room = getRoomByCode(session.roomCode);
        if (room) {
          removeRoomMember(room, session.peerId);
          io.to(`room:${room.code}`).emit('room.member_left', {
            roomId: room.id,
            peerId: session.peerId,
            leftAt: Date.now(),
          });
        }

        updateUserSession(sessionId, { roomCode: null });
        emitAck(ack, { ok: true });
      })
    );

    socket.on('disconnect', () => {
      const session = getUserSession(sessionId);
      if (session?.roomCode) {
        const room = getRoomByCode(session.roomCode);
        if (room) {
          removeRoomMember(room, session.peerId);
          io.to(`room:${room.code}`).emit('room.member_left', {
            roomId: room.id,
            peerId: session.peerId,
            leftAt: Date.now(),
          });
        }
      }
      removeUserSession(sessionId);
    });
  });

  setInterval(() => {
    const expired = cleanupExpiredRooms();
    for (const room of expired) {
      io.to(`room:${room.code}`).emit('room.expired', { roomCode: room.code, roomId: room.id });
      io.to(room.code).emit('room:expired', { roomCode: room.code, roomId: room.id });
    }
  }, 30_000);
}
