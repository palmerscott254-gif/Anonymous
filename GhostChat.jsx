import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "./src/hooks/useSocket";
import { Avatar, NavBar, LockIcon, ShieldIcon } from "./src/components/UI.jsx";
import { ChatsScreen } from "./src/components/ChatsScreen.jsx";
import { ChatRoom } from "./src/components/ChatRoom.jsx";
import { SearchScreen } from "./src/components/SearchScreen.jsx";
import { CodeGenScreen } from "./src/components/CodeGenScreen.jsx";
import { GroupsScreen } from "./src/components/GroupsScreen.jsx";
import { ProfileScreen } from "./src/components/ProfileScreen.jsx";
import { listRooms as fetchRooms, createRoom as createRoomApi } from "./src/services/rooms.js";
import { fetchMessagesForRoom } from "./src/services/messages.js";
import { sendEncryptedMessage } from "./src/services/messages.js";
import { getAccessToken } from "./src/services/auth.js";
import { fetchCurrentSession } from "./src/services/session.js";
import { fetchHealth } from "./src/services/health.js";
import { generatePeerCode as generatePeerCodeRequest } from "./src/services/keys.js";
import {
  DEFAULT_SETTINGS,
  DEFAULT_PROFILE,
  DEFAULT_ACTIVITY,
  STORAGE_KEYS,
} from "./src/utils/constants.js";

const CHATS = [];
const GROUPS = [];
const SEARCH_RESULTS = [];

const COLORS = {
  bg: "#080B12",
  surface: "#0D1117",
  card: "#111827",
  border: "#1F2937",
  accent: "#00FFB2",
  accentDim: "#00FFB220",
  accentGlow: "#00FFB240",
  purple: "#A855F7",
  purpleDim: "#A855F720",
  red: "#FF4444",
  text: "#F1F5F9",
  textMuted: "#6B7280",
  textSub: "#9CA3AF",
  bubble: "#1A2235",
  bubbleSelf: "#003D2A",
};

const FONT = "'Space Mono', monospace";
const SANS = "'DM Sans', sans-serif";
const TAB_ORDER = ["chats", "search", "codegen", "groups", "profile"];
const SWIPE_THRESHOLD = 48;

function readStoredJson(key, fallback) {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return fallback;
    return JSON.parse(stored);
  } catch {
    return fallback;
  }
}

function isInteractiveSwipeTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(target.closest("button, input, textarea, select, a, [contenteditable='true']"));
}

function stripLeadingEmoji(name = "") {
  return name.replace(LEADING_EMOJI_REGEX, "").trim();
}

function getNowHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function generatePeerCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const first = letters[Math.floor(Math.random() * letters.length)];
  const second = letters[Math.floor(Math.random() * letters.length)];
  const tail = Array.from({ length: 4 }, () => digits[Math.floor(Math.random() * digits.length)]).join("");
  return `${first}${second}-${tail}`;
}

function normalizePeerCode(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function displayPeerCode(value = "") {
  const normalized = normalizePeerCode(value);
  if (!normalized) return "";
  if (normalized.length <= 2) return normalized;
  if (normalized.length === 8) return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  if (normalized.length === 6) return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

function getTabFromSwipeDirection(deltaX) {
  if (Math.abs(deltaX) < SWIPE_THRESHOLD) return null;
  return deltaX < 0 ? 1 : -1;
}

function formatFileSize(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function appendMessageUnique(items = [], nextMessage) {
  if (!nextMessage?.id) return [...items, nextMessage];
  if (items.some((item) => item.id === nextMessage.id)) return items;
  return [...items, nextMessage];
}

function isImageMimeType(mime = "") {
  return /^image\//i.test(mime);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall back below
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textArea);
    return copied;
  } catch {
    return false;
  }
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64Value = "") {
  const normalized = String(base64Value || "").trim();
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getCryptoSubtle() {
  if (!window?.crypto?.subtle) {
    throw new Error("WebCrypto not available");
  }
  return window.crypto.subtle;
}

function getRandomBytes(length) {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

async function exportPublicKeyBase64(key) {
  const subtle = getCryptoSubtle();
  const spki = await subtle.exportKey("spki", key);
  return bytesToBase64(new Uint8Array(spki));
}

async function importEncryptionPublicKey(base64Key) {
  const subtle = getCryptoSubtle();
  return subtle.importKey(
    "spki",
    base64ToBytes(base64Key),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

async function importSigningPublicKey(base64Key) {
  const subtle = getCryptoSubtle();
  return subtle.importKey(
    "spki",
    base64ToBytes(base64Key),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
}

async function generateKeyMaterial() {
  const subtle = getCryptoSubtle();
  const [encryptionKeyPair, signingKeyPair] = await Promise.all([
    subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false,
      ["deriveBits"]
    ),
    subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"]
    ),
  ]);

  const [encryptionPublicKey, signingPublicKey] = await Promise.all([
    exportPublicKeyBase64(encryptionKeyPair.publicKey),
    exportPublicKeyBase64(signingKeyPair.publicKey),
  ]);

  return {
    encryptionKeyPair,
    signingKeyPair,
    encryptionPublicKey,
    signingPublicKey,
  };
}

function buildSignedMessageBlob(payload) {
  return JSON.stringify({
    clientMsgId: String(payload.clientMsgId || ""),
    sentAt: Number(payload.sentAt || 0),
    bodyCiphertext: String(payload.bodyCiphertext || ""),
    bodyIv: String(payload.bodyIv || ""),
    bodyFormat: String(payload.bodyFormat || ""),
    wrappedKeys: payload.wrappedKeys && typeof payload.wrappedKeys === "object" ? payload.wrappedKeys : {},
  });
}

async function signMessagePayload(signingPrivateKey, payload) {
  const subtle = getCryptoSubtle();
  const signature = await subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingPrivateKey,
    textEncoder.encode(buildSignedMessageBlob(payload))
  );
  return bytesToBase64(new Uint8Array(signature));
}

async function verifyMessagePayloadSignature(signingPublicKey, payload, signatureBase64) {
  const subtle = getCryptoSubtle();
  return subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    signingPublicKey,
    base64ToBytes(signatureBase64),
    textEncoder.encode(buildSignedMessageBlob(payload))
  );
}

async function deriveWrapKey(sharedSecretBytes, saltBytes) {
  const subtle = getCryptoSubtle();
  const secretMaterial = await subtle.importKey("raw", sharedSecretBytes, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: saltBytes,
      info: textEncoder.encode("ghostchat-e2ee-wrap-v1"),
    },
    secretMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptEnvelopeForRecipients({ envelope, senderPrivateEncryptionKey, recipients }) {
  const subtle = getCryptoSubtle();
  const contentKeyBytes = getRandomBytes(32);
  const contentKey = await subtle.importKey("raw", contentKeyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const bodyIvBytes = getRandomBytes(12);

  const plaintext = textEncoder.encode(JSON.stringify(envelope));
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv: bodyIvBytes }, contentKey, plaintext);

  const wrappedKeys = {};
  for (const recipient of recipients) {
    const recipientPublicKey = await importEncryptionPublicKey(recipient.encryptionPublicKey);
    const sharedBits = await subtle.deriveBits(
      { name: "ECDH", public: recipientPublicKey },
      senderPrivateEncryptionKey,
      256
    );
    const wrapSalt = getRandomBytes(16);
    const wrapIv = getRandomBytes(12);
    const wrapKey = await deriveWrapKey(new Uint8Array(sharedBits), wrapSalt);
    const wrapped = await subtle.encrypt({ name: "AES-GCM", iv: wrapIv }, wrapKey, contentKeyBytes);

    wrappedKeys[recipient.peerId] = {
      iv: bytesToBase64(wrapIv),
      salt: bytesToBase64(wrapSalt),
      ciphertext: bytesToBase64(new Uint8Array(wrapped)),
    };
  }

  return {
    bodyCiphertext: bytesToBase64(new Uint8Array(ciphertext)),
    bodyIv: bytesToBase64(bodyIvBytes),
    wrappedKeys,
  };
}

async function decryptEnvelopeFromPayload({ payload, myPeerId, myPrivateEncryptionKey, senderEncryptionPublicKey }) {
  const subtle = getCryptoSubtle();
  const wrapped = payload?.wrappedKeys?.[myPeerId];
  if (!wrapped || !wrapped.ciphertext || !wrapped.iv || !wrapped.salt) {
    throw new Error("Missing wrapped key for recipient");
  }

  const senderPublicKey = await importEncryptionPublicKey(senderEncryptionPublicKey);
  const sharedBits = await subtle.deriveBits(
    { name: "ECDH", public: senderPublicKey },
    myPrivateEncryptionKey,
    256
  );

  const wrapKey = await deriveWrapKey(new Uint8Array(sharedBits), base64ToBytes(wrapped.salt));
  const contentKeyRaw = await subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(wrapped.iv) },
    wrapKey,
    base64ToBytes(wrapped.ciphertext)
  );

  const contentKey = await subtle.importKey("raw", contentKeyRaw, { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(payload.bodyIv) },
    contentKey,
    base64ToBytes(payload.bodyCiphertext)
  );

  return JSON.parse(textDecoder.decode(plaintext));
}

// Replaced inline UI component implementations with modular imports above
// ChatRoom, SearchScreen, CodeGenScreen, GroupsScreen, ProfileScreen moved to src/components/

// SearchScreen moved to src/components/SearchScreen.jsx
// CodeGenScreen moved to src/components/CodeGenScreen.jsx
// GroupsScreen moved to src/components/GroupsScreen.jsx
// ProfileScreen moved to src/components/ProfileScreen.jsx
export default function GhostChat() {
  const [tab, setTab] = useState("chats");
  const [activeChat, setActiveChat] = useState(null);
  const [chats, setChats] = useState(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.chats);
      return stored ? JSON.parse(stored) : CHATS;
    } catch {
      return CHATS;
    }
  });
  const [groups, setGroups] = useState(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.groups);
      return stored ? JSON.parse(stored) : GROUPS;
    } catch {
      return GROUPS;
    }
  });
  const [settings, setSettings] = useState(() => {
    try {
      const stored = window.localStorage.getItem("gc.settings");
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [profile, setProfile] = useState(() => {
    try {
      const stored = window.localStorage.getItem("gc.profile");
      if (!stored) return DEFAULT_PROFILE;
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_PROFILE,
        ...parsed,
        peerCode: displayPeerCode(parsed?.peerCode || DEFAULT_PROFILE.peerCode),
      };
    } catch {
      return DEFAULT_PROFILE;
    }
  });
  const [activity, setActivity] = useState(() => {
    try {
      const stored = window.localStorage.getItem("gc.activity");
      return stored ? { ...DEFAULT_ACTIVITY, ...JSON.parse(stored) } : DEFAULT_ACTIVITY;
    } catch {
      return DEFAULT_ACTIVITY;
    }
  });
  const [roomDirectory, setRoomDirectory] = useState(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.rooms);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      // fall through to seed
    }

    const seeded = {};
    SEARCH_RESULTS.forEach((item) => {
      const code = displayPeerCode(item.code);
      const key = normalizePeerCode(code);
      seeded[key] = {
        id: item.id,
        name: item.name,
        code,
        online: true,
        unread: 0,
        last: "Tunnel available",
        time: "now",
        createdAt: Date.now(),
      };
    });
    return seeded;
  });
  const [messagesByRoom, setMessagesByRoom] = useState(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.messages);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });
  const [draftsByRoom, setDraftsByRoom] = useState(() => readStoredJson(STORAGE_KEYS.drafts, {}));
  const [queuedMessages, setQueuedMessages] = useState(() => readStoredJson(STORAGE_KEYS.pendingMessages, []));
  const [sessionInfo, setSessionInfo] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [typingByRoom, setTypingByRoom] = useState({});
  const touchStartRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const probeBackend = async () => {
      try {
        const health = await fetchHealth();
        if (cancelled) return;
        console.info('[HEALTH] Backend reachable:', {
          status: health?.status || 'ok',
          databaseConfigured: Boolean(health?.databaseConfigured),
          env: health?.env,
        });
      } catch (error) {
        if (cancelled) return;
        console.error('[HEALTH] Backend unreachable:', error?.message || error);
      }
    };

    probeBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  // Socket.IO integration
  const { connected, peerId, sessionId, emit: socketEmit, on: socketOn } = useSocket(profile);
  const ownKeyMaterialRef = useRef(null);
  const ownKeyMaterialPromiseRef = useRef(null);
  const [ownKeyMaterialSnapshot, setOwnKeyMaterialSnapshot] = useState(null);
  const roomMemberKeysRef = useRef({});
  const joinedRoomSignatureRef = useRef(null);
  const roomJoinInFlightRef = useRef(null);

  const ensureOwnKeyMaterial = async () => {
    if (ownKeyMaterialRef.current) {
      return ownKeyMaterialRef.current;
    }

    if (!ownKeyMaterialPromiseRef.current) {
      ownKeyMaterialPromiseRef.current = generateKeyMaterial()
        .then((material) => {
          ownKeyMaterialRef.current = material;
          setOwnKeyMaterialSnapshot(material);
          return material;
        })
        .catch((error) => {
          ownKeyMaterialPromiseRef.current = null;
          throw error;
        });
    }

    return ownKeyMaterialPromiseRef.current;
  };

  const setRoomMembersForCode = (roomCode, members = []) => {
    const normalizedCode = normalizePeerCode(roomCode);
    if (!normalizedCode) return;
    const next = {};

    members.forEach((member) => {
      if (!member?.peerId) return;
      const encryptionPublicKey = member?.e2ee?.encryptionPublicKey;
      const signingPublicKey = member?.e2ee?.signingPublicKey;
      if (!encryptionPublicKey || !signingPublicKey) return;
      next[member.peerId] = {
        peerId: member.peerId,
        encryptionPublicKey,
        signingPublicKey,
      };
    });

    roomMemberKeysRef.current[normalizedCode] = next;
  };

  const upsertRoomMember = (roomCode, member) => {
    const normalizedCode = normalizePeerCode(roomCode);
    if (!normalizedCode || !member?.peerId) return;
    const encryptionPublicKey = member?.e2ee?.encryptionPublicKey;
    const signingPublicKey = member?.e2ee?.signingPublicKey;
    if (!encryptionPublicKey || !signingPublicKey) return;

    const roomMembers = roomMemberKeysRef.current[normalizedCode] || {};
    roomMemberKeysRef.current[normalizedCode] = {
      ...roomMembers,
      [member.peerId]: {
        peerId: member.peerId,
        encryptionPublicKey,
        signingPublicKey,
      },
    };
  };

  const removeRoomMember = (roomCode, memberPeerId) => {
    const normalizedCode = normalizePeerCode(roomCode);
    if (!normalizedCode || !memberPeerId) return;
    const roomMembers = roomMemberKeysRef.current[normalizedCode];
    if (!roomMembers) return;
    const { [memberPeerId]: _removed, ...rest } = roomMembers;
    roomMemberKeysRef.current[normalizedCode] = rest;
  };

  const waitForSocketEvent = useCallback(
    (eventName, predicate, timeoutMs = 6000) => {
      if (!socketOn) {
        return Promise.reject(new Error(`Socket listener unavailable for ${eventName}`));
      }

      return new Promise((resolve, reject) => {
        let settled = false;
        const unsubscribe = socketOn(eventName, (payload) => {
          if (typeof predicate === 'function' && !predicate(payload)) {
            return;
          }

          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          unsubscribe?.();
          resolve(payload);
        });

        const timeoutId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          unsubscribe?.();
          reject(new Error(`Timed out waiting for ${eventName}`));
        }, timeoutMs);
      });
    },
    [socketOn]
  );

  const joinActiveRoom = useCallback(
    async (roomLike, reason = 'manual') => {
      if (!connected || !roomLike?.code || !roomLike?.id) {
        return null;
      }

      const roomCode = displayPeerCode(roomLike.code);
      const joinSignature = `${sessionId || 'socket'}:${normalizePeerCode(roomCode)}`;
      if (joinedRoomSignatureRef.current === joinSignature) {
        return null;
      }

      if (roomJoinInFlightRef.current?.joinSignature === joinSignature) {
        return roomJoinInFlightRef.current.promise;
      }

      const joinPromise = (async () => {
        const keyMaterial = await ensureOwnKeyMaterial();
        const payload = {
          roomCode,
          identity: {
            username: profile.username,
            emoji: profile.emoji,
            keys: {
              encryptionPublicKey: keyMaterial.encryptionPublicKey,
              signingPublicKey: keyMaterial.signingPublicKey,
            },
          },
        };

        console.log('[SOCKET.OUTBOUND] room.join', { reason, roomCode, roomId: roomLike.id });
        const joinResponsePromise = waitForSocketEvent(
          'room.joined',
          (response) => normalizePeerCode(response?.roomCode) === normalizePeerCode(roomCode),
          6000
        );

        socketEmit('room.join', payload);

        const joinResponse = await joinResponsePromise;

        joinedRoomSignatureRef.current = joinSignature;
        console.log('[SOCKET.CONFIRMED] room.joined', {
          reason,
          roomCode,
          roomId: joinResponse?.roomId,
          memberCount: Array.isArray(joinResponse?.members) ? joinResponse.members.length : 0,
        });

        return joinResponse;
      })();

      roomJoinInFlightRef.current = {
        joinSignature,
        promise: joinPromise,
      };

      try {
        return await joinPromise;
      } finally {
        if (roomJoinInFlightRef.current?.joinSignature === joinSignature) {
          roomJoinInFlightRef.current = null;
        }
      }
    },
    [connected, ensureOwnKeyMaterial, profile.emoji, profile.username, sessionId, socketEmit, waitForSocketEvent]
  );

  const getRoomByCodeValue = useCallback((roomCode) => {
    const key = normalizePeerCode(roomCode);
    if (!key) return null;
    if (roomDirectory[key]) return roomDirectory[key];
    const fromChats = chats.find((item) => normalizePeerCode(item.code) === key);
    if (fromChats) return fromChats;
    return groups.find((item) => normalizePeerCode(item.code) === key) || null;
  }, [roomDirectory, chats, groups]);

  const upsertEncryptedMessage = async (payload, roomCodeOverride = null, roomIdOverride = null) => {
    const roomCode = payload?.roomCode || roomCodeOverride || "";
    const room = getRoomByCodeValue(roomCode);
    const localRoomId = room?.id || roomIdOverride || payload?.roomId;
    if (!localRoomId) return;

    const sentAt = Number(payload?.sentAt || Date.now());
    const autoShredAt = payload?.autoShredAt || null;
    let text = payload?.bodyCiphertext || "";
    let resolvedAttachment = payload?.attachment || null;
    let replyTo = payload?.replyTo || null;

    if (payload?.bodyFormat === "E2EE_V1") {
      try {
        const keyMaterial = await ensureOwnKeyMaterial();
        const roomMembers = roomMemberKeysRef.current[normalizePeerCode(roomCode)] || {};
        const senderInfo = roomMembers[payload?.fromPeerId];
        if (!senderInfo?.signingPublicKey || !senderInfo?.encryptionPublicKey) {
          throw new Error("Missing sender public key metadata");
        }

        const signingKey = await importSigningPublicKey(senderInfo.signingPublicKey);
        const valid = await verifyMessagePayloadSignature(
          signingKey,
          {
            clientMsgId: payload?.clientMsgId,
            sentAt: payload?.sentAt,
            bodyCiphertext: payload?.bodyCiphertext,
            bodyIv: payload?.bodyIv,
            bodyFormat: payload?.bodyFormat,
            wrappedKeys: payload?.wrappedKeys,
          },
          payload?.signature
        );

        if (!valid) {
          throw new Error("Invalid message signature");
        }

        const envelope = await decryptEnvelopeFromPayload({
          payload,
          myPeerId: peerId,
          myPrivateEncryptionKey: keyMaterial.encryptionKeyPair.privateKey,
          senderEncryptionPublicKey: senderInfo.encryptionPublicKey,
        });

        text = typeof envelope?.text === "string" ? envelope.text : "";
        resolvedAttachment = envelope?.attachment || null;
        replyTo = envelope?.replyTo || replyTo;
      } catch (error) {
        console.error("[E2EE] Failed to decrypt incoming message", error);
        text = "[Unable to decrypt message]";
        resolvedAttachment = null;
      }
    }

    const message = {
      id: payload?.clientMsgId || payload?.msgId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: payload?.fromPeerId === peerId ? "me" : "them",
      text,
      time: new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      read: payload?.fromPeerId === peerId,
      serverMsgId: payload?.msgId || null,
      expiresAt: autoShredAt,
      attachment: resolvedAttachment,
      replyTo,
      reactions: payload?.reactions || {},
    };

    setMessagesByRoom((prev) => {
      const current = prev[localRoomId] || [];
      return {
        ...prev,
        [localRoomId]: appendMessageUnique(current, message),
      };
    });

    return message;
  };

  const hydrateRoomHistory = async (roomCode, roomId) => {
    if (!roomCode || !roomId) return;
    try {
      const recentMessages = await fetchMessagesForRoom(roomCode, 50);
      for (const payload of recentMessages) {
        // Hydrate without disturbing the existing UI state shape.
        // eslint-disable-next-line no-await-in-loop
        await upsertEncryptedMessage(payload, roomCode, roomId);
      }
    } catch (error) {
      console.warn("[ROOM] Failed to load room history", error);
    }
  };

  const updateRoomMessages = useCallback((roomId, updater) => {
    if (!roomId || typeof updater !== "function") return;
    setMessagesByRoom((prev) => {
      const current = prev[roomId] || [];
      const next = updater(current);
      if (next === current) return prev;
      return { ...prev, [roomId]: next };
    });
  }, []);

  const updateMessageById = useCallback((roomId, match, updates) => {
    updateRoomMessages(roomId, (current) => current.map((item) => {
      if (typeof match === "function" ? !match(item) : item.id !== match) return item;
      return { ...item, ...(typeof updates === "function" ? updates(item) : updates) };
    }));
  }, [updateRoomMessages]);

  const updateMessageReaction = useCallback((roomId, messageId, emoji) => {
    updateMessageById(roomId, (item) => item.id === messageId || item.serverMsgId === messageId, (item) => {
      const currentReactions = item.reactions || {};
      const nextCount = Number(currentReactions[emoji] || 0) + 1;
      return {
        reactions: {
          ...currentReactions,
          [emoji]: nextCount,
        },
      };
    });
  }, [updateMessageById]);

  const reactToMessage = useCallback((roomId, messageId, emoji) => {
    const roomMessages = messagesByRoom[roomId] || [];
    const message = roomMessages.find((item) => item.id === messageId || item.serverMsgId === messageId);
    const outboundMsgId = message?.serverMsgId || message?.id || messageId;

    updateMessageReaction(roomId, messageId, emoji);

    if (!connected || !activeChat?.code || !outboundMsgId) return;
    socketEmit('msg.react', {
      roomId,
      roomCode: activeChat.code,
      msgId: outboundMsgId,
      emoji,
      reactedAt: Date.now(),
    });
  }, [activeChat?.code, connected, messagesByRoom, socketEmit, updateMessageReaction]);

  const markMessageRead = useCallback((roomId, serverMsgId, readAt = Date.now()) => {
    if (!roomId || !serverMsgId) return;
    updateRoomMessages(roomId, (current) => current.map((item) => {
      if (item.serverMsgId !== serverMsgId && item.id !== serverMsgId) return item;
      return { ...item, read: true, readAt };
    }));
  }, [updateRoomMessages]);

  const emitWithAck = useCallback((eventName, payload, timeoutMs = 6000) => {
    if (!connected) {
      return Promise.reject(new Error(`Socket not connected for ${eventName}`));
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const timeoutId = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`Timed out waiting for ${eventName}`));
      }, timeoutMs);

      socketEmit(eventName, payload, (response) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        resolve(response);
      });
    });
  }, [connected, socketEmit]);

  const deliverMessagePayload = useCallback(async ({ activeRoom, payload, clientMsgId }) => {
    if (!activeRoom?.code) {
      throw new Error("Missing room context");
    }

    if (connected) {
      const ack = await emitWithAck("msg.send", payload);
      return ack || { ok: true };
    }

    return sendEncryptedMessage(activeRoom.code, payload, getAccessToken());
  }, [connected, emitWithAck]);

  useEffect(() => {
    ensureOwnKeyMaterial().catch((error) => {
      console.error("[E2EE] Failed to initialize key material", error);
    });
  }, []);

  useEffect(() => {
    joinedRoomSignatureRef.current = null;
    roomJoinInFlightRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    if (!connected || !activeChat?.code || !activeChat?.id) return undefined;

    joinActiveRoom(activeChat, 'auto-reconnect').catch((error) => {
      console.error('[SOCKET] Room rejoin failed', {
        roomCode: activeChat?.code,
        roomId: activeChat?.id,
        error,
      });
    });

    return undefined;
  }, [activeChat?.code, activeChat?.id, connected, joinActiveRoom]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const rooms = await fetchRooms();
        if (cancelled) return;

        rooms.forEach((room) => {
          registerRoom(
            {
              id: room.id,
              name: room.name,
              code: room.code,
              online: Boolean(room.online),
              unread: 0,
              last: room.last || "Tunnel available",
              time: room.time || "now",
              isGroup: room.kind === "group",
              createdAt: room.createdAt,
              expiresAt: room.expiresAt,
            },
            room.code,
            { expiryMinutes: Math.max(1, Math.round((Number(room.expiresAt) - Number(room.createdAt)) / 60000) || 10) }
          );
        });
      } catch (error) {
        console.warn("[ROOM] Failed to fetch backend rooms", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeChat?.code || !activeChat?.id) return undefined;
    hydrateRoomHistory(activeChat.code, activeChat.id);
    return undefined;
  }, [activeChat?.code, activeChat?.id]);

  useEffect(() => {
    setReplyTarget(null);
  }, [activeChat?.id]);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentSession()
      .then((payload) => {
        if (!cancelled) setSessionInfo(payload);
      })
      .catch(() => {
        if (!cancelled) setSessionInfo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [peerId, sessionId]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.drafts, JSON.stringify(draftsByRoom));
  }, [draftsByRoom]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.pendingMessages, JSON.stringify(queuedMessages));
  }, [queuedMessages]);

  useEffect(() => {
    if (!connected || queuedMessages.length === 0) return undefined;
    let cancelled = false;

    (async () => {
      for (const queued of [...queuedMessages]) {
        if (cancelled) return;
        try {
          const room = getRoomByCodeValue(queued?.roomCode) || { id: queued?.roomId, code: queued?.roomCode };
          const response = await deliverMessagePayload({ activeRoom: room, payload: queued.payload, clientMsgId: queued.clientMsgId });
          const deliveredMessageId = response?.messageId || response?.message?.msgId || response?.msgId || null;
          if (deliveredMessageId) {
            updateMessageById(room?.id || queued.roomId, queued.clientMsgId, {
              serverMsgId: deliveredMessageId,
            });
          }
          setQueuedMessages((prev) => prev.filter((item) => item.clientMsgId !== queued.clientMsgId));
        } catch (error) {
          console.warn("[QUEUE] Failed to flush queued message", error);
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, queuedMessages, deliverMessagePayload, getRoomByCodeValue, updateMessageById]);

  useEffect(() => {
    if (!document.getElementById("gc-fonts")) {
      const link = document.createElement("link");
      link.id = "gc-fonts";
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&family=Fira+Code:wght@300;400;500&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  // Socket.IO event listeners
  useEffect(() => {
    const unsubscribers = [];

    if (connected) {
      // Listen for room.joined
      unsubscribers.push(
        socketOn('room.joined', (payload) => {
          console.log('[SOCKET.RECEIVED] room.joined', payload);
          const { roomCode } = payload;
          const key = normalizePeerCode(roomCode);
          joinedRoomSignatureRef.current = `${sessionId || 'socket'}:${key}`;
          setRoomMembersForCode(roomCode, payload.members || []);
          // Update room online status and member count
          setRoomDirectory(prev => {
            const room = prev[key];
            if (room) {
              return { ...prev, [key]: { ...room, online: true, members: payload.members?.length || 1 } };
            }
            return prev;
          });
          if (Array.isArray(payload?.recentMessages) && payload.recentMessages.length > 0) {
            payload.recentMessages.forEach((messagePayload) => {
              upsertEncryptedMessage(messagePayload, roomCode, payload.roomId);
            });
          }
        })
      );

      // Listen for msg.new (incoming messages)
      unsubscribers.push(
        socketOn('msg.new', async (payload) => {
          console.log('[SOCKET.RECEIVED] msg.new', payload);
          if (payload?.fromPeerId === peerId) return;
          const inserted = await upsertEncryptedMessage(payload, payload?.roomCode, payload?.roomId);
          if (inserted && activeChat?.id && payload?.roomId === activeChat.id) {
            socketEmit('msg.read', {
              roomId: payload?.roomId,
              roomCode: payload?.roomCode,
              msgId: payload?.msgId || inserted.serverMsgId || inserted.id,
              readAt: Date.now(),
            });
          }
        })
      );

      unsubscribers.push(
        socketOn('msg.ack', (payload) => {
          console.log('[SOCKET.RECEIVED] msg.ack', payload);
          if (!payload?.clientMsgId) return;
          updateMessageById(payload?.roomId || activeChat?.id, payload.clientMsgId, {
            serverMsgId: payload?.msgId || payload?.messageId || null,
          });
        })
      );

      unsubscribers.push(
        socketOn('msg.read', (payload) => {
          console.log('[SOCKET.RECEIVED] msg.read', payload);
          markMessageRead(payload?.roomId || activeChat?.id, payload?.msgId, payload?.readAt || Date.now());
        })
      );

      unsubscribers.push(
        socketOn('msg.reaction', (payload) => {
          console.log('[SOCKET.RECEIVED] msg.reaction', payload);
          if (payload?.peerId === peerId) return;
          const roomId = payload?.roomId || activeChat?.id;
          if (!roomId || !payload?.msgId || !payload?.emoji) return;
          updateMessageReaction(roomId, payload.msgId, payload.emoji);
        })
      );

      unsubscribers.push(
        socketOn('error', (payload) => {
          console.error('[SOCKET.RECEIVED] error', payload);
        })
      );

      unsubscribers.push(
        socketOn('presence.update', (payload) => {
          console.log('[SOCKET.RECEIVED] presence.update', payload);
        })
      );

      // Listen for typing.update
      unsubscribers.push(
        socketOn('typing.update', (payload) => {
          console.log('[SOCKET.RECEIVED] typing.update', payload);
          if (payload?.peerId === peerId) return;
          const roomKey = payload?.roomId || normalizePeerCode(payload?.roomCode);
          if (!roomKey) return;
          setTypingByRoom((prev) => {
            if (payload?.isTyping) {
              return { ...prev, [roomKey]: true };
            }
            const next = { ...prev };
            delete next[roomKey];
            return next;
          });
        })
      );

      // Listen for room.member_joined
      unsubscribers.push(
        socketOn('room.member_joined', (payload) => {
          console.log('[SOCKET.RECEIVED] room.member_joined', payload);
          if (payload?.roomId && activeChat?.id !== payload.roomId) {
            const roomById = [...chats, ...groups].find((entry) => entry.id === payload.roomId);
            if (roomById?.code) {
              upsertRoomMember(roomById.code, payload);
            }
            return;
          }
          if (activeChat?.code) {
            upsertRoomMember(activeChat.code, payload);
          }
          // Update room members
        })
      );

      // Listen for room.member_left
      unsubscribers.push(
        socketOn('room.member_left', (payload) => {
          console.log('[SOCKET.RECEIVED] room.member_left', payload);
          if (payload?.roomId && activeChat?.id !== payload.roomId) {
            const roomById = [...chats, ...groups].find((entry) => entry.id === payload.roomId);
            if (roomById?.code) {
              removeRoomMember(roomById.code, payload.peerId);
            }
            return;
          }
          if (activeChat?.code) {
            removeRoomMember(activeChat.code, payload.peerId);
          }
          // Update room members
        })
      );

      unsubscribers.push(
        socketOn('room.expired', (payload) => {
          console.log('[SOCKET.RECEIVED] room.expired', payload);
          const roomKey = payload?.roomId || normalizePeerCode(payload?.roomCode);
          if (!roomKey) return;

          setTypingByRoom((prev) => {
            const next = { ...prev };
            delete next[roomKey];
            return next;
          });

          setRoomDirectory((prev) => {
            const next = { ...prev };
            Object.entries(next).forEach(([key, room]) => {
              if (room?.id === payload?.roomId || normalizePeerCode(room?.code) === normalizePeerCode(payload?.roomCode)) {
                next[key] = { ...room, online: false, expired: true };
              }
            });
            return next;
          });

          setChats((prev) => prev.map((room) => (room?.id === payload?.roomId ? { ...room, online: false, expired: true } : room)));
          setGroups((prev) => prev.map((room) => (room?.id === payload?.roomId ? { ...room, online: false, expired: true } : room)));

          if (activeChat?.id === payload?.roomId || normalizePeerCode(activeChat?.code) === normalizePeerCode(payload?.roomCode)) {
            setActiveChat(null);
          }
        })
      );
    }

    return () => {
      unsubscribers.forEach(unsub => unsub?.());
    };
  }, [connected, socketOn, peerId, activeChat?.id, activeChat?.code, chats, groups, roomDirectory, updateMessageById, updateMessageReaction, markMessageRead, socketEmit]);

  useEffect(() => {
    window.localStorage.setItem("gc.settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem("gc.profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    window.localStorage.setItem("gc.activity", JSON.stringify(activity));
  }, [activity]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.groups, JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.rooms, JSON.stringify(roomDirectory));
  }, [roomDirectory]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messagesByRoom));
  }, [messagesByRoom]);

  const registerRoom = (chatLike, rawCode, options = {}) => {
    const code = displayPeerCode(rawCode || chatLike?.code || "");
    const key = normalizePeerCode(code);
    if (!key) return chatLike;
    const now = Date.now();
    const existingByCode =
      roomDirectory[key] ||
      chats.find((item) => normalizePeerCode(item.code) === key) ||
      groups.find((item) => normalizePeerCode(item.code) === key);
    const ttlMinutes = Number(options?.expiryMinutes || chatLike?.ttlMinutes || 0);
    const expiresAt = ttlMinutes > 0 ? now + ttlMinutes * 60 * 1000 : chatLike?.expiresAt;
    const room = {
      ...chatLike,
      code,
      online: typeof chatLike?.online === "boolean" ? chatLike.online : true,
      id: existingByCode?.id || chatLike?.id || `room-${key}`,
      createdAt: existingByCode?.createdAt || chatLike?.createdAt || now,
      expiresAt,
    };
    setRoomDirectory((prev) => ({ ...prev, [key]: room }));

    if (room.isGroup) {
      setGroups((prev) => {
        const exists = prev.some((item) => item.id === room.id || normalizePeerCode(item.code) === key);
        if (exists) {
          return prev.map((item) => (item.id === room.id || normalizePeerCode(item.code) === key ? { ...item, ...room } : item));
        }
        return [room, ...prev];
      });
    } else {
      setChats((prev) => {
        const exists = prev.some((item) => item.id === room.id || normalizePeerCode(item.code) === key);
        if (exists) {
          return prev.map((item) => (item.id === room.id || normalizePeerCode(item.code) === key ? { ...item, ...room } : item));
        }
        return [room, ...prev];
      });
    }

    return room;
  };

  const goToAdjacentTab = useCallback((direction) => {
    const currentIndex = TAB_ORDER.indexOf(tab);
    if (currentIndex < 0) return;
    const nextIndex = Math.min(TAB_ORDER.length - 1, Math.max(0, currentIndex + direction));
    if (nextIndex !== currentIndex) {
      setTab(TAB_ORDER[nextIndex]);
    }
  }, [tab]);

  const handleTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      blocked: isInteractiveSwipeTarget(event.target),
    };
  };

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches?.[0];
    if (!start || !touch || start.blocked) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    const direction = getTabFromSwipeDirection(deltaX);
    if (direction) {
      goToAdjacentTab(direction);
    }
  };

  const sendMessage = async (roomId, text, autoShredSeconds = 0, attachment = null, replyTarget = null) => {
    if (!roomId || (!text?.trim() && !attachment)) return;
    const clientMsgId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const summaryText = text?.trim() || (attachment ? (isImageMimeType(attachment.mimeType) ? attachment.name || "Image" : attachment.name || "File") : "");
    const activeRoom = activeChat;
    if (!activeRoom?.code) {
      console.warn('[MSG] No active room code available for encryption');
      return;
    }

    const keyMaterial = await ensureOwnKeyMaterial();
    const roomKey = normalizePeerCode(activeRoom.code);
    const roomMembers = Object.values(roomMemberKeysRef.current[roomKey] || {});
    const recipients = roomMembers.filter((member) => member?.encryptionPublicKey);

    if (settings.endToEndEncryption && recipients.length === 0) {
      console.warn('[E2EE] Missing recipient public keys; cannot send encrypted message');
      return;
    }

    const envelope = {
      text: text?.trim() || "",
      attachment,
      replyTo: replyTarget
        ? {
            msgId: replyTarget.msgId || null,
            sender: replyTarget.sender || null,
            preview: replyTarget.preview || null,
          }
        : null,
      version: 1,
    };

    const encryptedBody = await encryptEnvelopeForRecipients({
      envelope,
      senderPrivateEncryptionKey: keyMaterial.encryptionKeyPair.privateKey,
      recipients,
    });

    const signedPayload = {
      clientMsgId,
      sentAt: Date.now(),
      bodyCiphertext: encryptedBody.bodyCiphertext,
      bodyIv: encryptedBody.bodyIv,
      bodyFormat: 'E2EE_V1',
      wrappedKeys: encryptedBody.wrappedKeys,
    };

    const signature = await signMessagePayload(keyMaterial.signingKeyPair.privateKey, signedPayload);

    const message = {
      id: clientMsgId,
      from: "me",
      text: text?.trim() || "",
      time: getNowHHMM(),
      read: false,
      serverMsgId: null,
      expiresAt: autoShredSeconds > 0 ? Date.now() + autoShredSeconds * 1000 : undefined,
      attachment,
      replyTo: envelope.replyTo,
      reactions: {},
    };

    // Add to local state immediately for UI responsiveness
    setMessagesByRoom((prev) => {
      const current = prev[roomId] || [];
      return {
        ...prev,
        [roomId]: appendMessageUnique(current, message),
      };
    });

    const lastText = summaryText || "Attachment sent";
    setChats((prev) => prev.map((item) => (item.id === roomId ? { ...item, last: lastText, time: "now" } : item)));
    setGroups((prev) => prev.map((item) => (item.id === roomId ? { ...item, last: lastText, time: "now" } : item)));

    const payload = {
      roomId: activeRoom.id,
      roomCode: activeRoom.code,
      clientMsgId,
      bodyCiphertext: encryptedBody.bodyCiphertext,
      bodyIv: encryptedBody.bodyIv,
      bodyFormat: 'E2EE_V1',
      wrappedKeys: encryptedBody.wrappedKeys,
      sentAt: signedPayload.sentAt,
      autoShredSeconds,
      attachment: null,
      signature,
      signingPublicKey: keyMaterial.signingPublicKey,
    };

    try {
      const response = await deliverMessagePayload({ activeRoom, payload, clientMsgId });
      const deliveredMessageId = response?.messageId || response?.message?.msgId || response?.msgId || null;

      if (deliveredMessageId) {
        updateMessageById(roomId, clientMsgId, {
          serverMsgId: deliveredMessageId,
        });
      }

      return response;
    } catch (error) {
      console.warn('[MSG] Delivery failed, queueing for retry', error);
      setQueuedMessages((prev) => {
        if (prev.some((item) => item.clientMsgId === clientMsgId)) return prev;
        return [
          ...prev,
          {
            roomId,
            roomCode: activeRoom.code,
            clientMsgId,
            payload,
          },
        ];
      });
    }
  };

  const pruneRoomMessages = (roomId) => {
    if (!roomId) return;
    const now = Date.now();
    setMessagesByRoom((prev) => {
      const current = prev[roomId] || [];
      const next = current.filter((item) => !item.expiresAt || item.expiresAt > now);
      if (next.length === current.length) return prev;
      return { ...prev, [roomId]: next };
    });
  };

  const openRoom = (chatLike) => {
    if (!chatLike) return { ok: false, error: "Tunnel not found" };
    const room = chatLike.code ? registerRoom(chatLike, chatLike.code) : chatLike;
    if (room?.expiresAt && room.expiresAt <= Date.now()) {
      return { ok: false, error: "Tunnel expired. Generate a new code." };
    }
    setActiveChat(room);
    setTab("chats");

    joinActiveRoom(room, 'open-room').catch((error) => {
      console.error('[SOCKET] Room join failed', {
        roomCode: room?.code,
        roomId: room?.id,
        error,
      });
    });

    return { ok: true };
  };

  const createGroupRoom = (groupLike) => {
    return new Promise((resolve, reject) => {
      if (!connected) {
        createRoomApi(
          {
            kind: 'group',
            ttlMinutes: groupLike?.expiryMinutes || 60,
            name: groupLike?.name || 'Ghost Group',
          },
          getAccessToken()
        )
          .then((room) => {
            if (!room?.code) {
              throw new Error('Failed to generate room code');
            }

            const createdRoom = registerRoom(
              {
                ...groupLike,
                ...room,
                isGroup: true,
                last: groupLike?.last || 'Group tunnel created',
              },
              room.code,
              { expiryMinutes: groupLike?.expiryMinutes || 60 }
            );

            resolve(createdRoom);
          })
          .catch(reject);
        return;
      }

      socketEmit(
        'room:generate',
        {
          kind: 'group',
          ttlMinutes: groupLike?.expiryMinutes || 60,
          name: groupLike?.name || 'Ghost Group',
        },
        (response) => {
          if (!response?.ok || !response?.room?.code) {
            reject(new Error(response?.error || 'Failed to generate room code'));
            return;
          }

          const createdRoom = registerRoom(
            {
              ...groupLike,
              ...response.room,
              isGroup: true,
              last: groupLike?.last || 'Group tunnel created',
            },
            response.room.code,
            { expiryMinutes: groupLike?.expiryMinutes || 60 }
          );

          resolve(createdRoom);
        }
      );
    });
  };

  const stats = {
    messages: activity.messages,
    tunnels: chats.length,
    groups: groups.length,
  };

  let content;
  if (activeChat) {
    content = (
      <ChatRoom
        chat={activeChat}
        onBack={() => setActiveChat(null)}
        settings={settings}
        messages={messagesByRoom[activeChat.id] || []}
        onSendMessage={sendMessage}
        onPruneMessages={pruneRoomMessages}
        onMessageSent={() => setActivity((prev) => ({ ...prev, messages: prev.messages + 1 }))}
        draft={draftsByRoom[activeChat.id] || ""}
        onDraftChange={(roomId, nextDraft) => {
          if (!roomId) return;
          setDraftsByRoom((prev) => {
            if (!nextDraft) {
              const { [roomId]: _removed, ...rest } = prev;
              return rest;
            }
            return { ...prev, [roomId]: nextDraft };
          });
        }}
        onReactMessage={reactToMessage}
        replyTarget={replyTarget}
        onReplyTargetChange={setReplyTarget}
        remoteTyping={Boolean(typingByRoom[activeChat.id])}
        onTypingChange={(roomId, isTyping) => {
          if (!connected || !activeChat?.code) return;
          socketEmit('typing.set', {
            roomId,
            roomCode: activeChat.code,
            isTyping,
          });
        }}
      />
    );
  } else if (tab === "chats") {
    content = <ChatsScreen chats={chats} groups={groups} onOpen={openRoom} onRegisterRoom={registerRoom} />;
  } else if (tab === "search") {
    content = <SearchScreen roomDirectory={roomDirectory} onJoinRoom={openRoom} />;
  } else if (tab === "codegen") {
    content =
      <CodeGenScreen
        onGenerateRoom={async (expiry) => {
          const response = await generatePeerCodeRequest(expiry, profile);
          fetchCurrentSession()
            .then((payload) => setSessionInfo(payload))
            .catch(() => setSessionInfo(null));
          setProfile((prev) => ({
            ...prev,
            peerCode: displayPeerCode(response.code || prev?.peerCode || ""),
          }));
          const createdRoom = registerRoom(
            {
              id: `peer-${response.code}`,
              name: '🧠 Ghost Link',
              unread: 0,
              time: 'now',
              last: `Secure key active ${expiry}m`,
              online: true,
              code: response.code,
              createdAt: Date.now(),
              expiresAt: response.expires_at ? Date.parse(response.expires_at) : Date.now() + expiry * 60 * 1000,
            },
            response.code,
            { expiryMinutes: expiry }
          );

          return createdRoom?.code || response.code;
        }}
      />;
  } else if (tab === "groups") {
    content = <GroupsScreen groups={groups} onCreateGroupRoom={createGroupRoom} onOpenGroupRoom={openRoom} />;
  } else {
    content =
      <ProfileScreen
        settings={settings}
        onUpdateSettings={(key) => setSettings((prev) => ({ ...prev, [key]: !prev[key] }))}
        profile={profile}
        onProfileSave={(partial) => setProfile((prev) => ({ ...prev, ...partial }))}
        stats={stats}
        sessionInfo={sessionInfo}
        ownKeyMaterial={ownKeyMaterialSnapshot}
        sessionId={sessionId}
        peerId={peerId}
      />;
  }

  return (
    <div
      style={{
        width: "100vw",
        minHeight: "100dvh",
        background: "#050810",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        touchAction: "pan-y",
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => {
        touchStartRef.current = null;
      }}
    >
      <style>
        {`html, body, #root { width: 100%; min-height: 100%; margin: 0; padding: 0; overflow-x: hidden; }
* { box-sizing: border-box; margin: 0; padding: 0; }
::-webkit-scrollbar { width: 0; }
input::placeholder { color: #4B5563; }
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}`}
      </style>

      <div
        style={{
          width: "100%",
          minHeight: "100dvh",
          background: COLORS.bg,
          borderRadius: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: `0 0 60px ${COLORS.accent}20, 0 0 100px rgba(0,255,178,0.07), 0 40px 80px rgba(0,0,0,0.9)`,
          border: `1px solid ${COLORS.border}`,
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>{content}</div>

        {!activeChat && <NavBar tab={tab} onTab={setTab} />}
      </div>
    </div>
  );
}
