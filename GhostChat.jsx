import React, { useEffect, useRef, useState } from "react";

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
};

const DEFAULT_PROFILE = {
  username: "Ghost",
  emoji: "🦅",
  peerCode: generatePeerCode(),
};

const DEFAULT_ACTIVITY = {
  messages: 0,
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

function ShieldIcon({ size = 14, color = COLORS.accent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="1.5"
      />
      <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill={COLORS.accent} fillOpacity="0.15" stroke={COLORS.accent} strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 118 0v3" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.4" fill={COLORS.accent} />
    </svg>
  );
}

function OnlineDot({ online }) {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        position: "absolute",
        bottom: 0,
        right: 0,
        background: online ? COLORS.accent : COLORS.textMuted,
        boxShadow: online ? `0 0 6px ${COLORS.accent}` : "none",
        border: `2px solid ${COLORS.bg}`,
      }}
    />
  );
}

function Avatar({ name, size = 42, online }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.card}, ${COLORS.border})`,
          border: `1.5px solid ${COLORS.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.45,
        }}
      >
        {getEmoji(name)}
      </div>
      {typeof online === "boolean" && <OnlineDot online={online} />}
    </div>
  );
}

function NavBar({ tab, onTab }) {
  const items = [
    { id: "chats", icon: "💬", label: "Chats" },
    { id: "search", icon: "🔍", label: "Search" },
    { id: "codegen", icon: "🔑", label: "Keys" },
    { id: "groups", icon: "👥", label: "Groups" },
    { id: "profile", icon: "🦅", label: "Profile" },
  ];

  return (
    <div style={{ display: "flex", background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`, padding: "6px 0 10px" }}>
      {items.map((item) => {
        const active = item.id === tab;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTab(item.id)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              color: COLORS.textMuted,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 18, filter: active ? "none" : "grayscale(1)", opacity: active ? 1 : 0.5 }}>{item.icon}</span>
            <span style={{ fontFamily: FONT, fontSize: 9, letterSpacing: 0.5, color: active ? COLORS.accent : COLORS.textMuted }}>{item.label}</span>
            <span style={{ width: 16, height: 2, borderRadius: 999, background: active ? COLORS.accent : "transparent" }} />
          </button>
        );
      })}
    </div>
  );
}

function ChatsScreen({ chats, groups, onOpen, onRegisterRoom }) {
  const [showNew, setShowNew] = useState(false);
  const [peerCode, setPeerCode] = useState("");
  const [hovered, setHovered] = useState(null);
  const [tunnelError, setTunnelError] = useState("");

  const openNewTunnel = () => {
    const normalizedCode = normalizePeerCode(peerCode);
    if (normalizedCode.length !== 6) {
      setTunnelError("Peer code is required (format: XX-0000)");
      return;
    }
    const resolvedCode = displayPeerCode(normalizedCode);
    const newChat = {
      id: Date.now(),
      name: `🔐 Peer ${resolvedCode}`,
      last: "New tunnel opened",
      time: "now",
      unread: 0,
      online: true,
      code: resolvedCode,
    };
    onRegisterRoom(newChat, resolvedCode);
    onOpen(newChat);
    setShowNew(false);
    setPeerCode("");
    setTunnelError("");
  };

  return (
    <div style={{ paddingBottom: 14, position: "relative", minHeight: "100%" }}>
      <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: FONT, fontSize: 20, fontWeight: 700, letterSpacing: -0.5, color: COLORS.text }}>
            GHOST<span style={{ color: COLORS.accent }}>CHAT</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, color: COLORS.textMuted, fontFamily: SANS, fontSize: 10 }}>
            <ShieldIcon size={10} color={COLORS.accent} />
            <span>All tunnels encrypted</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowNew(true)}
          style={{
            background: COLORS.accentDim,
            border: `1px solid ${addAlpha(COLORS.accent, "40")}`,
            borderRadius: 20,
            padding: "6px 12px",
            color: COLORS.accent,
            fontFamily: FONT,
            fontSize: 10,
            cursor: "pointer",
          }}
        >
          + NEW
        </button>
      </div>

      <div style={{ padding: "0 12px" }}>
        {chats.length === 0 && (
          <div style={{ padding: "10px 12px", borderRadius: 12, background: COLORS.card, border: `1px solid ${COLORS.border}`, fontFamily: SANS, fontSize: 12, color: COLORS.textMuted }}>
            No chats yet. Tap <span style={{ color: COLORS.accent, fontFamily: FONT }}>+ NEW</span> to open your first tunnel.
          </div>
        )}
        {chats.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            onMouseEnter={() => setHovered(c.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onOpen(c)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onOpen(c);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 14,
              cursor: "pointer",
              background: hovered === c.id ? COLORS.card : "transparent",
            }}
          >
            <Avatar name={c.name} size={42} online={c.online} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{c.name}</div>
                <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.textMuted }}>{c.time}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2, gap: 10 }}>
                <div style={{ fontFamily: SANS, fontSize: 12, color: COLORS.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.last}</div>
                {c.unread > 0 && (
                  <span
                    style={{
                      background: COLORS.accent,
                      color: COLORS.bg,
                      borderRadius: 10,
                      fontFamily: FONT,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                    }}
                  >
                    {c.unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {groups.length > 0 && <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1, padding: "12px 12px 4px" }}>GROUPS</div>}

      <div style={{ padding: "0 12px" }}>
        {groups.map((g) => (
          <div
            key={g.id}
            role="button"
            tabIndex={0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 14,
              cursor: "pointer",
              background: hovered === g.id ? COLORS.card : "transparent",
            }}
            onMouseEnter={() => setHovered(g.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onOpen(g)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onOpen(g);
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: COLORS.purpleDim,
                border: `1.5px solid ${addAlpha(COLORS.purple, "40")}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {getEmoji(g.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{g.name}</div>
                <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.textMuted }}>{g.time}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2, gap: 10 }}>
                <div style={{ fontFamily: SANS, fontSize: 12, color: COLORS.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.last}</div>
                {g.unread > 0 && (
                  <span
                    style={{
                      background: COLORS.purple,
                      color: "#fff",
                      borderRadius: 10,
                      fontFamily: FONT,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "1px 6px",
                    }}
                  >
                    {g.unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(8,11,18,0.96)",
            zIndex: 50,
            display: "flex",
            flexDirection: "column",
            padding: "24px 20px",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: COLORS.text }}>
              NEW <span style={{ color: COLORS.accent }}>TUNNEL</span>
            </div>
            <button type="button" onClick={() => setShowNew(false)} style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 20, cursor: "pointer" }}>
              ✕
            </button>
          </div>

          <div>
            <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1, marginBottom: 6 }}>PEER CODE (required)</div>
            <input
              value={peerCode}
              onChange={(e) => {
                setPeerCode(displayPeerCode(e.target.value));
                if (tunnelError) setTunnelError("");
              }}
              placeholder="XX-0000"
              style={{
                width: "100%",
                background: COLORS.card,
                border: `1px solid ${addAlpha(COLORS.accent, "40")}`,
                borderRadius: 12,
                padding: "10px 14px",
                fontFamily: FONT,
                letterSpacing: 3,
                fontSize: 14,
                color: COLORS.accent,
                outlineColor: COLORS.accent,
                textTransform: "uppercase",
              }}
            />
            {tunnelError && <div style={{ marginTop: 6, fontFamily: FONT, fontSize: 10, color: COLORS.red }}>{tunnelError}</div>}
          </div>

          <button
            type="button"
            onClick={openNewTunnel}
            style={{
              marginTop: "auto",
              border: "none",
              cursor: "pointer",
              background: `linear-gradient(135deg, ${COLORS.accent}, #00D4FF)`,
              color: COLORS.bg,
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 14,
              padding: 13,
            }}
          >
            OPEN TUNNEL →
          </button>
        </div>
      )}
    </div>
  );
}

function ChatRoom({ chat, onBack, settings, onMessageSent }) {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState(chat?.seedMessages || MESSAGES);
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);
  const timeoutRef = useRef([]);

  useEffect(() => {
    setMessages(chat?.seedMessages || MESSAGES);
    setMsg("");
    setTyping(false);
  }, [chat?.id]);

  const shreddingEnabled = settings?.messageShredding ?? true;
  const tunnelEnabled = settings?.websocketTunnels ?? true;
  const encryptionEnabled = settings?.endToEndEncryption ?? true;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  useEffect(
    () => () => {
      timeoutRef.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  useEffect(() => {
    if (!shreddingEnabled) return undefined;
    const shredTimer = window.setInterval(() => {
      const now = Date.now();
      setMessages((prev) => prev.filter((item) => !item.expiresAt || item.expiresAt > now));
    }, 5000);
    return () => window.clearInterval(shredTimer);
  }, [shreddingEnabled]);

  const send = () => {
    if (!tunnelEnabled) return;
    const text = msg.trim();
    if (!text) return;
    const mine = { id: Date.now(), from: "me", text, time: getNowHHMM(), read: false, expiresAt: shreddingEnabled ? Date.now() + 45000 : undefined };
    setMessages((prev) => [...prev, mine]);
    if (onMessageSent) onMessageSent();
    setMsg("");

    const t1 = window.setTimeout(() => setTyping(true), 500);
    const t2 = window.setTimeout(() => {
      setTyping(false);
      setMessages((prev) => {
        const marked = prev.map((item) => (item.from === "me" && !item.read ? { ...item, read: true } : item));
        return [...marked, { id: Date.now() + 1, from: "them", text: "got it 👍", time: getNowHHMM(), read: false, expiresAt: shreddingEnabled ? Date.now() + 45000 : undefined }];
      });
    }, 2000);

    timeoutRef.current.push(t1, t2);
  };

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
              <div style={{ fontFamily: SANS, fontSize: 13, color: m.from === "me" ? "#39FF14" : "#00BFFF", lineHeight: 1.4 }}>{m.text}</div>
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
          disabled={!tunnelEnabled}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: msg.trim() ? COLORS.accent : COLORS.card,
            color: msg.trim() ? COLORS.bg : COLORS.textMuted,
          }}
        >
          ➤
        </button>
      </div>
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
        setStatus("Joining secure tunnel...");
        setScanning(false);
        onJoinRoom(roomDirectory[normalizedCode]);
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
  const [copied, setCopied] = useState(false);
  const [expiry, setExpiry] = useState(10);

  const generateCode = () => {
    if (generating) return;
    setGenerating(true);
    setCopied(false);

    window.setTimeout(() => {
      const nextCode = generatePeerCode();
      setCode(nextCode);
      onGenerateRoom(nextCode, expiry);
      setGenerating(false);
    }, 1200);
  };

  const copyCode = async () => {
    if (!code) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      }
    } catch {
      // intentionally ignored
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
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

      {code !== null && (
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
      )}

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

      {code !== null && (
        <button
          type="button"
          onClick={copyCode}
          style={{
            width: "100%",
            marginTop: 8,
            padding: 12,
            borderRadius: 12,
            cursor: "pointer",
            fontFamily: FONT,
            fontSize: 12,
            border: `1px solid ${copied ? COLORS.accent : COLORS.border}`,
            background: copied ? COLORS.accentDim : COLORS.card,
            color: copied ? COLORS.accent : COLORS.textMuted,
          }}
        >
          {copied ? "✓ COPIED!" : "📋 COPY CODE"}
        </button>
      )}

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
  const [selectedEmoji, setSelectedEmoji] = useState("🛸");
  const [latestGroupCode, setLatestGroupCode] = useState("");

  const options = ["🛸", "🌊", "🔥", "⚡", "🌙", "🦋", "🐺", "🦊", "🐉", "🎭", "💀", "🌌"];

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
            onChange={(e) => setGroupName(e.target.value)}
            placeholder={`${selectedEmoji} Group name...`}
            style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "9px 12px", color: COLORS.text, fontFamily: SANS, fontSize: 13, outline: "none", marginBottom: 10 }}
          />

          <button
            type="button"
            onClick={() => {
              const name = `${selectedEmoji} ${groupName.trim() || "Ghost Group"}`;
              const codeValue = generatePeerCode();
              onCreateGroupRoom({
                id: Date.now(),
                name,
                members: 1,
                online: true,
                isGroup: true,
                unread: 0,
                last: "Group tunnel created",
                time: "now",
                code: codeValue,
              });
              setLatestGroupCode(codeValue);
              setShowCreate(false);
              setGroupName("");
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
        <div style={{ marginBottom: 8, fontFamily: FONT, fontSize: 10, color: COLORS.purple }}>
          New group tunnel code: {latestGroupCode}
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
  const [chats, setChats] = useState(CHATS);
  const [groups, setGroups] = useState(GROUPS);
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
      };
    });
    return seeded;
  });

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

  useEffect(() => {
    window.localStorage.setItem("gc.settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem("gc.profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    window.localStorage.setItem("gc.activity", JSON.stringify(activity));
  }, [activity]);

  const registerRoom = (chatLike, rawCode) => {
    const code = displayPeerCode(rawCode || chatLike?.code || generatePeerCode());
    const key = normalizePeerCode(code);
    if (!key) return chatLike;
    const room = {
      ...chatLike,
      code,
      online: typeof chatLike?.online === "boolean" ? chatLike.online : true,
      id: chatLike?.id || Date.now(),
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

  const openRoom = (chatLike) => {
    if (!chatLike) return;
    const room = chatLike.code ? registerRoom(chatLike, chatLike.code) : chatLike;
    setActiveChat(room);
    setTab("chats");
  };

  const stats = {
    messages: activity.messages,
    tunnels: chats.length,
    groups: groups.length,
  };

  let content;
  if (activeChat) {
    content = <ChatRoom chat={activeChat} onBack={() => setActiveChat(null)} settings={settings} onMessageSent={() => setActivity((prev) => ({ ...prev, messages: prev.messages + 1 }))} />;
  } else if (tab === "chats") {
    content = <ChatsScreen chats={chats} groups={groups} onOpen={openRoom} onRegisterRoom={registerRoom} />;
  } else if (tab === "search") {
    content = <SearchScreen roomDirectory={roomDirectory} onJoinRoom={openRoom} />;
  } else if (tab === "codegen") {
    content =
      <CodeGenScreen
        onGenerateRoom={(codeValue, expiry) => {
          registerRoom(
            {
              id: Date.now(),
              name: "🧠 Ghost Link",
              unread: 0,
              time: "now",
              last: `Secure key active ${expiry}m`,
              online: true,
            },
            codeValue
          );
        }}
      />;
  } else if (tab === "groups") {
    content = <GroupsScreen groups={groups} onCreateGroupRoom={registerRoom} onOpenGroupRoom={openRoom} />;
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
