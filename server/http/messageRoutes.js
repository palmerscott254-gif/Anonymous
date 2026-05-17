import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { makeError, toHttpErrorPayload } from '../lib/errors.js';
import { verifyMessageSignature } from '../utils/crypto.js';
import { addMessage, createRoom, getRoomByCode, markMessageDelivered, normalizeRoomCode } from '../services/room.js';

const SendSchema = z.object({
  roomCode: z.string().min(3).max(16),
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
  fromPeerId: z.string().optional(),
  fromUsername: z.string().optional(),
  fromEmoji: z.string().optional(),
});

function readBearerToken(req) {
  const header = String(req.get('authorization') || '');
  return header.replace(/^Bearer\s+/i, '').trim() || null;
}

export function createMessageRoutes({ env, authService, roomRepository, messageRepository, io }) {
  const router = Router();

  router.post('/', async (req, res) => {
    try {
      const token = readBearerToken(req);
      const claims = token ? authService.verifyAccessToken(token) : null;
      const parsed = SendSchema.parse(req.body || {});
      const normalizedCode = normalizeRoomCode(parsed.roomCode);

      let room = getRoomByCode(normalizedCode);
      if (!room && roomRepository?.findRoomByCode) {
        const persisted = await roomRepository.findRoomByCode(normalizedCode.replace('-', ''));
        if (persisted) {
          room = createRoom(persisted.code, 10, persisted.kind, persisted.name);
          room.id = persisted.id;
          room.createdAt = Number(persisted.createdAt);
          room.expiresAt = Number(persisted.expiresAt);
        }
      }

      if (!room) {
        throw makeError('ROOM_NOT_FOUND', 'Room not found', 404);
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
      const message = {
        msgId,
        clientMsgId: parsed.clientMsgId,
        roomId: room.id,
        roomCode: room.code,
        fromPeerId: parsed.fromPeerId || claims?.sub || `peer-${msgId.slice(0, 8)}`,
        fromEmoji: parsed.fromEmoji || '👤',
        fromUsername: parsed.fromUsername || claims?.username || 'Ghost',
        bodyCiphertext: parsed.bodyCiphertext,
        bodyIv: parsed.bodyIv,
        bodyFormat: parsed.bodyFormat,
        wrappedKeys: parsed.wrappedKeys,
        signature: parsed.signature,
        signingPublicKey: parsed.signingPublicKey,
        sentAt: parsed.sentAt,
        autoShredAt: parsed.autoShredSeconds ? Date.now() + parsed.autoShredSeconds * 1000 : undefined,
        attachment: parsed.attachment || null,
      };

      addMessage(room, message);
      markMessageDelivered(room, parsed.clientMsgId);

      if (messageRepository?.createMessage) {
        await messageRepository.createMessage({
          roomId: room.id,
          senderUserId: claims?.sub || null,
          clientMsgId: parsed.clientMsgId,
          bodyCiphertext: parsed.bodyCiphertext,
          bodyIv: parsed.bodyIv,
          bodyFormat: parsed.bodyFormat,
          wrappedKeys: parsed.wrappedKeys,
          signature: parsed.signature,
          signingPublicKey: parsed.signingPublicKey,
          sentAt: parsed.sentAt,
          autoShredAt: message.autoShredAt,
          attachment: parsed.attachment || null,
        });
      }

      io?.to?.(`room:${room.code}`)?.emit?.('msg.new', message);
      io?.to?.(room.code)?.emit?.('msg:new', message);

      res.status(201).json({ ok: true, messageId: msgId, message });
    } catch (error) {
      res.status(error?.status || 500).json(toHttpErrorPayload(error));
    }
  });

  router.get('/:roomCode', async (req, res) => {
    try {
      const normalized = normalizeRoomCode(req.params.roomCode);
      const room = getRoomByCode(normalized);
      const messages = room?.messages || (req.app?.locals?.messageRepository?.getRecentMessages && roomRepository?.findRoomByCode
        ? await (async () => {
            const persisted = await roomRepository.findRoomByCode(normalized.replace('-', ''));
            if (!persisted) return [];
            return req.app.locals.messageRepository.getRecentMessages(persisted.id, Number(req.query.limit) || 50, Number(req.query.offset) || 0);
          })()
        : []);
      res.status(200).json({ messages });
    } catch (error) {
      res.status(error?.status || 500).json(toHttpErrorPayload(error));
    }
  });

  return router;
}