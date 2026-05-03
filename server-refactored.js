/**
 * GhostChat Server
 * Refactored with modular architecture
 * Maintains 100% backward compatibility with original
 */

import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { Pool } from 'pg';

// Import modular services
import { setupHealthRoutes } from './server/routes/health.js';
import { setupSocketHandlers } from './server/sockets/handlers.js';
import {
  applySecurityHeaders,
  getAllowedOrigins,
  isCorsOriginAllowed,
  getCorsOptions,
  validateProductionConfig,
  getSafeDatabaseTarget,
} from './server/middleware/security.js';
import { enforceHttpRateLimit } from './server/services/rateLimit.js';
import { getRoomStorage } from './server/services/room.js';

// Environment setup
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = Number(process.env.PORT || 3001);
const DATABASE_URL = process.env.DATABASE_URL || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';

// Validate production config
const { allowedOrigins } = validateProductionConfig();

// Database setup
const safeDatabaseTarget = getSafeDatabaseTarget(DATABASE_URL);
const dbPool = DATABASE_URL
  ? new Pool({
      connectionString: DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 5000,
      connectionTimeoutMillis: 3000,
    })
  : null;

if (dbPool) {
  dbPool.on('error', (error) => {
    console.error('[DB] Pool error:', error.message);
  });
}

// Express and Socket.IO setup
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin denied'));
    },
    methods: ['GET', 'POST']
  }
});

// Middleware
app.set('trust proxy', 1);
app.use(applySecurityHeaders);
app.use(cors(getCorsOptions(allowedOrigins)));
app.use(enforceHttpRateLimit);
app.use(express.json({ limit: '100kb' }));

// Health check routes
const { rooms, userSessions } = getRoomStorage();
setupHealthRoutes(app, { dbPool, rooms, userSessions });

// Socket handlers
setupSocketHandlers(io);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 GhostChat server ready on ${PORT}`);
  console.log(`[CONFIG] NODE_ENV=${NODE_ENV}`);
  if (safeDatabaseTarget) {
    console.log(`[CONFIG] DATABASE_URL=${safeDatabaseTarget}`);
  }
});
