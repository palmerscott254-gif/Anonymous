import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";

const PORT = Number(process.env.PORT || 3001);
const ROOM_TTL_DEFAULT_MINUTES = 10;
const ROOM_TTL_MAX_MINUTES = 24 * 60;

const roomsByCode = new Map();
const socketRooms = new Map();

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

    const code = generateCode();
    const room = {
      id: randomUUID(),
      code,
      key: normalizeCode(code),
      kind: payload.kind === "group" ? "group" : "direct",
      name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : "Ghost Link",
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMinutes * 60 * 1000,
      messages: [],
    };

    roomsByCode.set(room.key, room);
    ack?.({ ok: true, room });
  });

  socket.on("room:join", (payload = {}, ack) => {
    const room = getRoom(payload.roomCode);
    if (!room) {
      ack?.({ ok: false, error: "Invalid or expired code" });
      return;
    }

    socket.join(room.code);
    const joined = socketRooms.get(socket.id) || new Set();
    joined.add(room.code);
    socketRooms.set(socket.id, joined);

    const identity = {
      peerId: socket.id,
      username: payload?.identity?.username || "Ghost",
      emoji: payload?.identity?.emoji || "👤",
    };

    ack?.({
      ok: true,
      room,
      recentMessages: room.messages.slice(-50),
    });

    io.to(room.code).emit("room:presence", {
      roomCode: room.code,
      online: io.sockets.adapter.rooms.get(room.code)?.size || 0,
      joined: identity,
    });
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

    const autoShredSeconds = Number(payload.autoShredSeconds) > 0 ? Number(payload.autoShredSeconds) : 0;
    const message = {
      id: randomUUID(),
      roomCode: room.code,
      text,
      sentAt: Date.now(),
      autoShredAt: autoShredSeconds > 0 ? Date.now() + autoShredSeconds * 1000 : undefined,
      from: {
        peerId: socket.id,
        username: payload?.from?.username || "Ghost",
        emoji: payload?.from?.emoji || "👤",
      },
    };

    room.messages.push(message);
    if (room.messages.length > 250) room.messages = room.messages.slice(-250);

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
    socketRooms.delete(socket.id);
  });
});

setInterval(() => cleanupExpiredRooms(io), 30_000);

httpServer.listen(PORT, () => {
  console.log(`GhostChat socket server listening on http://localhost:${PORT}`);
});
