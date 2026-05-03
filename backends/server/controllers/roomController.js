/**
 * Room Event Controllers
 * Handles room generation, joining, leaving
 */

import {
  createRoom,
  getRoomByCode,
  generateInviteCode,
  normalizeRoomCode,
  getUserSession,
  addRoomMember,
  removeRoomMember,
  removeUserSession,
  updateUserSession,
} from '../services/room.js';
import { enforceSocketRateLimit } from '../services/rateLimit.js';

const NODE_ENV = process.env.NODE_ENV || 'development';
const MESSAGE_RATE_LIMIT_PER_MIN = NODE_ENV === 'production' ? 40 : 300;

export const roomController = {
  handleRoomGenerateCode(socket, socketId, payload, io) {
    const session = getUserSession(socketId);
    if (!session) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Session not initialized' });
      return;
    }

    if (!enforceSocketRateLimit(socketId, 'room.generate_code', NODE_ENV === 'production' ? 20 : 120)) {
      socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many room generation requests' });
      return;
    }

    const { ttlMinutes = 10, roomCode, kind = 'direct' } = payload;
    const safeTtlMinutes = Math.max(1, Math.min(24 * 60, Math.floor(Number(ttlMinutes) || 10)));
    const normalizedRequestedCode = normalizeRoomCode(roomCode);
    const code = normalizedRequestedCode || generateInviteCode();
    const safeKind = kind === 'group' ? 'group' : 'direct';
    const room = createRoom(code, safeTtlMinutes, safeKind);

    socket.emit('room.code_generated', {
      roomId: room.id,
      roomCode: code,
      expiresAt: room.expiresAt,
      kind: safeKind,
    });
    
    console.log(`[ROOM.GENERATED] ${code} expires at ${new Date(room.expiresAt).toISOString()}`);
  },

  handleRoomJoin(socket, socketId, payload, io) {
    const session = getUserSession(socketId);
    if (!session) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Session not initialized' });
      return;
    }

    if (!enforceSocketRateLimit(socketId, 'room.join', NODE_ENV === 'production' ? 30 : 180)) {
      socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many room join requests' });
      return;
    }

    const { roomCode, identity } = payload;
    const room = getRoomByCode(roomCode);

    if (!room) {
      socket.emit('error', { code: 'ROOM_EXPIRED', message: 'Room not found or expired' });
      return;
    }

    if (Date.now() > room.expiresAt) {
      socket.emit('error', { code: 'ROOM_EXPIRED', message: 'Room has expired' });
      return;
    }

    const encryptionPublicKey = identity?.keys?.encryptionPublicKey || null;
    const signingPublicKey = identity?.keys?.signingPublicKey || null;

    if (!encryptionPublicKey || !signingPublicKey) {
      socket.emit('error', { code: 'E2EE_KEYS_REQUIRED', message: 'Missing encryption/signing public keys' });
      return;
    }

    // Update session
    updateUserSession(socketId, {
      roomCode,
      emoji: identity?.emoji || session.emoji,
      username: identity?.username || session.username,
      e2ee: {
        encryptionPublicKey,
        signingPublicKey,
      },
    });

    const alreadyJoined = room.members.has(session.peerId);

    // Add member to room
    addRoomMember(room, session.peerId, {
      peerId: session.peerId,
      emoji: identity?.emoji || session.emoji,
      username: identity?.username || session.username,
      online: true,
      socket,
      joinedAt: Date.now(),
      e2ee: {
        encryptionPublicKey,
        signingPublicKey,
      },
    });

    // Join socket.io room
    socket.join(`room:${roomCode}`);

    // Send join confirmation
    socket.emit('room.joined', {
      roomId: room.id,
      roomCode,
      kind: room.kind || 'direct',
      joinedAt: Date.now(),
      members: Array.from(room.members.values()).map(m => ({
        peerId: m.peerId,
        username: m.username,
        emoji: m.emoji,
        online: m.online,
        e2ee: {
          encryptionPublicKey: m.e2ee?.encryptionPublicKey || null,
          signingPublicKey: m.e2ee?.signingPublicKey || null,
        },
      })),
      security: {
        e2eeRequired: true,
        algorithm: 'AES-GCM-256 + ECDH-P256 + ECDSA-P256',
      },
    });

    if (!alreadyJoined) {
      // Notify others
      io.to(`room:${roomCode}`).emit('room.member_joined', {
        roomId: room.id,
        peerId: session.peerId,
        username: identity?.username || session.username,
        emoji: identity?.emoji || session.emoji,
        e2ee: {
          encryptionPublicKey,
          signingPublicKey,
        },
      });
    }

    console.log(`[ROOM.JOINED] ${session.peerId} → ${roomCode} (${room.members.size} total)`);
  },

  handleRoomLeave(socket, socketId, payload, io) {
    const session = getUserSession(socketId);
    if (!session || !session.roomCode) return;

    const room = getRoomByCode(session.roomCode);
    if (!room) return;

    removeRoomMember(room, session.peerId);
    room.typingSet.delete(session.peerId);
    socket.leave(`room:${session.roomCode}`);

    io.to(`room:${session.roomCode}`).emit('room.member_left', {
      roomId: room.id,
      peerId: session.peerId,
      leftAt: Date.now(),
    });

    updateUserSession(socketId, { roomCode: null });

    console.log(`[ROOM.LEFT] ${session.peerId} from ${session.roomCode}`);
  },

  handleDisconnect(socketId, io) {
    const session = getUserSession(socketId);
    if (session && session.roomCode) {
      const room = getRoomByCode(session.roomCode);
      if (room) {
        removeRoomMember(room, session.peerId);
        room.typingSet.delete(session.peerId);
        io.to(`room:${session.roomCode}`).emit('room.member_left', {
          roomId: room.id,
          peerId: session.peerId,
          leftAt: Date.now(),
        });
      }
    }
    removeUserSession(socketId);
    console.log(`[DISCONNECT] ${socketId}`);
  },
};
