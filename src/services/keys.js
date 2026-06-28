import { apiRequest } from './api.js';
import { fetchGuestSession, getAccessToken } from './auth.js';

async function getOrCreateAccessToken(identity) {
  const existingToken = getAccessToken();
  if (existingToken) return existingToken;

  const guest = await fetchGuestSession(identity);
  return guest?.tokens?.accessToken || getAccessToken();
}

export async function generatePeerCode(expiresInMinutes, identity) {
  const token = await getOrCreateAccessToken(identity);
  return apiRequest('/api/keys/generate/', {
    method: 'POST',
    token,
    body: {
      expires_in_minutes: expiresInMinutes,
    },
  });
}

export async function redeemPeerCode(code, identity) {
  const token = await getOrCreateAccessToken(identity);
  return apiRequest('/api/keys/redeem/', {
    method: 'POST',
    token,
    body: {
      code,
    },
  });
}
