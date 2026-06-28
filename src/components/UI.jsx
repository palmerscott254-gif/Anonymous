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
    <div style={{ display: "flex", background: "rgba(13, 17, 23, 0.75)", backdropFilter: "blur(30px)", padding: "10px 0 14px", boxShadow: "0 -10px 50px rgba(0, 0, 0, 0.6)" }}>
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
              gap: 4,
              cursor: "pointer",
              outline: "none",
            }}
          >
            <span style={{ fontSize: 18, filter: active ? "none" : "grayscale(1)", opacity: active ? 1 : 0.4, transition: "all 0.2s ease" }}>{item.icon}</span>
            <span style={{ fontFamily: FONT, fontSize: 9, letterSpacing: 0.5, color: active ? COLORS.accent : COLORS.textMuted, opacity: active ? 1 : 0.6, transition: "all 0.2s ease" }}>{item.label}</span>
            <span style={{ width: 12, height: 2, borderRadius: 999, background: active ? COLORS.accent : "transparent", marginTop: 2, boxShadow: active ? `0 0 10px ${COLORS.accent}` : "none", transition: "all 0.2s ease" }} />
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
          width: 9,
          height: 9,
          borderRadius: "50%",
          position: "absolute",
          bottom: 0,
          right: 0,
          background: online ? COLORS.accent : COLORS.textMuted,
          boxShadow: online ? `0 0 8px ${COLORS.accent}` : "none",
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
          background: `linear-gradient(135deg, ${COLORS.surface}, #161C24)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.45,
          boxShadow: "0 4px 15px rgba(0, 0, 0, 0.4)",
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
