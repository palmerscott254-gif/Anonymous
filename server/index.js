import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT || 3001);
const ROOM_TTL_DEFAULT_MINUTES = 10;
const ROOM_TTL_MAX_MINUTES = 24 * 60;
const GENERATE_DUPLICATE_WINDOW_MS = 1500;
const MESSAGE_DEDUP_CACHE_LIMIT = 800;

const roomsByCode = new Map();
const socketRooms = new Map();
const roomMessageDedup = new Map(); // roomKey -> Map(clientMsgId -> messageId)
const recentRoomGenerateBySocket = new Map(); // socketId -> { fingerprint, at, roomKey }

function sanitizeLabel(value, fallback) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/\s+/g, " ").slice(0, 80);
  return cleaned || fallback;
}

function getRoomDedupCache(roomKey) {
  let dedupCache = roomMessageDedup.get(roomKey);
  if (!dedupCache) {
    dedupCache = new Map();
    roomMessageDedup.set(roomKey, dedupCache);
  }
  return dedupCache;
}

function setMessageDedupId(roomKey, clientMsgId, messageId) {
  if (!roomKey || !clientMsgId || !messageId) return;
  const dedupCache = getRoomDedupCache(roomKey);
  dedupCache.set(clientMsgId, messageId);
  if (dedupCache.size <= MESSAGE_DEDUP_CACHE_LIMIT) return;

  const overflow = dedupCache.size - MESSAGE_DEDUP_CACHE_LIMIT;
  for (const key of dedupCache.keys()) {
    dedupCache.delete(key);
    if (dedupCache.size <= MESSAGE_DEDUP_CACHE_LIMIT || dedupCache.size <= overflow) break;
  }
}

function getMessageDedupId(roomKey, clientMsgId) {
  if (!roomKey || !clientMsgId) return null;
  return roomMessageDedup.get(roomKey)?.get(clientMsgId) || null;
}

function normalizeCode(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function formatCode(value = "") {
  const normalized = normalizeCode(value);
  if (!normalized) return "";
  if (normalized.length <= 3) return normalized;
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}

function generateCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  let code = "";
  do {
    const first = letters[Math.floor(Math.random() * letters.length)];
    const second = letters[Math.floor(Math.random() * letters.length)];
    const tail = Array.from({ length: 4 }, () => digits[Math.floor(Math.random() * digits.length)]).join("");
    code = `${first}${second}-${tail}`;
  } while (roomsByCode.has(normalizeCode(code)));

  return code;
}

function getRoom(code) {
  const key = normalizeCode(code);
  if (!key) return null;
  const room = roomsByCode.get(key);
  if (!room) return null;
  if (room.expiresAt <= Date.now()) {
    roomsByCode.delete(key);
    roomMessageDedup.delete(key);
    return null;
  }
  return room;
}

function cleanupExpiredRooms(io) {
  const now = Date.now();
  for (const [key, room] of roomsByCode.entries()) {
    if (room.expiresAt <= now) {
      io.to(room.code).emit("room:expired", { roomCode: room.code });
      roomsByCode.delete(key);
      roomMessageDedup.delete(key);
    }
  }
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.on("room:generate", (payload = {}, ack) => {
    const ttlRaw = Number(payload.ttlMinutes);
    const ttlMinutes = Number.isFinite(ttlRaw)
      ? Math.max(1, Math.min(ROOM_TTL_MAX_MINUTES, Math.floor(ttlRaw)))
      : ROOM_TTL_DEFAULT_MINUTES;
    const kind = payload.kind === "group" ? "group" : "direct";
    const name = sanitizeLabel(payload.name, "Ghost Link");

    const fingerprint = `${kind}|${ttlMinutes}|${name}`;
    const previous = recentRoomGenerateBySocket.get(socket.id);
    const now = Date.now();
    if (previous && previous.fingerprint === fingerprint && now - previous.at <= GENERATE_DUPLICATE_WINDOW_MS) {
      const existingRoom = previous.roomKey ? roomsByCode.get(previous.roomKey) : null;
      if (existingRoom && existingRoom.expiresAt > now) {
        ack?.({ ok: true, room: existingRoom, deduped: true });
        return;
      }
    }

    const code = generateCode();
    const room = {
      id: randomUUID(),
      code,
      key: normalizeCode(code),
      kind,
      name,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
      messages: [],
    };

    roomsByCode.set(room.key, room);
    recentRoomGenerateBySocket.set(socket.id, {
      fingerprint,
      at: now,
      roomKey: room.key,
    });
    ack?.({ ok: true, room });
  });

  socket.on("room:join", (payload = {}, ack) => {
    const room = getRoom(payload.roomCode);
    if (!room) {
      ack?.({ ok: false, error: "Invalid or expired code" });
      return;
    }

    const joined = socketRooms.get(socket.id) || new Set();
    const isAlreadyJoined = joined.has(room.code);
    socket.join(room.code);
    joined.add(room.code);
    socketRooms.set(socket.id, joined);

    const identity = {
      peerId: socket.id,
      username: sanitizeLabel(payload?.identity?.username, "Ghost"),
      emoji: sanitizeLabel(payload?.identity?.emoji, "👤").slice(0, 4),
    };

    ack?.({
      ok: true,
      room,
      recentMessages: room.messages.slice(-50),
    });

    if (!isAlreadyJoined) {
      io.to(room.code).emit("room:presence", {
        roomCode: room.code,
        online: io.sockets.adapter.rooms.get(room.code)?.size || 0,
        joined: identity,
      });
    }
  });

  socket.on("msg:send", (payload = {}, ack) => {
    const room = getRoom(payload.roomCode);
    if (!room) {
      ack?.({ ok: false, error: "Invalid or expired room" });
      return;
    }

    if (!socketRooms.get(socket.id)?.has(room.code)) {
      ack?.({ ok: false, error: "Join room before sending" });
      return;
    }

    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!text) {
      ack?.({ ok: false, error: "Empty message" });
      return;
    }

    const clientMsgId = typeof payload.clientMsgId === "string" ? payload.clientMsgId.trim().slice(0, 120) : "";
    if (clientMsgId) {
      const existingMessageId = getMessageDedupId(room.key, clientMsgId);
      if (existingMessageId) {
        ack?.({ ok: true, messageId: existingMessageId, deduped: true });
        return;
      }
    }

    const autoShredSeconds = Number(payload.autoShredSeconds) > 0 ? Number(payload.autoShredSeconds) : 0;
    const message = {
      id: randomUUID(),
      clientMsgId,
      roomCode: room.code,
      text,
      sentAt: Date.now(),
      autoShredAt: autoShredSeconds > 0 ? Date.now() + autoShredSeconds * 1000 : undefined,
      from: {
        peerId: socket.id,
        username: sanitizeLabel(payload?.from?.username, "Ghost"),
        emoji: sanitizeLabel(payload?.from?.emoji, "👤").slice(0, 4),
      },
    };

    room.messages.push(message);
    if (room.messages.length > 250) room.messages = room.messages.slice(-250);
    if (clientMsgId) {
      setMessageDedupId(room.key, clientMsgId, message.id);
    }

    io.to(room.code).emit("msg:new", message);
    ack?.({ ok: true, messageId: message.id });
  });

  socket.on("typing:set", (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room) return;
    if (!socketRooms.get(socket.id)?.has(room.code)) return;

    socket.to(room.code).emit("typing:update", {
      roomCode: room.code,
      isTyping: Boolean(payload.isTyping),
      peerId: socket.id,
      username: payload?.identity?.username || "Ghost",
      emoji: payload?.identity?.emoji || "👤",
      ts: Date.now(),
    });
  });

  socket.on("disconnect", () => {
    const joined = socketRooms.get(socket.id);
    if (joined) {
      for (const code of joined) {
        io.to(code).emit("room:presence", {
          roomCode: code,
          online: io.sockets.adapter.rooms.get(code)?.size || 0,
          leftPeerId: socket.id,
        });
      }
    }
    recentRoomGenerateBySocket.delete(socket.id);
    socketRooms.delete(socket.id);
  });
});

setInterval(() => cleanupExpiredRooms(io), 30_000);

httpServer.listen(PORT, () => {
  console.log(`GhostChat socket server listening on http://localhost:${PORT}`);
});
