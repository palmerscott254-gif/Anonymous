import { Router } from 'express';
import { makeError, toHttpErrorPayload } from '../lib/errors.js';
import { createRoom, generateInviteCode, getRoomByCode, listRoomMessages, listRooms, normalizeRoomCode } from '../services/room.js';

function readBearerToken(req) {
  const header = String(req.get('authorization') || '');
  return header.replace(/^Bearer\s+/i, '').trim() || null;
}

function serializeRoom(room) {
  return {
    id: room.id,
    code: room.code,
    kind: room.kind,
    name: room.name,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    online: room.expiresAt > Date.now(),
    members: room.memberCount || 0,
    unread: 0,
    last: room.messageCount > 0 ? 'Recent activity available' : 'Tunnel available',
    time: 'now',
  };
}

export function createRoomRoutes({ env, authService, roomRepository }) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const persistentRooms = roomRepository?.listRooms ? await roomRepository.listRooms(100) : [];
      const memoryRooms = listRooms();
      const merged = new Map();

      for (const room of persistentRooms) {
        merged.set(room.codeNormalized || room.code, {
          id: room.id,
          code: room.code,
          kind: room.kind,
          name: room.name,
          createdAt: room.createdAt,
          expiresAt: room.expiresAt,
          memberCount: 0,
          messageCount: 0,
        });
      }

      for (const room of memoryRooms) {
        merged.set(room.key, room);
      }

      res.status(200).json({ rooms: Array.from(merged.values()).map(serializeRoom) });
    } catch (error) {
      res.status(error?.status || 500).json(toHttpErrorPayload(error));
    }
  });

  router.get('/:roomCode', async (req, res) => {
    try {
      const normalized = normalizeRoomCode(req.params.roomCode);
      const inMemory = getRoomByCode(normalized);
      if (inMemory) {
        res.status(200).json({ room: serializeRoom(inMemory) });
        return;
      }

      const persisted = roomRepository?.findRoomByCode ? await roomRepository.findRoomByCode(normalized.replace('-', '')) : null;
      if (!persisted) {
        res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } });
        return;
      }

      res.status(200).json({
        room: {
          id: persisted.id,
          code: persisted.code,
          kind: persisted.kind,
          name: persisted.name,
          createdAt: persisted.createdAt,
          expiresAt: persisted.expiresAt,
          online: Number(persisted.expiresAt) > Date.now(),
        },
      });
    } catch (error) {
      res.status(error?.status || 500).json(toHttpErrorPayload(error));
    }
  });

  router.post('/', async (req, res) => {
    try {
      const token = readBearerToken(req);
      const claims = token ? authService.verifyAccessToken(token) : null;
      const kind = req.body?.kind === 'group' ? 'group' : 'direct';
      const ttlMinutes = Math.min(Math.max(Number(req.body?.ttlMinutes) || env.ROOM_TTL_DEFAULT_MINUTES, 1), env.ROOM_TTL_MAX_MINUTES);
      const code = normalizeRoomCode(req.body?.roomCode || generateInviteCode());
      const name = String(req.body?.name || 'Ghost Link').slice(0, 120);
      const room = createRoom(code, ttlMinutes, kind, name);

      if (roomRepository?.createRoom) {
        const persisted = await roomRepository.createRoom({
          code: room.code,
          codeNormalized: room.key,
          name: room.name,
          kind: room.kind,
          expiresAt: room.expiresAt,
          createdBy: claims?.sub || null,
        });
        if (persisted?.id) {
          room.id = persisted.id;
        }
      }

      res.status(201).json({ room: serializeRoom(room) });
    } catch (error) {
      res.status(error?.status || 500).json(toHttpErrorPayload(error));
    }
  });

  router.get('/:roomCode/messages', async (req, res) => {
    try {
      const normalized = normalizeRoomCode(req.params.roomCode);
      const room = getRoomByCode(normalized);
      if (room) {
        res.status(200).json({ messages: listRoomMessages(normalized, Number(req.query.limit) || 50) });
        return;
      }

      const persisted = roomRepository?.findRoomByCode ? await roomRepository.findRoomByCode(normalized.replace('-', '')) : null;
      if (!persisted) {
        res.status(404).json({ error: { code: 'ROOM_NOT_FOUND', message: 'Room not found' } });
        return;
      }

      const messages = req.app?.locals?.messageRepository?.getRecentMessages
        ? await req.app.locals.messageRepository.getRecentMessages(persisted.id, Number(req.query.limit) || 50, Number(req.query.offset) || 0)
        : [];
      res.status(200).json({ messages });
    } catch (error) {
      res.status(error?.status || 500).json(toHttpErrorPayload(error));
    }
  });

  return router;
}