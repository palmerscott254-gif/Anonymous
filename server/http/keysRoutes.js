import { Router } from 'express';
import { toHttpErrorPayload, makeError } from '../lib/errors.js';
import { displayPeerCode, generateSecurePeerCode, normalizePeerCode } from '../repositories/peerCodeRepository.js';

const ALLOWED_EXPIRY_MINUTES = new Set([5, 10, 30, 60]);

function readBearerToken(req) {
  const header = String(req.get('authorization') || '');
  return header.replace(/^Bearer\s+/i, '').trim() || null;
}

function buildAuthContext(req, authService) {
  const token = readBearerToken(req);
  const claims = token ? authService.verifyAccessToken(token) : null;
  if (!claims) {
    throw makeError('UNAUTHORIZED', 'Missing or invalid token', 401);
  }
  return { token, claims };
}

function buildExpiresAt(expiryMinutes) {
  return Date.now() + expiryMinutes * 60 * 1000;
}

export function createKeysRoutes({ authService, userRepository, peerCodeRepository }) {
  const router = Router();

  router.post('/generate', async (req, res) => {
    try {
      const { claims } = buildAuthContext(req, authService);
      const requestedMinutes = Number(req.body?.expires_in_minutes);
      if (!ALLOWED_EXPIRY_MINUTES.has(requestedMinutes)) {
        res.status(400).json({ error: { code: 'INVALID_EXPIRY', message: 'expires_in_minutes must be one of 5, 10, 30, or 60' } });
        return;
      }

      const creatorId = claims?.sub || null;
      const expiresAt = buildExpiresAt(requestedMinutes);

      await peerCodeRepository.cleanupExpiredPeerCodes?.();

      let created = null;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = generateSecurePeerCode();
        // Keep the in-memory path and SQL path aligned on the same normalized code.
        created = await peerCodeRepository.createPeerCode({ creatorId, code, expiresAt });
        if (created) break;
      }

      if (!created) {
        throw makeError('CODE_GENERATION_FAILED', 'Unable to generate a unique peer code', 500);
      }

      res.status(201).json({
        code: displayPeerCode(created.code || created.codeNormalized || ''),
        expires_at: new Date(created.expiresAt).toISOString(),
      });
    } catch (error) {
      res.status(error?.status || 500).json(toHttpErrorPayload(error));
    }
  });

  router.post('/redeem', async (req, res) => {
    try {
      const { claims } = buildAuthContext(req, authService);
      const code = displayPeerCode(req.body?.code || req.body?.peer_code || req.body?.peerCode || '');
      if (!normalizePeerCode(code)) {
        res.status(400).json({ error: { code: 'INVALID_CODE', message: 'A valid peer code is required' } });
        return;
      }

      const record = await peerCodeRepository.markPeerCodeUsed({ code, usedBy: claims?.sub || null });
      if (!record) {
        res.status(404).json({ error: { code: 'CODE_NOT_FOUND', message: 'Peer code not found, already used, or expired' } });
        return;
      }

      res.status(200).json({
        ok: true,
        code: displayPeerCode(record.code || code),
        expires_at: new Date(record.expiresAt).toISOString(),
        used_by: claims?.sub || null,
      });
    } catch (error) {
      res.status(error?.status || 500).json(toHttpErrorPayload(error));
    }
  });

  return router;
}
