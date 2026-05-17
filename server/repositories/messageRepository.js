export function createMessageRepository({ dbPool }) {
  return {
    async createMessage({
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
    }) {
      if (!dbPool) return null;

      const result = await dbPool.query(
        `INSERT INTO messages(
          room_id,
          sender_user_id,
          client_msg_id,
          body_ciphertext,
          body_iv,
          body_format,
          wrapped_keys,
          signature,
          signing_public_key,
          sent_at,
          auto_shred_at,
          attachment
        ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (room_id, client_msg_id) DO NOTHING
        RETURNING id, client_msg_id AS "clientMsgId", sent_at AS "sentAt", auto_shred_at AS "autoShredAt"`,
        [
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
          autoShredAt || null,
          attachment || null,
        ]
      );

      return result.rows[0] || null;
    },

    async getRecentMessages(roomId, limit = 50, offset = 0) {
      if (!dbPool || !roomId) return [];

      const result = await dbPool.query(
        `SELECT id AS "msgId",
                client_msg_id AS "clientMsgId",
                body_ciphertext AS "bodyCiphertext",
                body_iv AS "bodyIv",
                body_format AS "bodyFormat",
                wrapped_keys AS "wrappedKeys",
                signature,
                signing_public_key AS "signingPublicKey",
                sent_at AS "sentAt",
                auto_shred_at AS "autoShredAt",
                attachment,
                sender_user_id AS "senderUserId"
         FROM messages
         WHERE room_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [roomId, Math.min(Number(limit) || 50, 100), Math.max(Number(offset) || 0, 0)]
      );

      return result.rows.reverse();
    },
  };
}
