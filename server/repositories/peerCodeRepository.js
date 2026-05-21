import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const MEMORY_PEER_CODES = new Map();

function toKey(code = '') {
  return String(code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function formatCode(rawCode = '') {
  const normalized = toKey(rawCode);
  if (normalized.length < 8) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
}

function buildMemoryRecord({ creatorId, code, expiresAt }) {
  const now = Date.now();
  return {
    id: `peer-${now}-${Math.random().toString(36).slice(2, 8)}`,
    creatorId: creatorId || null,
    code: formatCode(code),
    codeNormalized: toKey(code),
    expiresAt: Number(expiresAt),
    isUsed: false,
    usedBy: null,
    createdAt: now,
    usedAt: null,
  };
}

export function normalizePeerCode(value = '') {
  return toKey(value);
}

export function displayPeerCode(value = '') {
  return formatCode(value);
}

export function generateSecurePeerCode() {
  let raw = '';
  for (let index = 0; index < 8; index += 1) {
    raw += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return formatCode(raw);
}

export function createPeerCodeRepository({ dbPool }) {
  return {
    async createPeerCode({ creatorId, code, expiresAt }) {
      const normalized = toKey(code);
      if (!normalized) return null;
        const formattedCode = formatCode(normalized);

      if (!dbPool) {
          const existing = MEMORY_PEER_CODES.get(normalized) || null;
          if (existing && existing.expiresAt > Date.now() && !existing.isUsed) {
            return null;
          }
          if (existing) {
            MEMORY_PEER_CODES.delete(normalized);
          }

          const record = buildMemoryRecord({ creatorId, code: formattedCode, expiresAt });
        MEMORY_PEER_CODES.set(record.codeNormalized, record);
        return { ...record };
      }

      const result = await dbPool.query(
        `INSERT INTO peer_codes(creator_id, code, code_normalized, expires_at)
         VALUES($1, $2, $3, to_timestamp($4 / 1000.0))
         ON CONFLICT (code) DO NOTHING
         RETURNING id, creator_id AS "creatorId", code, code_normalized AS "codeNormalized",
                   EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt",
                   is_used AS "isUsed",
                   used_by AS "usedBy",
                   EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                   EXTRACT(EPOCH FROM used_at) * 1000 AS "usedAt"`,
        [creatorId || null, formattedCode, normalized, expiresAt]
      );

      const row = result.rows[0] || null;
      if (!row) return null;
      return { ...row, code: formatCode(row.code) };
    },

    async findActivePeerCodeByCode(code) {
      const normalized = toKey(code);
      if (!normalized) return null;

      if (!dbPool) {
        const record = MEMORY_PEER_CODES.get(normalized) || null;
        if (!record) return null;
        if (record.isUsed || record.expiresAt <= Date.now()) {
          MEMORY_PEER_CODES.delete(normalized);
          return null;
        }
        return { ...record };
      }

      const result = await dbPool.query(
        `SELECT id, creator_id AS "creatorId", code, code_normalized AS "codeNormalized",
                EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt",
                is_used AS "isUsed", used_by AS "usedBy",
                EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                EXTRACT(EPOCH FROM used_at) * 1000 AS "usedAt"
         FROM peer_codes
         WHERE code_normalized = $1
           AND is_used = FALSE
           AND expires_at > NOW()`,
        [normalized]
      );

      const row = result.rows[0] || null;
      return row ? { ...row, code: formatCode(row.code) } : null;
    },

    async markPeerCodeUsed({ code, usedBy }) {
      const normalized = toKey(code);
      if (!normalized) return null;

      if (!dbPool) {
        const record = MEMORY_PEER_CODES.get(normalized) || null;
        if (!record || record.isUsed || record.expiresAt <= Date.now()) {
          MEMORY_PEER_CODES.delete(normalized);
          return null;
        }
        record.isUsed = true;
        record.usedBy = usedBy || null;
        record.usedAt = Date.now();
        MEMORY_PEER_CODES.set(normalized, record);
        return { ...record };
      }

      const result = await dbPool.query(
        `UPDATE peer_codes
         SET is_used = TRUE,
             used_by = $2,
             used_at = NOW()
         WHERE code_normalized = $1
           AND is_used = FALSE
           AND expires_at > NOW()
         RETURNING id, creator_id AS "creatorId", code, code_normalized AS "codeNormalized",
                   EXTRACT(EPOCH FROM expires_at) * 1000 AS "expiresAt",
                   is_used AS "isUsed", used_by AS "usedBy",
                   EXTRACT(EPOCH FROM created_at) * 1000 AS "createdAt",
                   EXTRACT(EPOCH FROM used_at) * 1000 AS "usedAt"`,
        [normalized, usedBy || null]
      );

      const row = result.rows[0] || null;
      return row ? { ...row, code: formatCode(row.code) } : null;
    },

    async cleanupExpiredPeerCodes() {
      if (dbPool) {
        await dbPool.query('DELETE FROM peer_codes WHERE expires_at <= NOW() OR is_used = TRUE');
        return;
      }

      const now = Date.now();
      for (const [key, record] of MEMORY_PEER_CODES.entries()) {
        if (record.expiresAt <= now || record.isUsed) {
          MEMORY_PEER_CODES.delete(key);
        }
      }
    },
  };
}
