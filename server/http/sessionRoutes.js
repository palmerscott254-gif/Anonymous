import { Router } from 'express';
import { toHttpErrorPayload } from '../lib/errors.js';

function readBearerToken(req) {
  const header = String(req.get('authorization') || '');
  return header.replace(/^Bearer\s+/i, '').trim() || null;
}

export function createSessionRoutes({ authService, userRepository }) {
  const router = Router();

  router.get('/me', async (req, res) => {
    try {
      const token = readBearerToken(req);
      const claims = token ? authService.verifyAccessToken(token) : null;
      if (!claims) {
        res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid token' } });
        return;
      }

      const user = userRepository?.findById ? await userRepository.findById(claims.sub) : null;
      res.status(200).json({
        user: user ? { ...user, guest: Boolean(claims.guest) } : { id: claims.sub, username: claims.username, guest: Boolean(claims.guest) },
        claims,
      });
    } catch (error) {
      res.status(error?.status || 500).json(toHttpErrorPayload(error));
    }
  });

  router.post('/refresh', async (req, res) => {
    try {
      const result = await authService.refresh(req.body || {}, {
        userAgent: req.get('user-agent') || null,
        ipAddress: req.ip || req.socket?.remoteAddress || null,
      });
      res.status(200).json(result);
    } catch (error) {
      res.status(error?.status || 500).json(toHttpErrorPayload(error));
    }
  });

  router.post('/logout', async (req, res) => {
    try {
      const result = await authService.logout(req.body || {});
      res.status(200).json(result);
    } catch (error) {
      res.status(error?.status || 500).json(toHttpErrorPayload(error));
    }
  });

  return router;
}