/**
 * Socket Event Controllers
 * Handles session lifecycle (hello, auth, ready)
 */

import { addUserSession, generatePeerId } from '../services/room.js';
import { enforceSocketRateLimit } from '../services/rateLimit.js';

export const sessionController = {
  handleSessionHello(socket, sessionId, payload) {
    const NODE_ENV = process.env.NODE_ENV || 'development';
    const { deviceId, identity } = payload;
    
    const session = {
      sessionId,
      deviceId,
      userId: `user-${deviceId}`,
      emoji: identity?.emoji || '👤',
      username: identity?.username || 'Anonymous',
      roomCode: null,
      peerId: generatePeerId(),
      connectedAt: Date.now(),
    };
    
    addUserSession(sessionId, session);
    
    socket.emit('session.ready', {
      sessionId,
      peerId: session.peerId,
      serverTime: Date.now(),
      features: {
        e2ee: true,
        messageSigning: true,
        autoShred: true,
        groups: true,
        fileSharing: true,
      },
    });
    
    console.log(`[SESSION.READY] ${sessionId} → ${session.peerId}`);
  },
};
