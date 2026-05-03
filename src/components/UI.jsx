import React from "react";
import { COLORS, FONT } from "../utils/constants.js";
import { addAlpha } from "../utils/helpers.js";

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

const EMOJI_OPTIONS = ["🦅", "🦊", "🐺", "🌙", "🔥", "⚡", "🎭", "🐉", "🦋", "🛸", "💀", "🌊"];

export function NavBar({ tab, onTab }) {
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

export function Avatar({ name, size = 42, online }) {
  function getEmoji(name = "") {
    const emojiMatch = name.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    return emojiMatch ? emojiMatch[0] : "👤";
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

export function LockIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill={COLORS.accent} fillOpacity="0.15" stroke={COLORS.accent} strokeWidth="1.5" />
      <path d="M8 11V8a4 4 0 118 0v3" stroke={COLORS.accent} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.4" fill={COLORS.accent} />
    </svg>
  );
}

export { ShieldIcon };
