import { apiRequest } from './api.js';

export async function listRooms() {
  const payload = await apiRequest('/rooms');
  return payload?.rooms || [];
}

export async function getRoomByCode(roomCode) {
  const payload = await apiRequest(`/rooms/${encodeURIComponent(roomCode)}`);
  return payload?.room || null;
}

export async function createRoom(payload, token) {
  const response = await apiRequest('/rooms', {
    method: 'POST',
    body: payload,
    token,
  });
  return response?.room || null;
}

export async function fetchRoomMessages(roomCode, limit = 50) {
  const payload = await apiRequest(`/rooms/${encodeURIComponent(roomCode)}/messages?limit=${encodeURIComponent(limit)}`);
  return payload?.messages || [];
}