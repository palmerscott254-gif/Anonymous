import express from 'express';
import { createServer } from 'node:http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { getAllowedOrigins } from './config/env.js';
import { setupHealthRoutes } from './routes/health.js';
import { setupSocketHandlers } from './sockets/handlers.js';
import { enforceHttpRateLimit } from './services/rateLimit.js';
import { getRoomStorage } from './services/room.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createRoomRepository } from './repositories/roomRepository.js';
import { createMessageRepository } from './repositories/messageRepository.js';
import { createSessionRepository } from './repositories/sessionRepository.js';
import { createAuthService } from './services/authService.js';
import { createAuthRoutes } from './http/authRoutes.js';

export function createGhostChatRuntime({ env, dbPool }) {
  const userRepository = createUserRepository({ dbPool });
  const roomRepository = createRoomRepository({ dbPool });
  const messageRepository = createMessageRepository({ dbPool });
  const sessionRepository = createSessionRepository({ dbPool });
  const authService = createAuthService({ env, userRepository, sessionRepository });

  const allowedOrigins = getAllowedOrigins();
  const app = express();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('CORS origin denied'));
      },
      methods: ['GET', 'POST'],
    },
  });

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('CORS origin denied'));
      },
      methods: ['GET', 'POST'],
    })
  );
  app.use(express.json({ limit: '150kb' }));
  app.use(enforceHttpRateLimit);

  app.use('/auth', createAuthRoutes({ authService }));

  const { rooms, userSessions } = getRoomStorage();
  setupHealthRoutes(app, { dbPool, rooms, userSessions });

  setupSocketHandlers(io, {
    env,
    authService,
    roomRepository,
    messageRepository,
  });

  return {
    app,
    io,
    httpServer,
    services: {
      authService,
      roomRepository,
      messageRepository,
      userRepository,
      sessionRepository,
    },
  };
}
