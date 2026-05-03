/**
 * Message Event Controllers
 * Handles message sending, typing, reading
 */

import {
  getRoomByCode,
  getUserSession,
  addMessage,
  isMessageDuplicate,
  markMessageDelivered,
} from '../services/room.js';
import { enforceSocketRateLimit } from '../services/rateLimit.js';
import { verifyMessageSignature } from '../utils/crypto.js';

const NODE_ENV = process.env.NODE_ENV || 'development';
const MESSAGE_RATE_LIMIT_PER_MIN = NODE_ENV === 'production' ? 40 : 300;
const MAX_CIPHERTEXT_CHARS = 24000;

export const messageController = {
  async handleMessageSend(socket, socketId, payload, io) {
    const session = getUserSession(socketId);
    if (!session || !session.roomCode) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Not in a room' });
      return;
    }

    if (!enforceSocketRateLimit(socketId, 'msg.send', MESSAGE_RATE_LIMIT_PER_MIN)) {
      socket.emit('error', { code: 'RATE_LIMITED', message: 'Message rate limit exceeded' });
      return;
    }

    const room = getRoomByCode(session.roomCode);
    if (!room) {
      socket.emit('error', { code: 'ROOM_EXPIRED', message: 'Room expired' });
      return;
    }

    const {
      clientMsgId,
      bodyCiphertext,
      bodyIv,
      bodyFormat,
      wrappedKeys,
      sentAt,
      autoShredSeconds = 0,
      attachment = null,
      signature,
      signingPublicKey,
    } = payload;

    const normalizedClientMsgId = typeof clientMsgId === 'string' ? clientMsgId.trim().slice(0, 120) : '';
    if (!normalizedClientMsgId) {
      socket.emit('error', { code: 'BAD_REQUEST', message: 'Missing clientMsgId' });
      return;
    }

    if (isMessageDuplicate(room, normalizedClientMsgId)) {
      return;
    }

    if (bodyFormat !== 'E2EE_V1') {
      socket.emit('error', { code: 'E2EE_REQUIRED', message: 'Plaintext messages are not accepted' });
      return;
    }

    if (typeof bodyCiphertext !== 'string' || bodyCiphertext.length === 0 || bodyCiphertext.length > MAX_CIPHERTEXT_CHARS) {
      socket.emit('error', { code: 'BAD_REQUEST', message: 'Invalid ciphertext payload' });
      return;
    }

    // Validate wrapped keys
    const activeMemberPeerIds = Array.from(room.members.keys());
    const hasAllWrappedKeys = activeMemberPeerIds.every((memberPeerId) => {
      const wrapped = wrappedKeys?.[memberPeerId];
      return Boolean(wrapped?.ciphertext && wrapped?.iv && wrapped?.salt);
    });
    if (!hasAllWrappedKeys) {
      socket.emit('error', { code: 'BAD_REQUEST', message: 'Missing wrapped key for one or more room members' });
      return;
    }

    const senderMember = room.members.get(session.peerId);
    const registeredSigningKey = senderMember?.e2ee?.signingPublicKey || session?.e2ee?.signingPublicKey;
    if (!registeredSigningKey || registeredSigningKey !== signingPublicKey) {
      socket.emit('error', { code: 'SIGNING_KEY_MISMATCH', message: 'Signing key mismatch for sender' });
      return;
    }

    const signatureValid = await verifyMessageSignature({
      clientMsgId: normalizedClientMsgId,
      sentAt,
      bodyCiphertext,
      bodyIv,
      bodyFormat,
      wrappedKeys,
      signature,
      signingPublicKey,
    });

    if (!signatureValid) {
      socket.emit('error', { code: 'INVALID_SIGNATURE', message: 'Message signature verification failed' });
      return;
    }

    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const message = {
      msgId,
      clientMsgId: normalizedClientMsgId,
      fromPeerId: session.peerId,
      fromEmoji: session.emoji,
      fromUsername: session.username,
      bodyCiphertext,
      bodyIv,
      bodyFormat,
      wrappedKeys,
      signature,
      signingPublicKey,
      sentAt,
      serverReceivedAt: Date.now(),
      autoShredAt: autoShredSeconds > 0 ? Date.now() + autoShredSeconds * 1000 : undefined,
      attachment,
    };

    addMessage(room, message);
    markMessageDelivered(room, normalizedClientMsgId);

    // Ack to sender
    socket.emit('msg.ack', {
      roomCode: session.roomCode,
      clientMsgId: normalizedClientMsgId,
      msgId,
      deliveredAt: Date.now(),
    });

    // Broadcast to room
    io.to(`room:${session.roomCode}`).emit('msg.new', {
      roomId: room.id,
      roomCode: session.roomCode,
      ...message,
    });

    console.log(`[MSG] ${session.peerId} → ${session.roomCode}: "${bodyCiphertext.slice(0, 30)}..."`);
  },

  handleTypingSet(socket, socketId, payload, io) {
    const session = getUserSession(socketId);
    if (!session || !session.roomCode) return;

    if (!enforceSocketRateLimit(socketId, 'typing.set', NODE_ENV === 'production' ? 180 : 720)) {
      return;
    }

    const room = getRoomByCode(session.roomCode);
    if (!room) return;

    const { isTyping } = payload;
    if (isTyping) {
      room.typingSet.add(session.peerId);
    } else {
      room.typingSet.delete(session.peerId);
    }

    io.to(`room:${session.roomCode}`).emit('typing.update', {
      roomId: room.id,
      peerId: session.peerId,
      isTyping,
      ts: Date.now(),
    });
  },

  handleMessageRead(socket, socketId, payload, io) {
    const session = getUserSession(socketId);
    if (!session || !session.roomCode) return;

    if (!enforceSocketRateLimit(socketId, 'msg.read', NODE_ENV === 'production' ? 180 : 720)) {
      return;
    }

    const room = getRoomByCode(session.roomCode);
    if (!room) return;

    const { msgId, readAt } = payload;

    io.to(`room:${session.roomCode}`).emit('msg.read', {
      roomId: room.id,
      peerId: session.peerId,
      msgId,
      readAt: readAt || Date.now(),
    });
  },
};
