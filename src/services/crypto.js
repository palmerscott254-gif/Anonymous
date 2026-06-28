/**
 * Cryptography Service
 * Handles E2E encryption, signing, and key management
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(base64Value = "") {
  const normalized = String(base64Value || "").trim();
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function getCryptoSubtle() {
  if (!window?.crypto?.subtle) {
    throw new Error("WebCrypto not available");
  }
  return window.crypto.subtle;
}

export function getRandomBytes(length) {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

export async function exportPublicKeyBase64(key) {
  const subtle = getCryptoSubtle();
  const spki = await subtle.exportKey("spki", key);
  return bytesToBase64(new Uint8Array(spki));
}

export async function importEncryptionPublicKey(base64Key) {
  const subtle = getCryptoSubtle();
  return subtle.importKey(
    "spki",
    base64ToBytes(base64Key),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

export async function importSigningPublicKey(base64Key) {
  const subtle = getCryptoSubtle();
  return subtle.importKey(
    "spki",
    base64ToBytes(base64Key),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
}

export async function generateKeyMaterial() {
  const subtle = getCryptoSubtle();
  const [encryptionKeyPair, signingKeyPair] = await Promise.all([
    subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"]
    ),
    subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"]
    ),
  ]);

  const [encryptionPublicKey, signingPublicKey] = await Promise.all([
    exportPublicKeyBase64(encryptionKeyPair.publicKey),
    exportPublicKeyBase64(signingKeyPair.publicKey),
  ]);

  return {
    encryptionKeyPair,
    signingKeyPair,
    encryptionPublicKey,
    signingPublicKey,
  };
}

export function buildSignedMessageBlob(payload) {
  return JSON.stringify({
    clientMsgId: String(payload.clientMsgId || ""),
    sentAt: Number(payload.sentAt || 0),
    bodyCiphertext: String(payload.bodyCiphertext || ""),
    bodyIv: String(payload.bodyIv || ""),
    bodyFormat: String(payload.bodyFormat || ""),
    wrappedKeys: payload.wrappedKeys && typeof payload.wrappedKeys === "object" ? payload.wrappedKeys : {},
  });
}

export async function signMessagePayload(signingPrivateKey, payload) {
  const subtle = getCryptoSubtle();
  const signature = await subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingPrivateKey,
    textEncoder.encode(buildSignedMessageBlob(payload))
  );
  return bytesToBase64(new Uint8Array(signature));
}

export async function verifyMessagePayloadSignature(signingPublicKey, payload, signatureBase64) {
  const subtle = getCryptoSubtle();
  return subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    signingPublicKey,
    base64ToBytes(signatureBase64),
    textEncoder.encode(buildSignedMessageBlob(payload))
  );
}

export async function deriveWrapKey(sharedSecretBytes, saltBytes) {
  const subtle = getCryptoSubtle();
  const secretMaterial = await subtle.importKey("raw", sharedSecretBytes, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltBytes,
      info: textEncoder.encode("ghostchat-e2ee-wrap-v1"),
    },
    secretMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptEnvelopeForRecipients({ envelope, senderPrivateEncryptionKey, recipients }) {
  const subtle = getCryptoSubtle();
  const contentKeyBytes = getRandomBytes(32);
  const contentKey = await subtle.importKey("raw", contentKeyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const bodyIvBytes = getRandomBytes(12);

  const plaintext = textEncoder.encode(JSON.stringify(envelope));
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv: bodyIvBytes }, contentKey, plaintext);

  // Generate ephemeral ECDH key pair for Perfect Forward Secrecy (PFS)
  const ephemeralKeyPair = await subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"]
  );
  const ephemeralPublicKeyBase64 = await exportPublicKeyBase64(ephemeralKeyPair.publicKey);

  const wrappedKeys = {};
  for (const recipient of recipients) {
    const recipientPublicKey = await importEncryptionPublicKey(recipient.encryptionPublicKey);
    // Derive shared secret using the ephemeral private key and recipient's static public key
    const sharedBits = await subtle.deriveBits(
      { name: "ECDH", public: recipientPublicKey },
      ephemeralKeyPair.privateKey,
      256
    );
    const wrapSalt = getRandomBytes(16);
    const wrapIv = getRandomBytes(12);
    const wrapKey = await deriveWrapKey(new Uint8Array(sharedBits), wrapSalt);
    const wrapped = await subtle.encrypt({ name: "AES-GCM", iv: wrapIv }, wrapKey, contentKeyBytes);

    wrappedKeys[recipient.peerId] = {
      iv: bytesToBase64(wrapIv),
      salt: bytesToBase64(wrapSalt),
      ciphertext: bytesToBase64(new Uint8Array(wrapped)),
      ephemeralPublicKey: ephemeralPublicKeyBase64, // Included for receiver to perform PFS decryption
    };
  }

  return {
    bodyCiphertext: bytesToBase64(new Uint8Array(ciphertext)),
    bodyIv: bytesToBase64(bodyIvBytes),
    wrappedKeys,
  };
}

export async function decryptEnvelopeFromPayload({ payload, myPeerId, myPrivateEncryptionKey, senderEncryptionPublicKey }) {
  const subtle = getCryptoSubtle();
  const wrapped = payload?.wrappedKeys?.[myPeerId];
  if (!wrapped || !wrapped.ciphertext || !wrapped.iv || !wrapped.salt) {
    throw new Error("Missing wrapped key for recipient");
  }

  // PFS support: if the payload contains an ephemeral public key, use it. Otherwise, fallback to static sender key.
  const derivationPublicKey = wrapped.ephemeralPublicKey
    ? await importEncryptionPublicKey(wrapped.ephemeralPublicKey)
    : await importEncryptionPublicKey(senderEncryptionPublicKey);

  const sharedBits = await subtle.deriveBits(
    { name: "ECDH", public: derivationPublicKey },
    myPrivateEncryptionKey,
    256
  );

  const wrapKey = await deriveWrapKey(new Uint8Array(sharedBits), base64ToBytes(wrapped.salt));
  const contentKeyRaw = await subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(wrapped.iv) },
    wrapKey,
    base64ToBytes(wrapped.ciphertext)
  );

  const contentKey = await subtle.importKey("raw", contentKeyRaw, { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.bodyIv) },
    contentKey,
    base64ToBytes(payload.bodyCiphertext)
  );

  return JSON.parse(textDecoder.decode(plaintext));
}
