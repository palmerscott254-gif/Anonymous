import { apiRequest } from './api.js';

export async function fetchCurrentUser(token) {
  const payload = await apiRequest('/users/me', { token });
  return payload?.user || null;
}

export async function updateCurrentUser(user, token) {
  const payload = await apiRequest('/users/me', {
    method: 'PUT',
    token,
    body: user,
  });
  return payload?.user || null;
}