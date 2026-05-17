import { randomUUID } from 'node:crypto';

const rooms = new Map();
const userSessions = new Map();
const MESSAGE_HISTORY_LIMIT = 250;

export function getRoomStorage() {
  return { rooms, userSessions };
}

export function normalizeRoomCode(value = '') {
  const normalized = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  if (!normalized) return '';
  if (normalized.length <= 2) return normalized;
  return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
}

export function roomCodeKey(code = '') {
  return normalizeRoomCode(code).replace('-', '');
}

export function generatePeerId() {
  return `peer-${randomUUID().slice(0, 12)}`;
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
  } while (rooms.has(roomCodeKey(code)));
  return code;
}

export function createRoom(code, ttlMinutes = 10, kind = 'direct', name = 'Ghost Link') {
  const normalized = normalizeRoomCode(code);
  const key = roomCodeKey(normalized);
  const existing = getRoomByCode(normalized);
  if (existing) return existing;

  const now = Date.now();
  const room = {
    id: randomUUID(),
    code: normalized,
    key,
    kind: kind === 'group' ? 'group' : 'direct',
    name,
    createdAt: now,
    expiresAt: now + Number(ttlMinutes || 10) * 60 * 1000,
    members: new Map(),
    messages: [],
    typingSet: new Set(),
    clientMessageIds: new Set(),
  };

  rooms.set(key, room);
  return room;
}

export function getRoomByCode(code) {
  const key = roomCodeKey(code);
  if (!key) return null;

  const room = rooms.get(key);
  if (!room) return null;
  if (room.expiresAt <= Date.now()) {
    rooms.delete(key);
    return null;
  }
  return room;
}

export function cleanupExpiredRooms() {
  const now = Date.now();
  const expired = [];
  for (const [key, room] of rooms.entries()) {
    if (room.expiresAt <= now) {
      expired.push(room);
      rooms.delete(key);
    }
  }
  return expired;
}

export function addUserSession(sessionId, session) {
  userSessions.set(sessionId, session);
}

export function getUserSession(sessionId) {
  return userSessions.get(sessionId) || null;
}

export function removeUserSession(sessionId) {
  userSessions.delete(sessionId);
}

export function updateUserSession(sessionId, updates) {
  const existing = userSessions.get(sessionId);
  if (!existing) return null;
  const next = { ...existing, ...updates };
  userSessions.set(sessionId, next);
  return next;
}

export function addRoomMember(room, peerId, member) {
  room.members.set(peerId, member);
}

export function removeRoomMember(room, peerId) {
  room.members.delete(peerId);
  room.typingSet.delete(peerId);
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
  if (!clientMsgId) return;
  room.clientMessageIds.add(clientMsgId);
}
