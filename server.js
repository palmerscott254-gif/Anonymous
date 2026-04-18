import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Pool } from 'pg';
import { webcrypto } from 'node:crypto';

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 3001);
const DATABASE_URL = process.env.DATABASE_URL || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
const MESSAGE_RATE_LIMIT_PER_MIN = NODE_ENV === 'production' ? 40 : 300;
const HTTP_RATE_LIMIT_PER_MIN = NODE_ENV === 'production' ? 180 : 1200;
const MAX_CIPHERTEXT_CHARS = 24000;

const encoder = new TextEncoder();

function decodeBase64(base64Value = '') {
  return Buffer.from(base64Value, 'base64');
}

function isLikelyBase64(value = '') {
  return typeof value === 'string' && /^[A-Za-z0-9+/]+=*$/.test(value) && value.length % 4 === 0;
}

function getAllowedOrigins(rawValue = '') {
  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const allowedOrigins = getAllowedOrigins(CORS_ORIGIN);

function isCorsOriginAllowed(origin) {
  if (!origin) return true;
  if (NODE_ENV !== 'production' && allowedOrigins.length === 0) return true;
  return allowedOrigins.includes(origin);
}

const corsOptions = {
  origin(origin, callback) {
    if (isCorsOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin denied'));
  },
  methods: ['GET', 'POST'],
};

if (NODE_ENV === 'production' && allowedOrigins.length === 0) {
  console.error('[CONFIG] CORS_ORIGIN is required in production. Set allowed origins as comma-separated list.');
  process.exit(1);
}

function applySecurityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
}

const httpRateBuckets = new Map();

function isRateLimited(map, key, limit, windowMs) {
  const now = Date.now();
  const bucket = map.get(key);
  if (!bucket || now > bucket.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return true;
  }

  return false;
}

function enforceHttpRateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown-ip';
  const limited = isRateLimited(httpRateBuckets, `http:${ip}`, HTTP_RATE_LIMIT_PER_MIN, 60 * 1000);
  if (limited) {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Too many requests. Try again shortly.',
    });
    return;
  }
  next();
}

const socketRateBuckets = new Map();

function enforceSocketRateLimit(socketId, eventName, limitPerMinute) {
  return !isRateLimited(socketRateBuckets, `socket:${socketId}:${eventName}`, limitPerMinute, 60 * 1000);
}

function buildSignedMessageBlob(payload) {
  const data = {
    clientMsgId: String(payload.clientMsgId || ''),
    sentAt: Number(payload.sentAt || 0),
    bodyCiphertext: String(payload.bodyCiphertext || ''),
    bodyIv: String(payload.bodyIv || ''),
    bodyFormat: String(payload.bodyFormat || ''),
    wrappedKeys: payload.wrappedKeys && typeof payload.wrappedKeys === 'object' ? payload.wrappedKeys : {},
  };

  return JSON.stringify(data);
}

async function verifyMessageSignature(payload) {
  try {
    const signingPublicKey = payload?.signingPublicKey;
    const signature = payload?.signature;

    if (!isLikelyBase64(signingPublicKey) || !isLikelyBase64(signature)) {
      return false;
    }

    const verifyKey = await webcrypto.subtle.importKey(
      'spki',
      decodeBase64(signingPublicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );

    return webcrypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      decodeBase64(signature),
      encoder.encode(buildSignedMessageBlob(payload))
    );
  } catch {
    return false;
  }
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin denied'));
    },
    methods: ['GET', 'POST']
  }
});

app.set('trust proxy', 1);
app.use(applySecurityHeaders);
app.use(cors(corsOptions));
app.use(enforceHttpRateLimit);
app.use(express.json({ limit: '100kb' }));

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
const dbPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 3000,
    })
  : null;

if (dbPool) {
  dbPool.on('error', (error) => {
    console.error('[DB] Pool error:', error.message);
  });
}

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

app.get('/health/db', async (_req, res) => {
  if (!dbPool) {
    res.status(503).json({
      status: 'error',
      database: 'unconfigured',
      reason: 'DATABASE_URL missing',
    });
    return;
  }

  const startedAt = Date.now();

  try {
    const result = await dbPool.query('SELECT 1 AS ok');
    const probeOk = result.rows?.[0]?.ok === 1;

    res.status(probeOk ? 200 : 503).json({
      status: probeOk ? 'ok' : 'error',
      database: probeOk ? 'reachable' : 'unexpected_result',
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'unreachable',
      latencyMs: Date.now() - startedAt,
      reason: error?.message || 'Database probe failed',
    });
  }
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
  let code = '';
  do {
    const first = letters[Math.floor(Math.random() * letters.length)];
    const second = letters[Math.floor(Math.random() * letters.length)];
    const tail = Array.from({ length: 4 }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
    code = `${first}${second}-${tail}`;
  } while (rooms.has(code));
  return code;
}

function createRoom(code, ttlMinutes = 10, kind = 'direct') {
  const existing = getRoomByCode(code);
  if (existing) {
    return existing;
  }

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
    clientMessageIds: new Set(),
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
        e2ee: true,
        messageSigning: true,
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

    if (!enforceSocketRateLimit(sessionId, 'room.generate_code', NODE_ENV === 'production' ? 20 : 120)) {
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
  });

  socket.on('room.join', (payload) => {
    const session = userSessions.get(sessionId);
    if (!session) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Session not initialized' });
      return;
    }

    if (!enforceSocketRateLimit(sessionId, 'room.join', NODE_ENV === 'production' ? 30 : 180)) {
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
      rooms.delete(roomCode);
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
    session.roomCode = roomCode;
    session.emoji = identity?.emoji || session.emoji;
    session.username = identity?.username || session.username;
    session.e2ee = {
      encryptionPublicKey,
      signingPublicKey,
    };
    userSessions.set(sessionId, session);

    const alreadyJoined = room.members.has(session.peerId);

    // Add member to room
    room.members.set(session.peerId, {
      peerId: session.peerId,
      emoji: session.emoji,
      username: session.username,
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
      broadcastToRoom(roomCode, 'room.member_joined', {
        roomId: room.id,
        peerId: session.peerId,
        username: session.username,
        emoji: session.emoji,
        e2ee: {
          encryptionPublicKey,
          signingPublicKey,
        },
      });
    }

    console.log(`[ROOM.JOINED] ${session.peerId} → ${roomCode} (${room.members.size} total)`);
  });

  socket.on('msg.send', async (payload) => {
    const session = userSessions.get(sessionId);
    if (!session || !session.roomCode) {
      socket.emit('error', { code: 'UNAUTHORIZED', message: 'Not in a room' });
      return;
    }

    if (!enforceSocketRateLimit(sessionId, 'msg.send', MESSAGE_RATE_LIMIT_PER_MIN)) {
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

    if (room.clientMessageIds.has(normalizedClientMsgId)) {
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

    if (typeof bodyIv !== 'string' || !isLikelyBase64(bodyIv)) {
      socket.emit('error', { code: 'BAD_REQUEST', message: 'Invalid bodyIv' });
      return;
    }

    if (!wrappedKeys || typeof wrappedKeys !== 'object' || Array.isArray(wrappedKeys)) {
      socket.emit('error', { code: 'BAD_REQUEST', message: 'Missing wrappedKeys map' });
      return;
    }

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

    room.messages.push(message);
    room.clientMessageIds.add(normalizedClientMsgId);
    if (room.messages.length > MESSAGE_HISTORY_LIMIT) {
      const removed = room.messages.shift();
      if (removed?.clientMsgId) {
        room.clientMessageIds.delete(removed.clientMsgId);
      }
    }

    // Ack to sender
    socket.emit('msg.ack', {
      roomCode: session.roomCode,
      clientMsgId: normalizedClientMsgId,
      msgId,
      deliveredAt: Date.now(),
    });

    // Broadcast to room
    broadcastToRoom(session.roomCode, 'msg.new', {
      roomId: room.id,
      roomCode: session.roomCode,
      ...message,
    });

    console.log(`[MSG] ${session.peerId} → ${session.roomCode}: "${bodyCiphertext.slice(0, 30)}..."`);
  });

  socket.on('typing.set', (payload) => {
    const session = userSessions.get(sessionId);
    if (!session || !session.roomCode) return;

    if (!enforceSocketRateLimit(sessionId, 'typing.set', NODE_ENV === 'production' ? 180 : 720)) {
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
