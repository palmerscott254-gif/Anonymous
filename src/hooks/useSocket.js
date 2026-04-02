import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function useSocket(identity) {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [error, setError] = useState(null);
  
  const socketRef = useRef(null);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!socketRef.current) {
      const socket = io(SOCKET_SERVER_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      });

      socket.on('connect', () => {
        console.log('[SOCKET] Connected:', socket.id);
        setConnected(true);
        setSessionId(socket.id);

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

      socket.on('session.ready', (payload) => {
        console.log('[SOCKET] Session ready:', payload);
        setPeerId(payload.peerId);
      });

      socket.on('connect_error', (err) => {
        console.error('[SOCKET] Connection error:', err);
        setError(err.message);
      });

      socket.on('error', (payload) => {
        console.error('[SOCKET] Error event:', payload);
        setError(payload.message);
      });

      socket.on('disconnect', () => {
        console.log('[SOCKET] Disconnected');
        setConnected(false);
      });

      // Pass through all other events to registered listeners
      socket.onAny((eventName, ...args) => {
        if (listenersRef.current[eventName]) {
          listenersRef.current[eventName].forEach(callback => {
            try {
              callback(...args);
            } catch (err) {
              console.error(`[SOCKET] Error in listener for ${eventName}:`, err);
            }
          });
        }
      });

      socketRef.current = socket;
    }

    return () => {
      // Don't disconnect on unmount, keep connection alive
    };
  }, [identity]);

  useEffect(() => {
    if (socketRef.current?.connected && identity) {
      socketRef.current.emit('session.hello', {
        deviceId: socketRef.current.id,
        identity: {
          username: identity.username || 'Ghost',
          emoji: identity.emoji || '👤',
        },
      });
    }
  }, [identity?.username, identity?.emoji]);

  const emit = (eventName, payload) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(eventName, payload);
    } else {
      console.warn(`[SOCKET] Cannot emit ${eventName}: not connected`);
    }
  };

  const on = (eventName, callback) => {
    if (!listenersRef.current[eventName]) {
      listenersRef.current[eventName] = [];
    }
    listenersRef.current[eventName].push(callback);

    return () => {
      listenersRef.current[eventName] = listenersRef.current[eventName].filter(
        cb => cb !== callback
      );
    };
  };

  const off = (eventName, callback) => {
    if (listenersRef.current[eventName]) {
      listenersRef.current[eventName] = listenersRef.current[eventName].filter(
        cb => cb !== callback
      );
    }
  };

  return {
    socket: socketRef.current,
    connected,
    sessionId,
    peerId,
    error,
    emit,
    on,
    off,
  };
}
