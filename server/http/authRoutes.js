import { Router } from 'express';
import { z } from 'zod';
import { toHttpErrorPayload } from '../lib/errors.js';

const RegisterSchema = z.object({
  username: z.string().min(3).max(80),
  password: z.string().min(8).max(120),
  publicKey: z.string().max(4096).optional(),
});

const LoginSchema = z.object({
  username: z.string().min(3).max(80),
  password: z.string().min(8).max(120),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(10),
});

const LogoutSchema = z.object({
  refreshToken: z.string().min(10).optional(),
});

const GuestSchema = z.object({
  username: z.string().max(80).optional(),
  publicKey: z.string().max(4096).optional(),
});

export function createAuthRoutes({ authService }) {
  const router = Router();

  function requestMeta(req) {
    return {
      userAgent: req.get('user-agent') || null,
      ipAddress: req.ip || req.socket?.remoteAddress || null,
    };
  }

  router.post('/register', async (req, res) => {
    try {
      const payload = RegisterSchema.parse(req.body || {});
      const result = await authService.register(payload, requestMeta(req));
      res.status(201).json(result);
    } catch (error) {
      const status = error?.status || (error?.name === 'ZodError' ? 400 : 500);
      res.status(status).json(toHttpErrorPayload(error));
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const payload = LoginSchema.parse(req.body || {});
      const result = await authService.login(payload, requestMeta(req));
      res.status(200).json(result);
    } catch (error) {
      const status = error?.status || (error?.name === 'ZodError' ? 400 : 500);
      res.status(status).json(toHttpErrorPayload(error));
    }
  });

  router.post('/refresh', async (req, res) => {
    try {
      const payload = RefreshSchema.parse(req.body || {});
      const result = await authService.refresh(payload, requestMeta(req));
      res.status(200).json(result);
    } catch (error) {
      const status = error?.status || (error?.name === 'ZodError' ? 400 : 500);
      res.status(status).json(toHttpErrorPayload(error));
    }
  });

  router.post('/logout', async (req, res) => {
    try {
      const payload = LogoutSchema.parse(req.body || {});
      const result = await authService.logout(payload);
      res.status(200).json(result);
    } catch (error) {
      const status = error?.status || (error?.name === 'ZodError' ? 400 : 500);
      res.status(status).json(toHttpErrorPayload(error));
    }
  });

  router.post('/guest', async (req, res) => {
    try {
      const payload = GuestSchema.parse(req.body || {});
      const result = await authService.guest(payload, requestMeta(req));
      res.status(200).json(result);
    } catch (error) {
      const status = error?.status || (error?.name === 'ZodError' ? 400 : 500);
      res.status(status).json(toHttpErrorPayload(error));
    }
  });

  return router;
}
