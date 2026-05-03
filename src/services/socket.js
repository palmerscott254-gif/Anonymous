/**
 * Socket Service
 * Wrapper around Socket.IO for centralized event handling
 */

import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

let socketInstance = null;
let listenersMap = new Map();

export function initSocket(identity) {
  if (socketInstance) return socketInstance;
  
  const socket = io(SOCKET_SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });
  
  socket.on('connect', () => {
    console.log('[SOCKET] Connected with id:', socket.id);
    
    // Send session.hello
    if (identity) {
      socket.emit('session.hello', {
        deviceId: socket.id,
        identity: {
          username: identity.username || 'Ghost',
          emoji: identity.emoji || '👤',
        },
      });
    }
  });

  socket.on('connect_error', (err) => {
    console.error('[SOCKET] Connection error:', err);
  });

  socket.on('disconnect', () => {
    console.log('[SOCKET] Disconnected');
  });

  socketInstance = socket;
  return socket;
}

export function getSocket() {
  return socketInstance;
}

export function isSocketConnected() {
  return socketInstance?.connected ?? false;
}

export function socketEmit(eventName, payload, ack) {
  if (!socketInstance?.connected) {
    console.warn(`[SOCKET] Cannot emit ${eventName}: socket not connected`);
    return;
  }
  
  if (typeof ack === 'function') {
    socketInstance.emit(eventName, payload, ack);
  } else {
    socketInstance.emit(eventName, payload);
  }
}

export function socketOn(eventName, callback) {
  if (!socketInstance) {
    console.warn(`[SOCKET] Cannot register listener for ${eventName}: socket not initialized`);
    return () => {};
  }

  if (!listenersMap.has(eventName)) {
    listenersMap.set(eventName, []);
    socketInstance.on(eventName, (...args) => {
      const callbacks = listenersMap.get(eventName) || [];
      callbacks.forEach(cb => {
        try {
          cb(...args);
        } catch (err) {
          console.error(`[SOCKET] Error in listener for ${eventName}:`, err);
        }
      });
    });
  }

  listenersMap.get(eventName).push(callback);

  // Return unsubscribe function
  return () => {
    const callbacks = listenersMap.get(eventName) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  };
}

export function socketOff(eventName) {
  if (socketInstance) {
    socketInstance.off(eventName);
    listenersMap.delete(eventName);
  }
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    listenersMap.clear();
  }
}

export function reconnectSocket() {
  if (socketInstance) {
    socketInstance.connect();
  }
}
