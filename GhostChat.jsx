import React, { useEffect, useRef, useState } from "react";
import { useSocket } from "./src/hooks/useSocket";
import { Avatar, NavBar, LockIcon, ShieldIcon } from "./src/components/UI.jsx";
import { ChatsScreen } from "./src/components/ChatsScreen.jsx";
import { ChatRoom } from "./src/components/ChatRoom.jsx";

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

const CHATS = [];

const GROUPS = [];

const MESSAGES = [];

const SEARCH_RESULTS = [];

const DEFAULT_SETTINGS = {
  endToEndEncryption: true,
  websocketTunnels: true,
  messageShredding: true,
  stealthMode: false,
  androidOptimization: true,
};

const DEFAULT_PROFILE = {
  username: "Ghost",
  emoji: "🦅",
  peerCode: generatePeerCode(),
};

const DEFAULT_ACTIVITY = {
  messages: 0,
};

const STORAGE_KEYS = {
  chats: "gc.chats",
  groups: "gc.groups",
  rooms: "gc.rooms",
  messages: "gc.messages",
};

function addAlpha(hex, alphaHex) {
  return `${hex}${alphaHex}`;
}

const EMOJI_REGEX = createSafeRegex("\\p{Emoji}", "u", /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
const LEADING_EMOJI_REGEX = createSafeRegex("^\\p{Emoji}\\s*", "u", /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u);

function createSafeRegex(pattern, flags, fallback) {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return fallback;
  }
}

function getEmoji(name = "") {
  const match = name.match(EMOJI_REGEX);
  return match ? match[0] : "👤";
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
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function displayPeerCode(value = "") {
  const normalized = normalizePeerCode(value);
  if (!normalized) return "";
  if (normalized.length <= 2) return normalized;
  return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
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

function ChatRoom({ chat, onBack, settings, messages, onSendMessage, onPruneMessages, onMessageSent }) {
  const [msg, setMsg] = useState("");
  const [typing, setTyping] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const endRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setMsg("");
    setTyping(false);
    setPendingAttachment(null);
    setAttachmentError("");
  }, [chat?.id]);

  const shreddingEnabled = settings?.messageShredding ?? true;
  const tunnelEnabled = settings?.websocketTunnels ?? true;
  const encryptionEnabled = settings?.endToEndEncryption ?? true;
  const androidOptimized = settings?.androidOptimization ?? true;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: androidOptimized ? "auto" : "smooth" });
  }, [messages, typing, androidOptimized]);

  useEffect(() => {
    if (!shreddingEnabled) return undefined;
    const shredTimer = window.setInterval(() => {
      onPruneMessages?.(chat?.id);
    }, 5000);
    return () => window.clearInterval(shredTimer);
  }, [chat?.id, onPruneMessages, shreddingEnabled]);

  const pickAttachment = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const maxBytes = 6 * 1024 * 1024;
    if (file.size > maxBytes) {
      setAttachmentError(`File is too large. Max size is ${formatFileSize(maxBytes)}.`);
      setPendingAttachment(null);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPendingAttachment({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
      });
      setAttachmentError("");
    } catch {
      setAttachmentError("Unable to attach this file right now.");
    }
  };

  const send = () => {
    if (!tunnelEnabled) return;
    const text = msg.trim();
    if (!text && !pendingAttachment) return;

    onSendMessage?.(
      chat?.id,
      text,
      shreddingEnabled ? 45 : 0,
      pendingAttachment
    );
    if (onMessageSent) onMessageSent();
    setMsg("");
    setPendingAttachment(null);
    setAttachmentError("");
  };

  const attachmentLabel = pendingAttachment
    ? isImageMimeType(pendingAttachment.mimeType)
      ? "Image ready to send"
      : "File ready to send"
    : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 16px",
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
        }}
      >
        <button type="button" onClick={onBack} style={{ color: COLORS.accent, fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>
          ←
        </button>
        <Avatar name={chat.name} size={36} online={chat.online} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{chat.name}</div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: chat.online ? COLORS.accent : COLORS.textMuted }}>
            {chat.online ? "online" : "offline"}
            {chat.code ? ` • ${chat.code}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: COLORS.accentDim, borderRadius: 12, padding: "4px 8px" }}>
          <LockIcon size={11} />
          <span style={{ fontFamily: FONT, fontSize: 9, color: encryptionEnabled ? COLORS.accent : COLORS.textMuted }}>{encryptionEnabled ? "E2E" : "PLAIN"}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 0, display: "flex", flexDirection: "column", gap: 0 }}>
        <div style={{ alignSelf: "center", marginTop: 10, marginBottom: 8, fontFamily: FONT, fontSize: 10, color: COLORS.textMuted, background: COLORS.card, borderRadius: 8, padding: "3px 10px" }}>
          {tunnelEnabled ? `${encryptionEnabled ? "🔒" : "⚠️"} ${encryptionEnabled ? "Secure" : "Unencrypted"} tunnel established` : "🌐 Tunnel disabled in settings"}
        </div>

        {messages.map((m) => (
          <div key={m.id} style={{ display: "flex", justifyContent: m.from === "me" ? "flex-end" : "flex-start", padding: "0 10px" }}>
            <div style={{ maxWidth: "72%", background: "transparent", border: "none", padding: "4px 8px" }}>
              {m.text ? <div style={{ fontFamily: SANS, fontSize: 13, color: m.from === "me" ? "#39FF14" : "#00BFFF", lineHeight: 1.4 }}>{m.text}</div> : null}
              {m.attachment ? (
                <div
                  style={{
                    marginTop: m.text ? 8 : 0,
                    borderRadius: 14,
                    overflow: "hidden",
                    border: `1px solid ${m.from === "me" ? addAlpha(COLORS.accent, "35") : COLORS.border}`,
                    background: m.from === "me" ? COLORS.bubbleSelf : COLORS.bubble,
                  }}
                >
                  {isImageMimeType(m.attachment.mimeType) ? (
                    <img
                      src={m.attachment.dataUrl}
                      alt={m.attachment.name}
                      style={{ display: "block", width: "100%", maxHeight: 280, objectFit: "cover" }}
                    />
                  ) : null}
                  <div style={{ padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontSize: 20 }}>{isImageMimeType(m.attachment.mimeType) ? "🖼️" : "📎"}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: SANS, fontSize: 12, color: COLORS.text, wordBreak: "break-word" }}>{m.attachment.name}</div>
                      <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.textMuted }}>{formatFileSize(m.attachment.size)}</div>
                    </div>
                    <a
                      href={m.attachment.dataUrl}
                      download={m.attachment.name}
                      style={{ marginLeft: "auto", fontFamily: FONT, fontSize: 10, color: COLORS.accent, textDecoration: "none" }}
                    >
                      SAVE
                    </a>
                  </div>
                </div>
              ) : null}
              <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.textMuted, textAlign: "right", marginTop: 2 }}>
                {m.time}
                {m.from === "me" ? ` ${m.read ? "✓✓" : "✓"}` : ""}
              </div>
            </div>
          </div>
        ))}

        {typing && (
          <div style={{ display: "flex", justifyContent: "flex-start", padding: "0 10px" }}>
            <div style={{ background: "transparent", border: "none", padding: "4px 8px", display: "flex", gap: 4 }}>
              {[0, 1, 2].map((d) => (
                <span
                  key={`dot-${d}`}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: COLORS.accent,
                    animation: "bounce 0.8s infinite",
                    animationDelay: `${d * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      <div
        style={{
          padding: "8px 12px 12px",
          borderTop: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.textMuted,
            cursor: "pointer",
          }}
        >
          📎
        </button>
        <input ref={fileInputRef} type="file" accept="image/*,application/pdf,.txt,.md,.csv,.zip,.mp3,.mp4,.mov,.webm,.doc,.docx" onChange={pickAttachment} style={{ display: "none" }} />
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder={tunnelEnabled ? "Type securely..." : "Enable WebSocket tunnels in Profile settings"}
          disabled={!tunnelEnabled}
          style={{
            flex: 1,
            background: COLORS.card,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            padding: "9px 14px",
            fontFamily: SANS,
            fontSize: 13,
            color: COLORS.text,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!tunnelEnabled || (!msg.trim() && !pendingAttachment)}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: msg.trim() || pendingAttachment ? COLORS.accent : COLORS.card,
            color: msg.trim() || pendingAttachment ? COLORS.bg : COLORS.textMuted,
          }}
        >
          ➤
        </button>
      </div>
      {(pendingAttachment || attachmentError) && (
        <div style={{ padding: "0 12px 12px", background: COLORS.surface }}>
          {attachmentError ? (
            <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.red }}>{attachmentError}</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.card, padding: "8px 10px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 12, color: COLORS.text }}>{attachmentLabel}</div>
                <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.textMuted, wordBreak: "break-word" }}>{pendingAttachment.name} • {formatFileSize(pendingAttachment.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => setPendingAttachment(null)}
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 999,
                  background: COLORS.surface,
                  color: COLORS.textMuted,
                  fontFamily: FONT,
                  fontSize: 10,
                  padding: "5px 8px",
                  cursor: "pointer",
                }}
              >
                REMOVE
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchScreen({ roomDirectory, onJoinRoom }) {
  const [code, setCode] = useState("");
  const [results, setResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState("");
  const normalizedCode = normalizePeerCode(code);
  const canSearch = normalizedCode.length === 6;

  const search = () => {
    setScanning(true);
    setResults([]);
    setStatus("");
    window.setTimeout(() => {
      if (!normalizedCode) {
        setStatus("Peer code is required");
        setScanning(false);
        return;
      }

      if (roomDirectory[normalizedCode]) {
        const result = onJoinRoom(roomDirectory[normalizedCode]);
        setStatus(result?.ok ? "Joining secure tunnel..." : result?.error || "Unable to join tunnel");
        setScanning(false);
        return;
      }

      const pool = [
        ...SEARCH_RESULTS.map((item) => ({
          ...item,
          chat: { id: item.id, name: item.name, online: true, unread: 0, time: "now", last: "Tunnel available", code: item.code },
        })),
        ...Object.values(roomDirectory).map((room) => ({
          id: `room-${room.id}`,
          name: room.name,
          code: room.code,
          mutual: room.isGroup ? room.members || 0 : 0,
          chat: room,
        })),
      ];

      const filtered = pool.filter((item) => normalizePeerCode(item.code) === normalizedCode);
      if (filtered.length === 0) {
        setStatus("No active tunnel found for that code");
      } else {
        setStatus("Tunnel found — tap CONNECT to join");
      }

      const seen = new Set();
      const deduped = filtered.filter((item) => {
        const normalized = normalizePeerCode(item.code);
        const dedupeKey = normalized || item.id;
        if (seen.has(dedupeKey)) return false;
        seen.add(dedupeKey);
        return true;
      });
      setResults(deduped);
      setScanning(false);
    }, 1200);
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: COLORS.text }}>
        JOIN VIA <span style={{ color: COLORS.accent }}>PEER CODE</span>
      </div>
      <div style={{ marginTop: 4, fontFamily: SANS, fontSize: 11, color: COLORS.textMuted }}>Enter full peer code to connect (username lookup is disabled)</div>

      {status && <div style={{ marginTop: 6, fontFamily: FONT, fontSize: 10, color: COLORS.accent }}>{status}</div>}

      <div style={{ marginTop: 14, background: COLORS.card, borderRadius: 14, padding: "12px 14px", border: `1px solid ${addAlpha(COLORS.accent, "30")}` }}>
        <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.accent, letterSpacing: 1, marginBottom: 6 }}>PEER CODE</div>
        <input
          value={code}
          onChange={(e) => setCode(displayPeerCode(e.target.value))}
          placeholder="XX-0000"
          style={{
            width: "100%",
            background: COLORS.surface,
            border: `1px solid ${addAlpha(COLORS.accent, "30")}`,
            borderRadius: 10,
            padding: "9px 12px",
            color: COLORS.accent,
            fontFamily: FONT,
            fontSize: 13,
            letterSpacing: 2,
            textTransform: "uppercase",
            outline: "none",
          }}
        />
      </div>

      <button
        type="button"
        onClick={search}
        disabled={!canSearch || scanning}
        style={{
          width: "100%",
          marginTop: 12,
          border: "none",
          cursor: "pointer",
          background: canSearch && !scanning ? `linear-gradient(135deg, ${COLORS.accent}, #00D4FF)` : COLORS.card,
          color: canSearch && !scanning ? COLORS.bg : COLORS.textMuted,
          fontFamily: FONT,
          fontSize: 13,
          borderRadius: 12,
          padding: "12px 13px",
        }}
      >
        🔍 SEARCH
      </button>

      {scanning && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {[0, 1, 2].map((index) => (
            <div
              key={`scan-${index}`}
              style={{
                height: 10,
                borderRadius: 999,
                background: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                animation: "bounce 0.9s infinite",
                animationDelay: `${index * 0.2}s`,
              }}
            />
          ))}
        </div>
      )}

      {!scanning && results.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {results.map((r) => (
            <div key={r.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={r.name} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{r.name}</div>
                <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.accent }}>{r.code}</div>
                {r.mutual > 0 && <div style={{ fontFamily: SANS, fontSize: 11, color: COLORS.textMuted }}>{r.mutual} mutual tunnel{r.mutual > 1 ? "s" : ""}</div>}
              </div>
              <button
                type="button"
                onClick={() => onJoinRoom(r.chat)}
                style={{
                  background: COLORS.accentDim,
                  border: `1px solid ${addAlpha(COLORS.accent, "50")}`,
                  fontFamily: FONT,
                  fontSize: 10,
                  color: COLORS.accent,
                  borderRadius: 10,
                  padding: "7px 10px",
                  cursor: "pointer",
                }}
              >
                CONNECT
              </button>
            </div>
          ))}
        </div>
      )}

      {!scanning && results.length === 0 && code.trim() && !status && (
        <div style={{ marginTop: 14, fontFamily: SANS, fontSize: 12, color: COLORS.textMuted }}>
          No matching rooms found.
        </div>
      )}
    </div>
  );
}

function CodeGenScreen({ onGenerateRoom }) {
  const [code, setCode] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copyState, setCopyState] = useState("idle");
  const [expiry, setExpiry] = useState(10);

  const generateCode = async () => {
    if (generating) return;
    setGenerating(true);
    setCopyState("idle");

    try {
      const nextCode = await onGenerateRoom(expiry);
      setCode(nextCode || null);
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    let copied = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        copied = true;
      }
    } catch {
      copied = false;
    }

    if (!copied) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        textArea.style.pointerEvents = "none";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch {
        copied = false;
      }
    }

    setCopyState(copied ? "success" : "error");
    window.setTimeout(() => setCopyState("idle"), 2000);
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: COLORS.text }}>
        SECURE <span style={{ color: COLORS.accent }}>KEY</span>
      </div>
      <div style={{ marginTop: 4, fontFamily: SANS, fontSize: 11, color: COLORS.textMuted }}>Generate a one-time peer code to open a private tunnel</div>

      <div
        style={{
          marginTop: 14,
          background: `linear-gradient(135deg, ${COLORS.card}, #0A1428)`,
          borderRadius: 20,
          padding: "24px 20px",
          border: `1px solid ${addAlpha(COLORS.accent, "30")}`,
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: COLORS.accentGlow,
            filter: "blur(20px)",
          }}
        />
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
          <ShieldIcon size={40} color={COLORS.accent} />
        </div>

        {code && !generating && (
          <>
            <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 700, color: COLORS.accent, letterSpacing: 6, textShadow: `0 0 20px ${addAlpha(COLORS.accent, "60")}` }}>{code}</div>
            <div style={{ marginTop: 8, fontFamily: SANS, fontSize: 11, color: COLORS.textMuted }}>Expires in {expiry} minutes or after single use</div>
          </>
        )}

        {generating && <div style={{ fontFamily: FONT, fontSize: 14, color: COLORS.accent }}>● GENERATING...</div>}

        {!code && !generating && <div style={{ fontFamily: FONT, fontSize: 24, color: COLORS.textMuted }}>_ _ - _ _ _ _</div>}
      </div>

      <div style={{ marginTop: 12, background: COLORS.card, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: "12px 14px" }}>
        <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.textMuted, marginBottom: 8 }}>EXPIRY DURATION</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[5, 10, 30, 60].map((min) => {
            const selected = expiry === min;
            return (
              <button
                key={min}
                type="button"
                onClick={() => setExpiry(min)}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  border: `1px solid ${selected ? COLORS.accent : COLORS.border}`,
                  background: selected ? COLORS.accentDim : COLORS.surface,
                  color: selected ? COLORS.accent : COLORS.textMuted,
                  fontFamily: FONT,
                  fontSize: 11,
                  padding: "8px 0",
                  cursor: "pointer",
                }}
              >
                {min}m
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={generateCode}
        style={{
          width: "100%",
          marginTop: 12,
          padding: 13,
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1,
          background: generating ? COLORS.card : `linear-gradient(135deg, ${COLORS.accent}, #00D4FF)`,
          color: generating ? COLORS.accent : COLORS.bg,
        }}
      >
        {generating ? "⟳ GENERATING..." : "⚡ GENERATE NEW CODE"}
      </button>

      <button
        type="button"
        onClick={copyCode}
        disabled={!code}
        style={{
          width: "100%",
          marginTop: 8,
          padding: 12,
          borderRadius: 12,
          cursor: code ? "pointer" : "not-allowed",
          fontFamily: FONT,
          fontSize: 12,
          border: `1px solid ${copyState === "success" ? COLORS.accent : copyState === "error" ? COLORS.red : COLORS.border}`,
          background: copyState === "success" ? COLORS.accentDim : COLORS.card,
          color: copyState === "success" ? COLORS.accent : copyState === "error" ? COLORS.red : COLORS.textMuted,
          opacity: code ? 1 : 0.65,
        }}
      >
        {copyState === "success" ? "✓ COPIED!" : copyState === "error" ? "✕ COPY FAILED" : "📋 COPY CODE"}
      </button>

      <div style={{ marginTop: 18, background: COLORS.card, borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: 12 }}>
        <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.accent, marginBottom: 8 }}>HOW IT WORKS</div>
        {[
          "Generate a unique peer code here",
          "Share it securely with your contact",
          "They enter it to open a private tunnel",
          "Code expires & is destroyed after use",
        ].map((step, i) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i === 3 ? 0 : 8 }}>
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: COLORS.accentDim,
                color: COLORS.accent,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT,
                fontSize: 10,
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontFamily: SANS, fontSize: 12, color: COLORS.textMuted }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupsScreen({ groups, onCreateGroupRoom, onOpenGroupRoom }) {
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [createError, setCreateError] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🛸");
  const [latestGroupCode, setLatestGroupCode] = useState("");
  const [copyState, setCopyState] = useState({});

  const options = ["🛸", "🌊", "🔥", "⚡", "🌙", "🦋", "🐺", "🦊", "🐉", "🎭", "💀", "🌌"];

  const copyInviteCode = async (code, key) => {
    const copied = await copyTextToClipboard(code);
    setCopyState((prev) => ({ ...prev, [key]: copied ? "success" : "error" }));
    window.setTimeout(() => setCopyState((prev) => ({ ...prev, [key]: "idle" })), 1600);
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: COLORS.text }}>
            SECURE <span style={{ color: COLORS.purple }}>GROUPS</span>
          </div>
          <div style={{ marginTop: 4, fontFamily: SANS, fontSize: 11, color: COLORS.textMuted }}>Encrypted group tunnels</div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          style={{
            background: COLORS.purpleDim,
            border: `1px solid ${addAlpha(COLORS.purple, "40")}`,
            color: COLORS.purple,
            fontFamily: FONT,
            fontSize: 10,
            borderRadius: 20,
            padding: "6px 12px",
            cursor: "pointer",
          }}
        >
          + CREATE
        </button>
      </div>

      {showCreate && (
        <div style={{ background: COLORS.card, borderRadius: 16, border: `1px solid ${addAlpha(COLORS.purple, "30")}`, padding: 16, marginTop: 12, marginBottom: 14 }}>
          <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.purple, letterSpacing: 1, marginBottom: 8 }}>NEW GROUP</div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1, marginBottom: 8 }}>PICK AVATAR</div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {options.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedEmoji(emoji)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  fontSize: 20,
                  cursor: "pointer",
                  border: `1.5px solid ${selectedEmoji === emoji ? COLORS.purple : COLORS.border}`,
                  background: selectedEmoji === emoji ? COLORS.purpleDim : COLORS.card,
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          <input
            value={groupName}
            onChange={(e) => {
              setGroupName(e.target.value);
              if (createError) setCreateError("");
            }}
            placeholder={`${selectedEmoji} Group name...`}
            style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "9px 12px", color: COLORS.text, fontFamily: SANS, fontSize: 13, outline: "none", marginBottom: 10 }}
          />

          {createError ? (
            <div style={{ marginBottom: 10, fontFamily: SANS, fontSize: 12, color: COLORS.red }}>{createError}</div>
          ) : null}

          <button
            type="button"
            onClick={() => {
                const rawName = groupName.trim() || "Ghost Group";
                const normalizedTargetName = stripLeadingEmoji(rawName).toLowerCase();
                const existingGroup = groups.find(
                  (item) => stripLeadingEmoji(item?.name || "").toLowerCase() === normalizedTargetName
                );

                if (existingGroup) {
                  setCreateError("A group with this name already exists.");
                  setLatestGroupCode(existingGroup.code || "");
                  return;
                }

                onCreateGroupRoom({
                  name: `${selectedEmoji} ${rawName}`,
                  emoji: selectedEmoji,
                  expiryMinutes: 60,
                  members: 1,
                  online: true,
                  isGroup: true,
                  unread: 0,
                  last: "Group tunnel created",
                  time: "now",
                })
                  .then((createdRoom) => {
                    setLatestGroupCode(createdRoom?.code || "");
                    setCreateError("");
                    setShowCreate(false);
                    setGroupName("");
                  })
                  .catch((error) => {
                    console.error("[ROOM] Failed to create group room", error);
                  });
              }}
            style={{
              width: "100%",
              border: "none",
              cursor: "pointer",
              background: `linear-gradient(135deg, ${COLORS.purple}, #7C3AED)`,
              color: "#fff",
              fontFamily: FONT,
              fontSize: 12,
              borderRadius: 10,
              padding: 10,
            }}
          >
            CREATE SECURE GROUP
          </button>
        </div>
      )}

      {latestGroupCode && (
        <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontFamily: FONT, fontSize: 10, color: COLORS.purple, background: COLORS.card, border: `1px solid ${addAlpha(COLORS.purple, "30")}`, borderRadius: 12, padding: "8px 10px" }}>
          <span>Invite code: {latestGroupCode}</span>
          <button
            type="button"
            onClick={() => copyInviteCode(latestGroupCode, latestGroupCode)}
            style={{
              border: `1px solid ${addAlpha(COLORS.purple, "40")}`,
              borderRadius: 999,
              background: copyState[latestGroupCode] === "success" ? COLORS.purpleDim : COLORS.surface,
              color: copyState[latestGroupCode] === "success" ? COLORS.purple : COLORS.textMuted,
              fontFamily: FONT,
              fontSize: 9,
              padding: "5px 8px",
              cursor: "pointer",
            }}
          >
            {copyState[latestGroupCode] === "success" ? "COPIED" : "COPY"}
          </button>
        </div>
      )}

      {groups.map((group) => (
        <div
          key={group.id}
          role="button"
          tabIndex={0}
          onClick={() => onOpenGroupRoom(group)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onOpenGroupRoom(group);
          }}
          style={{ background: COLORS.card, borderRadius: 16, border: `1px solid ${COLORS.border}`, padding: 14, marginBottom: 8, cursor: "pointer" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                background: COLORS.purpleDim,
                border: `1.5px solid ${addAlpha(COLORS.purple, "40")}`,
                fontSize: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {getEmoji(group.name)}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{group.name}</div>
              <div style={{ fontFamily: SANS, fontSize: 11, color: COLORS.textMuted }}>{group.members} members • encrypted</div>
              <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.purple }}>{group.code}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyInviteCode(group.code, group.id);
                  }}
                  style={{
                    border: `1px solid ${addAlpha(COLORS.purple, "35")}`,
                    borderRadius: 999,
                    background: copyState[group.id] === "success" ? COLORS.purpleDim : COLORS.surface,
                    color: copyState[group.id] === "success" ? COLORS.purple : COLORS.textMuted,
                    fontFamily: FONT,
                    fontSize: 9,
                    padding: "4px 7px",
                    cursor: "pointer",
                  }}
                >
                  {copyState[group.id] === "success" ? "INVITE COPIED" : "COPY INVITE"}
                </button>
              </div>
            </div>

            {group.unread > 0 && (
              <span style={{ background: COLORS.purple, color: "#fff", borderRadius: 10, padding: "2px 7px", fontFamily: FONT, fontSize: 10 }}>{group.unread}</span>
            )}
          </div>

          <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 10, paddingTop: 8, fontFamily: SANS, fontSize: 12, color: COLORS.textMuted }}>{group.last}</div>
        </div>
      ))}
    </div>
  );
}

function ProfileScreen({ settings, onUpdateSettings, profile, onProfileSave, stats }) {
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(profile?.emoji || "🦅");

  const options = ["🦅", "🦊", "🐺", "🌙", "🔥", "⚡", "🎭", "🐉", "🦋", "🛸", "💀", "🌊"];

  const save = () => {
    onProfileSave({
      username: tempName.trim() || "Ghost",
      emoji: selectedEmoji,
    });
    setEditing(false);
  };

  useEffect(() => {
    if (!editing) {
      setSelectedEmoji(profile?.emoji || "🦅");
      setTempName(profile?.username || "Ghost");
    }
  }, [editing, profile?.emoji, profile?.username]);

  const displayName = `${profile?.emoji || "🦅"} ${profile?.username || "Ghost"}`;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: COLORS.text }}>
        MY <span style={{ color: COLORS.accent }}>PROFILE</span>
      </div>

      <div
        style={{
          marginTop: 14,
          background: `linear-gradient(135deg, ${COLORS.card}, #0A1428)`,
          borderRadius: 20,
          padding: "24px 20px",
          border: `1px solid ${COLORS.border}`,
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -30,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: COLORS.accentGlow,
            filter: "blur(30px)",
          }}
        />

        <div
          style={{
            width: 80,
            height: 80,
            margin: "0 auto",
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.accentDim}, ${COLORS.purpleDim})`,
            border: `2px solid ${addAlpha(COLORS.accent, "50")}`,
            fontSize: 38,
            boxShadow: `0 0 20px ${addAlpha(COLORS.accent, "30")}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {getEmoji(displayName)}
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: COLORS.accent,
              position: "absolute",
              bottom: 6,
              right: "calc(50% - 50px)",
              color: COLORS.bg,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✎
          </span>
        </div>

        <div style={{ marginTop: 10, fontFamily: SANS, fontSize: 18, fontWeight: 700, color: COLORS.text }}>{displayName}</div>
        <div style={{ marginTop: 4, fontFamily: FONT, fontSize: 11, color: COLORS.textMuted }}>
          <span style={{ color: COLORS.accent }}>{profile?.peerCode || "--"}</span> • peer code
        </div>

        <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: 14, paddingTop: 12, display: "flex", justifyContent: "space-around" }}>
          {[
            [String(stats?.messages ?? 0), "Messages"],
            [String(stats?.tunnels ?? 0), "Tunnels"],
            [String(stats?.groups ?? 0), "Groups"],
          ].map(([value, label]) => (
            <div key={label}>
              <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: COLORS.accent }}>{value}</div>
              <div style={{ fontFamily: SANS, fontSize: 10, color: COLORS.textMuted }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {editing ? (
        <div style={{ marginTop: 12, background: COLORS.card, borderRadius: 16, border: `1px solid ${addAlpha(COLORS.accent, "30")}`, padding: 16 }}>
          <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.accent, marginBottom: 8 }}>EDIT PROFILE</div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {options.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setSelectedEmoji(emoji)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  fontSize: 20,
                  cursor: "pointer",
                  border: `1.5px solid ${selectedEmoji === emoji ? COLORS.accent : COLORS.border}`,
                  background: selectedEmoji === emoji ? COLORS.accentDim : COLORS.card,
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          <input
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            style={{ width: "100%", background: COLORS.surface, border: `1px solid ${addAlpha(COLORS.accent, "40")}`, borderRadius: 10, padding: "9px 12px", color: COLORS.text, fontFamily: SANS, fontSize: 14, outline: "none", marginBottom: 10 }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{
                flex: 1,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                background: COLORS.surface,
                color: COLORS.textMuted,
                fontFamily: FONT,
                fontSize: 11,
                cursor: "pointer",
                padding: 10,
              }}
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={save}
              style={{
                flex: 2,
                border: "none",
                borderRadius: 10,
                background: `linear-gradient(135deg, ${COLORS.accent}, #00D4FF)`,
                color: COLORS.bg,
                fontFamily: FONT,
                fontSize: 11,
                cursor: "pointer",
                padding: 10,
              }}
            >
              SAVE CHANGES
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setEditing(true);
            setTempName(profile?.username || "Ghost");
            setSelectedEmoji(profile?.emoji || "🦅");
          }}
          style={{
            marginTop: 12,
            width: "100%",
            borderRadius: 12,
            border: `1px solid ${addAlpha(COLORS.accent, "30")}`,
            background: COLORS.card,
            color: COLORS.accent,
            fontFamily: FONT,
            fontSize: 12,
            cursor: "pointer",
            padding: 11,
          }}
        >
          ✎ EDIT USERNAME & AVATAR
        </button>
      )}

      <div style={{ marginTop: 12, background: COLORS.card, borderRadius: 16, border: `1px solid ${COLORS.border}`, padding: 14 }}>
        <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1, marginBottom: 4 }}>SECURITY</div>
        {[
          ["endToEndEncryption", "🔒", "End-to-end Encryption", settings.endToEndEncryption ? "AES-256" : "Disabled", settings.endToEndEncryption],
          ["websocketTunnels", "🌐", "WebSocket Tunnels", settings.websocketTunnels ? "WSS/TLS" : "Disabled", settings.websocketTunnels],
          ["messageShredding", "🧅", "Message Shredding", settings.messageShredding ? "On" : "Off", settings.messageShredding],
          ["stealthMode", "🕵️", "Stealth Mode", settings.stealthMode ? "On" : "Off", settings.stealthMode],
        ].map(([key, icon, label, value, active], i, arr) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              borderBottom: i === arr.length - 1 ? "none" : `1px solid ${COLORS.border}`,
            }}
          >
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontFamily: SANS, fontSize: 13, color: COLORS.text, flex: 1 }}>{label}</span>
            <button
              type="button"
              onClick={() => onUpdateSettings(key)}
              style={{
                border: `1px solid ${active ? addAlpha(COLORS.accent, "50") : COLORS.border}`,
                borderRadius: 999,
                background: active ? COLORS.accentDim : COLORS.surface,
                color: active ? COLORS.accent : COLORS.textMuted,
                fontFamily: FONT,
                fontSize: 10,
                padding: "4px 8px",
                cursor: "pointer",
              }}
            >
              {value}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

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

  // Socket.IO integration
  const { connected, peerId, emit: socketEmit, on: socketOn } = useSocket(profile);
  const ownKeyMaterialRef = useRef(null);
  const ownKeyMaterialPromiseRef = useRef(null);
  const roomMemberKeysRef = useRef({});

  const ensureOwnKeyMaterial = async () => {
    if (ownKeyMaterialRef.current) {
      return ownKeyMaterialRef.current;
    }

    if (!ownKeyMaterialPromiseRef.current) {
      ownKeyMaterialPromiseRef.current = generateKeyMaterial()
        .then((material) => {
          ownKeyMaterialRef.current = material;
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

  const getRoomByCodeValue = (roomCode) => {
    const key = normalizePeerCode(roomCode);
    if (!key) return null;
    if (roomDirectory[key]) return roomDirectory[key];
    const fromChats = chats.find((item) => normalizePeerCode(item.code) === key);
    if (fromChats) return fromChats;
    return groups.find((item) => normalizePeerCode(item.code) === key) || null;
  };

  useEffect(() => {
    ensureOwnKeyMaterial().catch((error) => {
      console.error("[E2EE] Failed to initialize key material", error);
    });
  }, []);

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
          setRoomMembersForCode(roomCode, payload.members || []);
          // Update room online status and member count
          setRoomDirectory(prev => {
            const room = prev[key];
            if (room) {
              return { ...prev, [key]: { ...room, online: true, members: payload.members?.length || 1 } };
            }
            return prev;
          });
        })
      );

      // Listen for msg.new (incoming messages)
      unsubscribers.push(
        socketOn('msg.new', async (payload) => {
          console.log('[SOCKET.RECEIVED] msg.new', payload);
          const { fromPeerId, bodyCiphertext, sentAt, autoShredAt, attachment, roomCode } = payload;
          if (fromPeerId === peerId) return; // Skip own messages

          const room = getRoomByCodeValue(roomCode);
          const localRoomId = room?.id;
          if (!localRoomId) return;

          let text = bodyCiphertext;
          let resolvedAttachment = attachment || null;

          if (payload?.bodyFormat === "E2EE_V1") {
            try {
              const keyMaterial = await ensureOwnKeyMaterial();
              const roomMembers = roomMemberKeysRef.current[normalizePeerCode(roomCode)] || {};
              const senderInfo = roomMembers[fromPeerId];
              if (!senderInfo?.signingPublicKey || !senderInfo?.encryptionPublicKey) {
                throw new Error("Missing sender public key metadata");
              }

              const signingKey = await importSigningPublicKey(senderInfo.signingPublicKey);
              const valid = await verifyMessagePayloadSignature(
                signingKey,
                {
                  clientMsgId: payload.clientMsgId,
                  sentAt: payload.sentAt,
                  bodyCiphertext: payload.bodyCiphertext,
                  bodyIv: payload.bodyIv,
                  bodyFormat: payload.bodyFormat,
                  wrappedKeys: payload.wrappedKeys,
                },
                payload.signature
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
            } catch (error) {
              console.error("[E2EE] Failed to decrypt incoming message", error);
              text = "[Unable to decrypt message]";
              resolvedAttachment = null;
            }
          }

          const message = {
            id: payload.clientMsgId || payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            from: "them",
            text,
            time: new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: true,
            expiresAt: autoShredAt,
            attachment: resolvedAttachment,
          };

          setMessagesByRoom(prev => {
            const current = prev[localRoomId] || [];
            return {
              ...prev,
              [localRoomId]: appendMessageUnique(current, message),
            };
          });
        })
      );

      // Listen for typing.update
      unsubscribers.push(
        socketOn('typing.update', (payload) => {
          console.log('[SOCKET.RECEIVED] typing.update', payload);
          // TODO: Update UI for typing indicator from other peers
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
    }

    return () => {
      unsubscribers.forEach(unsub => unsub?.());
    };
  }, [connected, socketOn, peerId, activeChat?.id, activeChat?.code, chats, groups, roomDirectory]);

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

  const sendMessage = async (roomId, text, autoShredSeconds = 0, attachment = null) => {
    if (!roomId || (!text?.trim() && !attachment)) return;
    if (!connected) {
      console.warn('[MSG] Cannot send: socket not connected');
      return;
    }

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
      expiresAt: autoShredSeconds > 0 ? Date.now() + autoShredSeconds * 1000 : undefined,
      attachment,
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

    socketEmit('msg.send', {
      roomId: activeRoom.id,
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
    });
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

    // Emit room.join to socket if connected
    if (connected && room?.code) {
      ensureOwnKeyMaterial()
        .then((keyMaterial) => {
          socketEmit('room.join', {
            roomCode: room.code,
            identity: {
              username: profile.username,
              emoji: profile.emoji,
              keys: {
                encryptionPublicKey: keyMaterial.encryptionPublicKey,
                signingPublicKey: keyMaterial.signingPublicKey,
              },
            },
          });
        })
        .catch((error) => {
          console.error('[E2EE] Unable to join room without key material', error);
        });
    }

    return { ok: true };
  };

  const createGroupRoom = (groupLike) => {
    return new Promise((resolve, reject) => {
      if (!connected) {
        reject(new Error("Socket not connected"));
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
          if (!connected) {
            throw new Error("Socket not connected");
          }

          return new Promise((resolve, reject) => {
            socketEmit(
              'room:generate',
              {
                kind: 'direct',
                ttlMinutes: expiry,
                name: '🧠 Ghost Link',
              },
              (response) => {
                if (!response?.ok || !response?.room?.code) {
                  reject(new Error(response?.error || 'Failed to generate room code'));
                  return;
                }

                const createdRoom = registerRoom(
                  {
                    id: response.room.id,
                    name: response.room.name || '🧠 Ghost Link',
                    unread: 0,
                    time: 'now',
                    last: `Secure key active ${expiry}m`,
                    online: true,
                    code: response.room.code,
                    createdAt: response.room.createdAt,
                    expiresAt: response.room.expiresAt,
                  },
                  response.room.code,
                  { expiryMinutes: expiry }
                );

                resolve(createdRoom?.code || response.room.code);
              }
            );
          });
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
      />;
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: "#050810",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 8px",
      }}
    >
      <style>
        {`* { box-sizing: border-box; margin: 0; padding: 0; }
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
          maxWidth: 420,
          height: "100dvh",
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
