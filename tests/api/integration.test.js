import { randomUUID, webcrypto } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createGhostChatRuntime } from '../../server/appFactory.js';
import { buildSignedMessageBlob } from '../../server/utils/crypto.js';

const encoder = new TextEncoder();

function buildEnv() {
  return {
    NODE_ENV: 'test',
    PORT: 0,
    DATABASE_URL: '',
    CORS_ORIGIN: '',
    JWT_SECRET: 'test-secret-abcdefghijklmnopqrstuvwxyz012345',
    JWT_ACCESS_TTL: '15m',
    JWT_REFRESH_TTL_DAYS: 7,
    ROOM_TTL_DEFAULT_MINUTES: 10,
    ROOM_TTL_MAX_MINUTES: 24 * 60,
    HTTP_RATE_LIMIT_PER_MIN: 1000,
    SOCKET_RATE_LIMIT_PER_MIN: 1000,
  };
}

function toBase64(bufferLike) {
  return Buffer.from(bufferLike).toString('base64');
}

async function exportSpkiPublicKeyBase64(publicKey) {
  const spki = await webcrypto.subtle.exportKey('spki', publicKey);
  return toBase64(new Uint8Array(spki));
}

async function signMessagePayload(privateKey, payload) {
  const signed = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(buildSignedMessageBlob(payload))
  );
  return toBase64(new Uint8Array(signed));
}

function createMockDbPool() {
  const state = {
    users: [],
    rooms: [],
    roomMembers: [],
    messages: [],
    sessions: [],
  };

  const nextUser = () => ({ id: randomUUID(), username: '', passwordHash: '', publicKey: null, createdAt: Date.now() });
  const nextRoom = () => ({ id: randomUUID(), code: '', codeNormalized: '', name: '', kind: 'direct', createdAt: Date.now(), expiresAt: Date.now(), createdBy: null });
  const nextMessage = () => ({ id: randomUUID(), createdAt: Date.now() });
  const nextSession = () => ({ id: randomUUID(), createdAt: Date.now() });

  return {
    state,
    async query(sql, params = []) {
      const text = String(sql);

      if (text.includes('SELECT 1 AS ok')) {
        return { rows: [{ ok: 1 }], rowCount: 1 };
      }

      if (text.includes('INSERT INTO users(username, password_hash, public_key)')) {
        const [username, passwordHash, publicKey] = params;
        let user = state.users.find((item) => item.username === username);
        if (!user) {
          user = nextUser();
          state.users.push(user);
        }
        user.username = username;
        user.passwordHash = passwordHash;
        user.publicKey = publicKey || null;
        return { rows: [{ id: user.id, username: user.username, publicKey: user.publicKey, createdAt: user.createdAt }], rowCount: 1 };
      }

      if (text.includes('FROM users') && text.includes('WHERE username = $1')) {
        const [username] = params;
        const user = state.users.find((item) => item.username === username) || null;
        return {
          rows: user
            ? [{ id: user.id, username: user.username, passwordHash: user.passwordHash, publicKey: user.publicKey, createdAt: user.createdAt }]
            : [],
          rowCount: user ? 1 : 0,
        };
      }

      if (text.includes('FROM users') && text.includes('WHERE id = $1')) {
        const [id] = params;
        const user = state.users.find((item) => item.id === id) || null;
        return {
          rows: user ? [{ id: user.id, username: user.username, publicKey: user.publicKey, createdAt: user.createdAt }] : [],
          rowCount: user ? 1 : 0,
        };
      }

      if (text.includes('INSERT INTO sessions(user_id, refresh_token_hash')) {
        const [userId, refreshTokenHash, userAgent, ipAddress, expiresAt] = params;
        const session = nextSession();
        Object.assign(session, { userId, refreshTokenHash, userAgent, ipAddress, expiresAt, revokedAt: null });
        state.sessions.push(session);
        return { rows: [{ id: session.id, userId: session.userId, expiresAt: session.expiresAt }], rowCount: 1 };
      }

      if (text.includes('FROM sessions') && text.includes('refresh_token_hash = $1')) {
        const [refreshTokenHash] = params;
        const session = state.sessions.find((item) => item.refreshTokenHash === refreshTokenHash && !item.revokedAt && item.expiresAt > Date.now()) || null;
        return {
          rows: session ? [{ id: session.id, userId: session.userId, expiresAt: session.expiresAt, revokedAt: session.revokedAt }] : [],
          rowCount: session ? 1 : 0,
        };
      }

      if (text.includes('UPDATE sessions\n         SET revoked_at = NOW()')) {
        const [refreshTokenHash] = params;
        for (const session of state.sessions) {
          if (session.refreshTokenHash === refreshTokenHash && !session.revokedAt) {
            session.revokedAt = Date.now();
          }
        }
        return { rows: [], rowCount: 1 };
      }

      if (text.includes('INSERT INTO rooms(code, code_normalized')) {
        const [code, codeNormalized, name, kind, expiresAt, createdBy] = params;
        let room = state.rooms.find((item) => item.codeNormalized === codeNormalized);
        if (!room) {
          room = nextRoom();
          state.rooms.push(room);
        }
        Object.assign(room, { code, codeNormalized, name, kind, expiresAt, createdBy });
        return {
          rows: [{
            id: room.id,
            code: room.code,
            codeNormalized: room.codeNormalized,
            name: room.name,
            kind: room.kind,
            createdAt: room.createdAt,
            expiresAt: room.expiresAt,
          }],
          rowCount: 1,
        };
      }

      if (text.includes('FROM rooms') && text.includes('WHERE code_normalized = $1')) {
        const [codeNormalized] = params;
        const room = state.rooms.find((item) => item.codeNormalized === codeNormalized) || null;
        return {
          rows: room
            ? [{ id: room.id, code: room.code, codeNormalized: room.codeNormalized, name: room.name, kind: room.kind, createdAt: room.createdAt, expiresAt: room.expiresAt }]
            : [],
          rowCount: room ? 1 : 0,
        };
      }

      if (text.includes('FROM rooms') && text.includes('WHERE id = $1')) {
        const [roomId] = params;
        const room = state.rooms.find((item) => item.id === roomId) || null;
        return {
          rows: room
            ? [{ id: room.id, code: room.code, codeNormalized: room.codeNormalized, name: room.name, kind: room.kind, createdAt: room.createdAt, expiresAt: room.expiresAt }]
            : [],
          rowCount: room ? 1 : 0,
        };
      }

      if (text.includes('INSERT INTO room_members(room_id, user_id)')) {
        const [roomId, userId] = params;
        const key = `${roomId}:${userId}`;
        if (!state.roomMembers.some((item) => item.key === key)) {
          state.roomMembers.push({ key, roomId, userId });
        }
        return { rows: [], rowCount: 1 };
      }

      if (text.includes('INSERT INTO messages(')) {
        const [roomId, senderUserId, clientMsgId, bodyCiphertext, bodyIv, bodyFormat, wrappedKeys, signature, signingPublicKey, sentAt, autoShredAt, attachment] = params;
        const message = nextMessage();
        Object.assign(message, {
          roomId,
          senderUserId,
          clientMsgId,
          bodyCiphertext,
          bodyIv,
          bodyFormat,
          wrappedKeys,
          signature,
          signingPublicKey,
          sentAt,
          autoShredAt,
          attachment,
        });
        state.messages.push(message);
        return { rows: [{ id: message.id, clientMsgId: message.clientMsgId, sentAt: message.sentAt, autoShredAt: message.autoShredAt }], rowCount: 1 };
      }

      if (text.includes('FROM messages') && text.includes('WHERE room_id = $1')) {
        const [roomId, limit, offset] = params;
        const rows = state.messages
          .filter((item) => item.roomId === roomId)
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(Number(offset) || 0, (Number(offset) || 0) + (Number(limit) || 50))
          .map((item) => ({
            msgId: item.id,
            clientMsgId: item.clientMsgId,
            bodyCiphertext: item.bodyCiphertext,
            bodyIv: item.bodyIv,
            bodyFormat: item.bodyFormat,
            wrappedKeys: item.wrappedKeys,
            signature: item.signature,
            signingPublicKey: item.signingPublicKey,
            sentAt: item.sentAt,
            autoShredAt: item.autoShredAt,
            attachment: item.attachment,
            senderUserId: item.senderUserId,
          }));
        return { rows: rows.reverse(), rowCount: rows.length };
      }

      throw new Error(`Unhandled SQL in mock pool: ${text.slice(0, 80)}`);
    },
    connect() {
      return Promise.resolve({
        query: (...args) => this.query(...args),
        release() {},
      });
    },
  };
}

async function createSocketIdentity() {
  const signingKeys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const encryptionKeys = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);

  return {
    signingKeys,
    encryptionKeys,
    identity: {
      username: 'SocketUser',
      emoji: '🦅',
      keys: {
        encryptionPublicKey: await exportSpkiPublicKeyBase64(encryptionKeys.publicKey),
        signingPublicKey: await exportSpkiPublicKeyBase64(signingKeys.publicKey),
      },
    },
  };
}

describe('integration flows', () => {
  it('supports register/login/refresh/session hydration', async () => {
    const runtime = createGhostChatRuntime({ env: buildEnv(), dbPool: createMockDbPool() });

    const registerResponse = await request(runtime.app)
      .post('/auth/register')
      .send({ username: 'tester', password: 'password123' })
      .expect(201);

    expect(registerResponse.body?.tokens?.accessToken).toBeTypeOf('string');

    const loginResponse = await request(runtime.app)
      .post('/auth/login')
      .send({ username: 'tester', password: 'password123' })
      .expect(200);

    const refreshResponse = await request(runtime.app)
      .post('/auth/refresh')
      .send({ refreshToken: loginResponse.body?.tokens?.refreshToken })
      .expect(200);

    await request(runtime.app)
      .get('/session/me')
      .set('Authorization', `Bearer ${refreshResponse.body?.tokens?.accessToken}`)
      .expect(200);
  });

  it('supports socket room creation, encrypted message send, and persistence', async () => {
    const dbPool = createMockDbPool();
    const runtime = createGhostChatRuntime({ env: buildEnv(), dbPool });
    const listener = await new Promise((resolve) => {
      const server = runtime.httpServer.listen(0, () => resolve(server));
    });

    const port = listener.address().port;
    const bootstrap = await request(runtime.app).post('/auth/guest').send({ username: 'socket-tester' }).expect(200);
    const client = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      auth: { token: bootstrap.body?.tokens?.accessToken },
    });

    try {
      await new Promise((resolve) => client.once('connect', resolve));

      const { signingKeys, identity } = await createSocketIdentity();

      await new Promise((resolve) => {
        client.emit('session.hello', { deviceId: 'test-device', identity }, resolve);
      });

      const generatedRoom = await new Promise((resolve) => {
        client.emit('room:generate', { kind: 'direct', ttlMinutes: 10, name: 'Test Room' }, resolve);
      });

      expect(generatedRoom?.ok).toBe(true);

      const roomJoinedPromise = new Promise((resolve) => client.once('room.joined', resolve));

      const joinedRoom = await new Promise((resolve) => {
        client.emit(
          'room.join',
          {
            roomCode: generatedRoom.room.code,
            identity,
          },
          resolve
        );
      });

      const roomJoined = await roomJoinedPromise;

      expect(joinedRoom?.ok).toBe(true);
      expect(roomJoined?.roomCode).toBe(generatedRoom.room.code);

      const payload = {
        clientMsgId: 'client-msg-1',
        sentAt: Date.now(),
        bodyCiphertext: toBase64(Buffer.from('ciphertext')),
        bodyIv: toBase64(Buffer.from('iv-1234567890')),
        bodyFormat: 'E2EE_V1',
        wrappedKeys: {
          [roomJoined.members[0].peerId]: { ciphertext: toBase64(Buffer.from('k')), iv: toBase64(Buffer.from('i')), salt: toBase64(Buffer.from('s')) },
        },
        attachment: null,
      };
      payload.signature = await signMessagePayload(signingKeys.privateKey, payload);
      payload.signingPublicKey = identity.keys.signingPublicKey;

      const messageAck = await new Promise((resolve) => {
        client.emit('msg.send', { roomCode: generatedRoom.room.code, ...payload }, resolve);
      });

      expect(messageAck?.ok).toBe(true);

      const messagesResponse = await request(runtime.app)
        .get(`/rooms/${encodeURIComponent(generatedRoom.room.code)}/messages`)
        .expect(200);

      expect(messagesResponse.body?.messages?.length).toBe(1);
      expect(messagesResponse.body?.messages?.[0]?.clientMsgId).toBe('client-msg-1');
    } finally {
      client.disconnect();
      await new Promise((resolve) => listener.close(resolve));
    }
  });
});