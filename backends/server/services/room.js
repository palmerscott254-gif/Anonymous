/**
 * Room Management Service
 * Handles room creation, joining, member management
 */

const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour default
const MESSAGE_HISTORY_LIMIT = 100;

const rooms = new Map(); // roomCode -> { id, code, createdAt, expiresAt, members: Map, messages: [] }
const userSessions = new Map(); // sessionId -> { userId, emoji, username, roomCode, peerId }

export function getRoomStorage() {
  return { rooms, userSessions };
}

export function normalizeRoomCode(value = '') {
  const normalized = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (normalized.length <= 2) return normalized;
  if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  }
  return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
}

export function generateRoomId() {
  return `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generatePeerId() {
  return `peer-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateInviteCode() {
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

export function createRoom(code, ttlMinutes = 10, kind = 'direct') {
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

export function getRoomByCode(code) {
  const room = rooms.get(code);
  if (!room) return null;
  if (Date.now() > room.expiresAt) {
    rooms.delete(code);
    return null;
  }
  return room;
}

export function addUserSession(sessionId, session) {
  userSessions.set(sessionId, session);
}

export function getUserSession(sessionId) {
  return userSessions.get(sessionId);
}

export function removeUserSession(sessionId) {
  userSessions.delete(sessionId);
}

export function updateUserSession(sessionId, updates) {
  const session = userSessions.get(sessionId);
  if (session) {
    userSessions.set(sessionId, { ...session, ...updates });
  }
}

export function addRoomMember(room, peerId, member) {
  room.members.set(peerId, member);
}

export function getRoomMember(room, peerId) {
  return room.members.get(peerId);
}

export function removeRoomMember(room, peerId) {
  room.members.delete(peerId);
}

export function addMessage(room, message) {
  room.messages.push(message);
  if (room.messages.length > MESSAGE_HISTORY_LIMIT) {
    const removed = room.messages.shift();
    if (removed?.clientMsgId) {
      room.clientMessageIds.delete(removed.clientMsgId);
    }
  }
}

export function isMessageDuplicate(room, clientMsgId) {
  return room.clientMessageIds.has(clientMsgId);
}

export function markMessageDelivered(room, clientMsgId) {
  room.clientMessageIds.add(clientMsgId);
}
