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
import { createRoomRoutes } from './http/roomRoutes.js';
import { createMessageRoutes } from './http/messageRoutes.js';
import { createSessionRoutes } from './http/sessionRoutes.js';
import { createUserRoutes } from './http/userRoutes.js';
import { createKeysRoutes } from './http/keysRoutes.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createRoomRepository } from './repositories/roomRepository.js';
import { createMessageRepository } from './repositories/messageRepository.js';
import { createSessionRepository } from './repositories/sessionRepository.js';
import { createPeerCodeRepository } from './repositories/peerCodeRepository.js';
import { createAuthService } from './services/authService.js';
import { createAuthRoutes } from './http/authRoutes.js';

function isSafeLocalOrigin(origin) {
  if (!origin) return false;

  try {
    const parsed = new URL(origin);
    if (parsed.protocol === 'capacitor:' || parsed.protocol === 'ionic:') {
      return true;
    }

    if (['localhost', '127.0.0.1', '10.0.2.2', '10.0.3.2'].includes(parsed.hostname)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

function createOriginChecker(env, allowedOrigins) {
  const originList = new Set(allowedOrigins);
  const allowWildcard = env.NODE_ENV !== 'production';

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowWildcard && (!originList.size || originList.has('*'))) {
      callback(null, true);
      return;
    }

    if (originList.has(origin) || isSafeLocalOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS origin denied'));
  };
}

export function createGhostChatRuntime({ env, dbPool }) {
  const userRepository = createUserRepository({ dbPool });
  const roomRepository = createRoomRepository({ dbPool });
  const messageRepository = createMessageRepository({ dbPool });
  const sessionRepository = createSessionRepository({ dbPool });
  const peerCodeRepository = createPeerCodeRepository({ dbPool });
  const authService = createAuthService({ env, userRepository, sessionRepository });

  const allowedOrigins = getAllowedOrigins();
  const corsOriginChecker = createOriginChecker(env, allowedOrigins);
  const app = express();
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: corsOriginChecker,
      methods: ['GET', 'POST'],
      credentials: true,
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
      origin: corsOriginChecker,
      methods: ['GET', 'POST'],
      credentials: true,
    })
  );
  app.use(express.json({ limit: '150kb' }));
  app.use(enforceHttpRateLimit);

  app.locals.messageRepository = messageRepository;

  app.use('/auth', createAuthRoutes({ authService }));
  app.use('/session', createSessionRoutes({ authService, userRepository }));
  app.use('/api/keys', createKeysRoutes({ authService, userRepository, peerCodeRepository }));
  app.use('/rooms', createRoomRoutes({ env, authService, roomRepository }));
  app.use('/messages', createMessageRoutes({ env, authService, roomRepository, messageRepository, io }));
  app.use('/users', createUserRoutes({ authService, userRepository }));

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
      peerCodeRepository,
    },
  };
}
