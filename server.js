import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 3001);
const DATABASE_URL = process.env.DATABASE_URL || '';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

function getSafeDatabaseTarget(value = '') {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`;
  } catch {
    return null;
  }
}

const safeDatabaseTarget = getSafeDatabaseTarget(DATABASE_URL);

if (DATABASE_URL && !safeDatabaseTarget) {
  console.error('[CONFIG] DATABASE_URL is set but invalid. Use a URL-encoded value.');
  process.exit(1);
}

if (!DATABASE_URL) {
  console.warn('[CONFIG] DATABASE_URL is not set. Backend will run without persistent storage.');
}

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    env: NODE_ENV,
    uptimeSec: Math.floor(process.uptime()),
    databaseConfigured: Boolean(DATABASE_URL),
    roomCount: rooms.size,
    sessionCount: userSessions.size,
    now: Date.now(),
  });
});

app.get('/health/ready', (_req, res) => {
  const ready = Boolean(DATABASE_URL);
  res.status(ready ? 200 : 503).json({
    ready,
    databaseConfigured: Boolean(DATABASE_URL),
    reason: ready ? 'ready' : 'DATABASE_URL missing',
  });
});

// In-memory room storage
const rooms = new Map(); // roomCode -> { id, code, createdAt, expiresAt, members: Set, messages: [] }
const userSessions = new Map(); // sessionId -> { userId, emoji, username, roomCode, peerId }

const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour default
const MESSAGE_HISTORY_LIMIT = 100;

function normalizeRoomCode(value = '') {
  const normalized = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (normalized.length <= 2) return normalized;
  return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
}

function generateRoomId() {
  return `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generatePeerId() {
  return `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateInviteCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const first = letters[Math.floor(Math.random() * letters.length)];
  const second = letters[Math.floor(Math.random() * letters.length)];
  const tail = Array.from({ length: 4 }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
  return `${first}${second}-${tail}`;
}

function createRoom(code, ttlMinutes = 10, kind = 'direct') {
  const now = Date.now();
  const expiresAt = now + (ttlMinutes * 60 * 1000);
  
  const room = {
    id: generateRoomId(),
    code,
    kind,
    createdAt: now,
    expiresAt,
    members: new Map(), // peerId -> { emoji, username, online, socket }
    messages: [],
    typingSet: new Set(),
  };
  
  rooms.set(code, room);
  
  // Auto-cleanup expired room
  setTimeout(() => {
    if (rooms.has(code)) {
      rooms.delete(code);
    }
  }, ttlMinutes * 60 * 1000 + 5000);
  
  return room;
}

function getRoomByCode(code) {
  const room = rooms.get(code);
  if (!room) return null;
  if (Date.now() > room.expiresAt) {
    rooms.delete(code);
    return null;
  }
  return room;
}

function broadcastToRoom(roomCode, event, data) {
  io.to(`room:${roomCode}`).emit(event, data);
}

io.on('connection', (socket) => {
  const sessionId = socket.id;
  console.log(`[SESSION] ${sessionId} connected`);

  socket.on('session.hello', (payload) => {
    const { deviceId, identity } = payload;
    
    const session = {
      sessionId,
      deviceId,
      userId: `user-${deviceId}`,
      emoji: identity?.emoji || '👤',
      username: identity?.username || 'Anonymous',
      roomCode: null,
      peerId: generatePeerId(),
      connectedAt: Date.now(),
    };
    
    userSessions.set(sessionId, session);
    
    socket.emit('session.ready', {
      sessionId,
      peerId: session.peerId,
      serverTime: Date.now(),
      features: {
        e2ee: false,
        autoShred: true,
        groups: true,
        fileSharing: true,
      },
    });
    
    console.log(`[SESSION.READY] ${sessionId} → ${session.peerId}`);
  });

  socket.on('room.generate_code', (payload) => {
    const session = userSessions.get(sessionId);
    if (!session) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Session not initialized' });
      return;
    }

    const { ttlMinutes = 10, roomCode, kind = 'direct' } = payload;
    const code = normalizeRoomCode(roomCode) || generateInviteCode();
    const room = createRoom(code, ttlMinutes, kind);

    socket.emit('room.code_generated', {
      roomId: room.id,
      roomCode: code,
      expiresAt: room.expiresAt,
      kind,
    });
    
    console.log(`[ROOM.GENERATED] ${code} expires at ${new Date(room.expiresAt).toISOString()}`);
  });

  socket.on('room.join', (payload) => {
    const session = userSessions.get(sessionId);
    if (!session) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Session not initialized' });
      return;
    }

    const { roomCode, identity } = payload;
    const room = getRoomByCode(roomCode);

    if (!room) {
      socket.emit('error', { code: 'ROOM_EXPIRED', message: 'Room not found or expired' });
      return;
    }

    if (Date.now() > room.expiresAt) {
      rooms.delete(roomCode);
      socket.emit('error', { code: 'ROOM_EXPIRED', message: 'Room has expired' });
      return;
    }

    // Update session
    session.roomCode = roomCode;
    session.emoji = identity?.emoji || session.emoji;
    session.username = identity?.username || session.username;
    userSessions.set(sessionId, session);

    // Add member to room
    room.members.set(session.peerId, {
      peerId: session.peerId,
      emoji: session.emoji,
      username: session.username,
      online: true,
      socket,
      joinedAt: Date.now(),
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
      })),
      security: {
        e2eeRequired: false,
        algorithm: 'PLAIN',
      },
    });

    // Notify others
    broadcastToRoom(roomCode, 'room.member_joined', {
      roomId: room.id,
      peerId: session.peerId,
      username: session.username,
      emoji: session.emoji,
    });

    console.log(`[ROOM.JOINED] ${session.peerId} → ${roomCode} (${room.members.size} total)`);
  });

  socket.on('msg.send', (payload) => {
    const session = userSessions.get(sessionId);
    if (!session || !session.roomCode) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Not in a room' });
      return;
    }

    const room = getRoomByCode(session.roomCode);
    if (!room) {
      socket.emit('error', { code: 'ROOM_EXPIRED', message: 'Room expired' });
      return;
    }

    const { clientMsgId, bodyCiphertext, sentAt, autoShredSeconds = 0, attachment = null } = payload;
    const msgId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const message = {
      msgId,
      clientMsgId,
      fromPeerId: session.peerId,
      fromEmoji: session.emoji,
      fromUsername: session.username,
      bodyCiphertext,
      sentAt,
      serverReceivedAt: Date.now(),
      autoShredAt: autoShredSeconds > 0 ? Date.now() + autoShredSeconds * 1000 : undefined,
      attachment,
    };

    room.messages.push(message);
    if (room.messages.length > MESSAGE_HISTORY_LIMIT) {
      room.messages.shift();
    }

    // Ack to sender
    socket.emit('msg.ack', {
      roomCode: session.roomCode,
      clientMsgId,
      msgId,
      deliveredAt: Date.now(),
    });

    // Broadcast to room
    broadcastToRoom(session.roomCode, 'msg.new', {
      roomId: room.id,
      ...message,
    });

    console.log(`[MSG] ${session.peerId} → ${session.roomCode}: "${bodyCiphertext.slice(0, 30)}..."`);
  });

  socket.on('typing.set', (payload) => {
    const session = userSessions.get(sessionId);
    if (!session || !session.roomCode) return;

    const room = getRoomByCode(session.roomCode);
    if (!room) return;

    const { isTyping } = payload;
    if (isTyping) {
      room.typingSet.add(session.peerId);
    } else {
      room.typingSet.delete(session.peerId);
    }

    broadcastToRoom(session.roomCode, 'typing.update', {
      roomId: room.id,
      peerId: session.peerId,
      isTyping,
      ts: Date.now(),
    });
  });

  socket.on('room.leave', (payload) => {
    const session = userSessions.get(sessionId);
    if (!session || !session.roomCode) return;

    const room = getRoomByCode(session.roomCode);
    if (!room) return;

    room.members.delete(session.peerId);
    room.typingSet.delete(session.peerId);
    socket.leave(`room:${session.roomCode}`);

    broadcastToRoom(session.roomCode, 'room.member_left', {
      roomId: room.id,
      peerId: session.peerId,
      leftAt: Date.now(),
    });

    session.roomCode = null;
    userSessions.set(sessionId, session);

    console.log(`[ROOM.LEFT] ${session.peerId} from ${session.roomCode}`);
  });

  socket.on('disconnect', () => {
    const session = userSessions.get(sessionId);
    if (session && session.roomCode) {
      const room = getRoomByCode(session.roomCode);
      if (room) {
        room.members.delete(session.peerId);
        room.typingSet.delete(session.peerId);
        broadcastToRoom(session.roomCode, 'room.member_left', {
          roomId: room.id,
          peerId: session.peerId,
          leftAt: Date.now(),
        });
      }
    }
    userSessions.delete(sessionId);
    console.log(`[DISCONNECT] ${sessionId}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🚀 GhostChat server ready on ${PORT}`);
  console.log(`[CONFIG] NODE_ENV=${NODE_ENV}`);
  if (safeDatabaseTarget) {
    console.log(`[CONFIG] DATABASE_URL=${safeDatabaseTarget}`);
  }
});
