/**
 * Socket Service
 * Wrapper around Socket.IO for centralized event handling
 */

import { io } from 'socket.io-client';
import { getAccessToken } from './auth.js';
import { buildSocketOptions, resolveSocketBaseUrl } from './runtimeUrl.js';

let socketInstance = null;
let listenersMap = new Map();
let socketIdentity = null;
let socketToken = null;
let socketStatus = {
  state: 'idle',
  baseUrl: null,
  lastError: null,
  lastDisconnectReason: null,
  lastConnectAt: null,
  lastReconnectAt: null,
};

function updateSocketStatus(patch) {
  socketStatus = {
    ...socketStatus,
    ...patch,
  };
}

function emitIdentity(socket, identity, token) {
  if (!socket || !identity) return;

  socket.emit('session.hello', {
    deviceId: socket.id,
    token: token || undefined,
    identity: {
      username: identity.username || 'Ghost',
      emoji: identity.emoji || '👤',
      keys: identity.keys || undefined,
    },
  });
}

function attachDiagnostics(socket, baseUrl) {
  updateSocketStatus({ baseUrl, state: 'connecting', lastError: null, lastDisconnectReason: null });

  socket.on('connect', () => {
    console.log(`[SOCKET] Connected to ${baseUrl} with id:`, socket.id);
    updateSocketStatus({
      state: 'connected',
      lastError: null,
      lastConnectAt: Date.now(),
    });
    emitIdentity(socket, socketIdentity, socketToken);
  });

  socket.on('connect_error', (err) => {
    console.error('[SOCKET] Connection error:', err?.message || err);
    updateSocketStatus({
      state: 'error',
      lastError: err?.message || 'Connection error',
    });
  });

  socket.on('reconnect_attempt', (attempt) => {
    console.log(`[SOCKET] Reconnect attempt ${attempt} -> ${baseUrl}`);
    updateSocketStatus({
      state: 'reconnecting',
    });
  });

  socket.on('reconnect', (attempt) => {
    console.log(`[SOCKET] Reconnected after ${attempt} attempt(s)`);
    updateSocketStatus({
      state: 'connected',
      lastError: null,
      lastReconnectAt: Date.now(),
    });
  });

  socket.on('reconnect_error', (err) => {
    console.error('[SOCKET] Reconnect error:', err?.message || err);
    updateSocketStatus({
      state: 'error',
      lastError: err?.message || 'Reconnect error',
    });
  });

  socket.on('disconnect', (reason) => {
    console.log('[SOCKET] Disconnected:', reason);
    updateSocketStatus({
      state: 'disconnected',
      lastDisconnectReason: reason || 'disconnect',
    });
  });
}

export function initSocket({ identity, token } = {}) {
  socketIdentity = identity || socketIdentity;
  socketToken = token || getAccessToken() || socketToken;

  if (socketInstance) {
    if (!socketInstance.connected) {
      socketInstance.auth = socketToken ? { token: socketToken } : undefined;
      socketInstance.connect();
    } else {
      emitIdentity(socketInstance, socketIdentity, socketToken);
    }
    return socketInstance;
  }

  const { url, options } = buildSocketOptions({ identity: socketIdentity, token: socketToken });
  const socket = io(url, options);
  attachDiagnostics(socket, resolveSocketBaseUrl());

  socketInstance = socket;
  return socket;
}

export function updateSocketIdentity(identity, token) {
  socketIdentity = identity || socketIdentity;
  socketToken = token || socketToken || getAccessToken();

  if (socketInstance?.connected) {
    socketInstance.auth = socketToken ? { token: socketToken } : undefined;
    emitIdentity(socketInstance, socketIdentity, socketToken);
  }
}

export function getSocket() {
  return socketInstance;
}

export function isSocketConnected() {
  return socketInstance?.connected ?? false;
}

export function socketEmit(eventName, payload, ack) {
  if (!socketInstance?.connected) {
    console.warn(`[SOCKET] Cannot emit ${eventName}: socket not connected`, getSocketStatus());
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
    updateSocketStatus({
      state: 'idle',
      lastDisconnectReason: 'manual',
    });
  }
}

export function reconnectSocket() {
  if (socketInstance) {
    socketInstance.auth = socketToken ? { token: socketToken } : undefined;
    updateSocketStatus({ state: 'connecting' });
    socketInstance.connect();
  }
}

export function getSocketStatus() {
  return {
    ...socketStatus,
    connected: socketInstance?.connected ?? false,
    socketId: socketInstance?.id ?? null,
    hasAuthToken: Boolean(socketToken),
  };
}
