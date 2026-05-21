import { useEffect, useRef, useState } from 'react';
import { fetchGuestSession, getAccessToken, setAccessToken } from '../services/auth.js';
import { initSocket, updateSocketIdentity } from '../services/socket.js';

export function useSocket(identity) {
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const listenersRef = useRef({});

  useEffect(() => {
    let disposed = false;
    let socket = socketRef.current;

    const handleAny = (eventName, ...args) => {
      const callbacks = listenersRef.current[eventName];
      if (!callbacks) return;
      callbacks.forEach((callback) => {
        try {
          callback(...args);
        } catch (err) {
          console.error(`[SOCKET] Error in listener for ${eventName}:`, err);
        }
      });
    };

    const connectSocket = async () => {
      let token = getAccessToken();
      if (!token) {
        try {
          const guest = await fetchGuestSession(identity);
          token = guest?.tokens?.accessToken || null;
        } catch (fetchError) {
          console.warn('[AUTH] Guest bootstrap failed, connecting without token', fetchError);
        }
      }

      if (disposed) return;

      if (!socket) {
        socket = initSocket({ identity, token });
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('[SOCKET] Connected:', socket.id);
          setConnected(true);
          setSessionId(socket.id);
        });

        socket.on('session.ready', (payload) => {
          console.log('[SOCKET] Session ready:', payload);
          setPeerId(payload.peerId);
          if (payload?.accessToken) {
            setAccessToken(payload.accessToken);
          }
        });

        socket.on('connect_error', (err) => {
          console.error('[SOCKET] Connection error:', err?.message || err);
          setError(err?.message || 'Unable to connect to the backend');
        });

        socket.on('error', (payload) => {
          console.error('[SOCKET] Error event:', payload);
          setError(payload?.message || 'Socket error');
        });

        socket.on('disconnect', () => {
          console.log('[SOCKET] Disconnected');
          setConnected(false);
        });

        socket.onAny(handleAny);
      } else if (!socket.connected) {
        socket.auth = token ? { token } : undefined;
        socket.connect();
      }

      updateSocketIdentity(identity, token);
    };

    connectSocket();

    return () => {
      disposed = true;
      if (socketRef.current) {
        socketRef.current.offAny(handleAny);
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [identity]);

  const emit = (eventName, payload, ack) => {
    if (socketRef.current?.connected) {
      if (typeof ack === 'function') {
        socketRef.current.emit(eventName, payload, ack);
      } else {
        socketRef.current.emit(eventName, payload);
      }
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
        (cb) => cb !== callback
      );
    };
  };

  const off = (eventName, callback) => {
    if (listenersRef.current[eventName]) {
      listenersRef.current[eventName] = listenersRef.current[eventName].filter(
        (cb) => cb !== callback
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
