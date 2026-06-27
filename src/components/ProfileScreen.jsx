import React, { useState, useEffect } from "react";
import { COLORS, FONT, SANS, EMOJI_OPTIONS } from "../utils/constants.js";
import { addAlpha } from "../utils/helpers.js";

export function ProfileScreen({ settings, onUpdateSettings, profile, onProfileSave, stats }) {
  const [editing, setEditing] = useState(false);
  const [tempName, setTempName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(profile?.emoji || "🦅");
  const peerCode = profile?.peerCode || profile?.roomCode || "--";

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
          {displayName.match(/[\u{1F300}-\u{1FAFF}]/u)?.[0] || "👤"}
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
          <span style={{ color: COLORS.accent }}>{peerCode}</span> • peer code
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
            {EMOJI_OPTIONS.profile.map((emoji) => (
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
          {!profile?.peerCode && (
            <div style={{ marginTop: 10, fontFamily: SANS, fontSize: 10, color: COLORS.textMuted }}>
              Your peer code will appear after a tunnel or key has been generated.
            </div>
          )}
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
