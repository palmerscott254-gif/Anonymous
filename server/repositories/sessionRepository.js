import { createHash } from 'node:crypto';

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export function createSessionRepository({ dbPool }) {
  return {
    hashToken(token) {
      return sha256(token);
    },

    async createSession({ userId, refreshToken, userAgent, ipAddress, expiresAt }) {
      if (!dbPool) return null;
      const refreshHash = sha256(refreshToken);
      const result = await dbPool.query(
        `INSERT INTO sessions(user_id, refresh_token_hash, user_agent, ip_address, expires_at)
         VALUES($1, $2, $3, $4, to_timestamp($5 / 1000.0))
         RETURNING id, user_id AS "userId",
                   EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt"`,
        [userId, refreshHash, userAgent || null, ipAddress || null, expiresAt]
      );
      return result.rows[0] || null;
    },

    async findActiveSessionByRefreshToken(refreshToken) {
      if (!dbPool) return null;
      const refreshHash = sha256(refreshToken);
      const result = await dbPool.query(
        `SELECT id,
                user_id AS "userId",
                EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt",
                revoked_at AS "revokedAt"
         FROM sessions
         WHERE refresh_token_hash = $1
           AND revoked_at IS NULL
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [refreshHash]
      );
      return result.rows[0] || null;
    },

    async revokeSessionByRefreshToken(refreshToken) {
      if (!dbPool) return;
      const refreshHash = sha256(refreshToken);
      await dbPool.query(
        `UPDATE sessions
         SET revoked_at = NOW()
         WHERE refresh_token_hash = $1
           AND revoked_at IS NULL`,
        [refreshHash]
      );
    },
  };
}
