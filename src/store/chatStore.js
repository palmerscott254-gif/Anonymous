/**
 * Global Chat State Management
 * Manages rooms, messages, user state, and settings
 */

import { useCallback, useState } from 'react';

export function useChatState() {
  // Chat/Session state
  const [sessionId, setSessionId] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  // Profile state
  const [profile, setProfile] = useState({
    username: 'Ghost',
    emoji: '🦅',
    peerCode: '',
  });

  // Room state
  const [currentRoom, setCurrentRoom] = useState(null);
  const [chats, setChats] = useState([]);
  const [groups, setGroups] = useState([]);

  // Message state
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Set());

  // Key material state
  const [keyMaterial, setKeyMaterial] = useState(null);

  // Settings
  const [settings, setSettings] = useState({
    endToEndEncryption: true,
    websocketTunnels: true,
    messageShredding: true,
    stealthMode: false,
    androidOptimization: true,
  });

  // Actions
  const addChat = useCallback((chat) => {
    setChats(prev => {
      const exists = prev.find(c => c.id === chat.id);
      if (exists) return prev;
      return [...prev, chat];
    });
  }, []);

  const updateChat = useCallback((chatId, updates) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, ...updates } : c));
  }, []);

  const addGroup = useCallback((group) => {
    setGroups(prev => {
      const exists = prev.find(g => g.id === group.id);
      if (exists) return prev;
      return [...prev, group];
    });
  }, []);

  const addMessage = useCallback((message) => {
    setMessages(prev => {
      if (prev.some(m => m.msgId === message.msgId)) return prev;
      return [...prev, message];
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const addTypingUser = useCallback((peerId) => {
    setTypingUsers(prev => new Set([...prev, peerId]));
  }, []);

  const removeTypingUser = useCallback((peerId) => {
    setTypingUsers(prev => {
      const next = new Set(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  const updateSettings = useCallback((newSettings) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  return {
    // Session
    sessionId,
    setSessionId,
    peerId,
    setPeerId,
    connected,
    setConnected,
    error,
    setError,

    // Profile
    profile,
    setProfile,

    // Room
    currentRoom,
    setCurrentRoom,
    chats,
    setChats,
    addChat,
    updateChat,
    groups,
    setGroups,
    addGroup,

    // Messages
    messages,
    setMessages,
    addMessage,
    clearMessages,

    // Typing
    typingUsers,
    addTypingUser,
    removeTypingUser,

    // Keys
    keyMaterial,
    setKeyMaterial,

    // Settings
    settings,
    updateSettings,
  };
}
