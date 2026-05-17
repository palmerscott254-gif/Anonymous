export function createUserRepository({ dbPool }) {
  return {
    async createUser({ username, passwordHash, publicKey }) {
      if (!dbPool) {
        return null;
      }

      const result = await dbPool.query(
        `INSERT INTO users(username, password_hash, public_key)
         VALUES($1, $2, $3)
         RETURNING id, username, public_key AS "publicKey", created_at AS "createdAt"`,
        [username, passwordHash, publicKey || null]
      );
      return result.rows[0] || null;
    },

    async findByUsername(username) {
      if (!dbPool) return null;
      const result = await dbPool.query(
        `SELECT id, username, password_hash AS "passwordHash", public_key AS "publicKey", created_at AS "createdAt"
         FROM users
         WHERE username = $1`,
        [username]
      );
      return result.rows[0] || null;
    },

    async findById(id) {
      if (!dbPool) return null;
      const result = await dbPool.query(
        `SELECT id, username, public_key AS "publicKey", created_at AS "createdAt"
         FROM users
         WHERE id = $1`,
        [id]
      );
      return result.rows[0] || null;
    },

    async upsertGuest({ username, publicKey }) {
      if (!dbPool) return null;
      const result = await dbPool.query(
        `INSERT INTO users(username, password_hash, public_key)
         VALUES($1, '', $2)
         ON CONFLICT (username)
         DO UPDATE SET public_key = EXCLUDED.public_key
         RETURNING id, username, public_key AS "publicKey", created_at AS "createdAt"`,
        [username, publicKey || null]
      );
      return result.rows[0] || null;
    },
  };
}
