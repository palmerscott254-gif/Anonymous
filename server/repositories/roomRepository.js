export function createRoomRepository({ dbPool }) {
  return {
    async createRoom({ code, codeNormalized, name, kind, expiresAt, createdBy }) {
      if (!dbPool) return null;
      const result = await dbPool.query(
        `INSERT INTO rooms(code, code_normalized, name, kind, expires_at, created_by)
         VALUES($1, $2, $3, $4, to_timestamp($5 / 1000.0), $6)
         ON CONFLICT (code_normalized)
         DO UPDATE SET expires_at = EXCLUDED.expires_at, name = EXCLUDED.name, kind = EXCLUDED.kind
         RETURNING id, code, code_normalized AS "codeNormalized", name, kind,
                   EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                   EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt"`,
        [code, codeNormalized, name, kind, expiresAt, createdBy || null]
      );
      return result.rows[0] || null;
    },

    async findRoomByCode(codeNormalized) {
      if (!dbPool) return null;
      const result = await dbPool.query(
        `SELECT id, code, code_normalized AS "codeNormalized", name, kind,
                EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt"
         FROM rooms
         WHERE code_normalized = $1`,
        [codeNormalized]
      );
      return result.rows[0] || null;
    },

    async addMember(roomId, userId) {
      if (!dbPool || !roomId || !userId) return;
      await dbPool.query(
        `INSERT INTO room_members(room_id, user_id)
         VALUES($1, $2)
         ON CONFLICT(room_id, user_id) DO NOTHING`,
        [roomId, userId]
      );
    },

    async listRooms(limit = 100) {
      if (!dbPool) return [];
      const result = await dbPool.query(
        `SELECT id, code, code_normalized AS "codeNormalized", name, kind,
                EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt"
         FROM rooms
         ORDER BY created_at DESC
         LIMIT $1`,
        [Math.min(Number(limit) || 100, 200)]
      );
      return result.rows;
    },

    async findRoomById(roomId) {
      if (!dbPool || !roomId) return null;
      const result = await dbPool.query(
        `SELECT id, code, code_normalized AS "codeNormalized", name, kind,
                EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt"
         FROM rooms
         WHERE id = $1`,
        [roomId]
      );
      return result.rows[0] || null;
    },

    async pruneExpiredRooms() {
      if (!dbPool) return 0;
      const result = await dbPool.query(
        `DELETE FROM rooms WHERE expires_at < NOW()`
      );
      return result.rowCount || 0;
    },
  };
}
