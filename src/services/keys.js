import { apiRequest } from './api.js';
import { getAccessToken } from './auth.js';

export async function generatePeerCode(expiresInMinutes) {
  return apiRequest('/api/keys/generate/', {
    method: 'POST',
    token: getAccessToken(),
    body: {
      expires_in_minutes: expiresInMinutes,
    },
  });
}

export async function redeemPeerCode(code) {
  return apiRequest('/api/keys/redeem/', {
    method: 'POST',
    token: getAccessToken(),
    body: {
      code,
    },
  });
}
