import { apiRequest } from './api.js';

export async function fetchMessagesForRoom(roomCode, limit = 50) {
  const payload = await apiRequest(`/rooms/${encodeURIComponent(roomCode)}/messages?limit=${encodeURIComponent(limit)}`);
  return payload?.messages || [];
}

export async function sendEncryptedMessage(roomCode, payload, token) {
  return apiRequest('/messages', {
    method: 'POST',
    token,
    body: {
      roomCode,
      ...payload,
    },
  });
}