/**
 * Server-side crypto verification utilities
 * Used for validating client signatures and keys
 */

import { webcrypto } from 'node:crypto';

const encoder = new TextEncoder();

export function isLikelyBase64(value = '') {
  return typeof value === 'string' && /^[A-Za-z0-9+/]+=*$/.test(value) && value.length % 4 === 0;
}

export function decodeBase64(base64Value = '') {
  return Buffer.from(base64Value, 'base64');
}

export function buildSignedMessageBlob(payload) {
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

export async function verifyMessageSignature(payload) {
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
