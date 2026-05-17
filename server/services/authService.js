import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { makeError } from '../lib/errors.js';
import { sanitizeUsername } from '../lib/sanitize.js';

export function createAuthService({ env, userRepository, sessionRepository }) {
  function signAccessToken(user) {
    return jwt.sign(
      {
        sub: user.id,
        username: user.username,
        guest: Boolean(user.guest),
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_ACCESS_TTL }
    );
  }

  function generateRefreshToken() {
    return randomUUID() + randomUUID();
  }

  function verifyAccessToken(token) {
    try {
      return jwt.verify(token, env.JWT_SECRET);
    } catch {
      return null;
    }
  }

  async function register({ username, password, publicKey }, requestMeta = {}) {
    const safeUsername = sanitizeUsername(username);
    if (!safeUsername || safeUsername.length < 3) {
      throw makeError('VALIDATION_ERROR', 'Username must be at least 3 characters');
    }

    if (typeof password !== 'string' || password.length < 8) {
      throw makeError('VALIDATION_ERROR', 'Password must be at least 8 characters');
    }

    const existing = await userRepository.findByUsername(safeUsername);
    if (existing) {
      throw makeError('USERNAME_TAKEN', 'Username already exists', 409);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await userRepository.createUser({
      username: safeUsername,
      passwordHash,
      publicKey,
    });
    if (!created) {
      throw makeError('DB_REQUIRED', 'Database is required for register', 503);
    }

    const accessToken = signAccessToken({ ...created, guest: false });
    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

    await sessionRepository.createSession({
      userId: created.id,
      refreshToken,
      userAgent: requestMeta.userAgent,
      ipAddress: requestMeta.ipAddress,
      expiresAt: refreshExpiresAt,
    });

    return {
      user: created,
      tokens: {
        accessToken,
        refreshToken,
        refreshExpiresAt,
      },
    };
  }

  async function login({ username, password }, requestMeta = {}) {
    if (!userRepository.findByUsername || !sessionRepository.createSession) {
      throw makeError('DB_REQUIRED', 'Database is required for login', 503);
    }

    const safeUsername = sanitizeUsername(username);
    const user = await userRepository.findByUsername(safeUsername);

    if (!user || !user.passwordHash) {
      throw makeError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw makeError('INVALID_CREDENTIALS', 'Invalid username or password', 401);
    }

    const accessToken = signAccessToken({ ...user, guest: false });
    const refreshToken = generateRefreshToken();
    const refreshExpiresAt = Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

    await sessionRepository.createSession({
      userId: user.id,
      refreshToken,
      userAgent: requestMeta.userAgent,
      ipAddress: requestMeta.ipAddress,
      expiresAt: refreshExpiresAt,
    });

    return {
      user,
      tokens: {
        accessToken,
        refreshToken,
        refreshExpiresAt,
      },
    };
  }

  async function refresh({ refreshToken }, requestMeta = {}) {
        if (!sessionRepository.findActiveSessionByRefreshToken) {
          throw makeError('DB_REQUIRED', 'Database is required for refresh', 503);
        }

    if (!refreshToken) {
      throw makeError('MISSING_REFRESH_TOKEN', 'Refresh token required', 401);
    }

    const session = await sessionRepository.findActiveSessionByRefreshToken(refreshToken);
    if (!session) {
      throw makeError('INVALID_REFRESH_TOKEN', 'Invalid refresh token', 401);
    }

    const user = await userRepository.findById(session.userId);
    if (!user) {
      throw makeError('INVALID_REFRESH_TOKEN', 'Invalid refresh token', 401);
    }

    await sessionRepository.revokeSessionByRefreshToken(refreshToken);

    const accessToken = signAccessToken({ ...user, guest: false });
    const nextRefreshToken = generateRefreshToken();
    const refreshExpiresAt = Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;

    await sessionRepository.createSession({
      userId: user.id,
      refreshToken: nextRefreshToken,
      userAgent: requestMeta.userAgent,
      ipAddress: requestMeta.ipAddress,
      expiresAt: refreshExpiresAt,
    });

    return {
      user,
      tokens: {
        accessToken,
        refreshToken: nextRefreshToken,
        refreshExpiresAt,
      },
    };
  }

  async function logout({ refreshToken }) {
    if (refreshToken) {
      await sessionRepository.revokeSessionByRefreshToken(refreshToken);
    }
    return { ok: true };
  }

  async function guest({ username, publicKey }, requestMeta = {}) {
    const suffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const safeUsername = sanitizeUsername(username || `Guest-${suffix}`);
    const guestName = safeUsername.startsWith('Guest-') ? safeUsername : `Guest-${safeUsername}`;

    let user = await userRepository.findByUsername(guestName);
    if (!user) {
      if (!userRepository.upsertGuest) {
        const tempId = `guest-${randomUUID()}`;
        user = { id: tempId, username: guestName, publicKey: publicKey || null, createdAt: Date.now() };
      } else {
        user = await userRepository.upsertGuest({ username: guestName, publicKey });
      }
    }

    if (!user) {
      const tempId = `guest-${randomUUID()}`;
      user = { id: tempId, username: guestName, publicKey: publicKey || null, createdAt: Date.now() };
    }

    const accessToken = signAccessToken({ ...user, guest: true });

    return {
      user: { ...user, guest: true },
      tokens: {
        accessToken,
        refreshToken: null,
        refreshExpiresAt: null,
      },
    };
  }

  return {
    register,
    login,
    refresh,
    logout,
    guest,
    verifyAccessToken,
  };
}
