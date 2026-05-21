import React, { useState } from "react";
import { COLORS, FONT, SANS } from "../utils/constants.js";
import { addAlpha, normalizePeerCode, displayPeerCode, getEmoji } from "../utils/helpers.js";
import { Avatar } from "./UI.jsx";

export function ChatsScreen({ chats, groups, onOpen, onRegisterRoom }) {
  const [showNew, setShowNew] = useState(false);
  const [peerCode, setPeerCode] = useState("");
  const [hovered, setHovered] = useState(null);
  const [tunnelError, setTunnelError] = useState("");
  const normalizedCode = normalizePeerCode(peerCode);
  const canOpenTunnel = normalizedCode.length === 6 || normalizedCode.length === 8;

  const openNewTunnel = () => {
    if (normalizedCode.length !== 6 && normalizedCode.length !== 8) {
      setTunnelError("Peer code is required");
      return;
    }
    const resolvedCode = displayPeerCode(normalizedCode);
    const existing = [...chats, ...groups].find((item) => normalizePeerCode(item.code) === normalizedCode);
    if (existing) {
      onOpen(existing);
      setShowNew(false);
      setPeerCode("");
      setTunnelError("");
      return;
    }

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
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill={COLORS.accent} fillOpacity="0.15" stroke={COLORS.accent} strokeWidth="1.5" />
            </svg>
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
            disabled={!canOpenTunnel}
            style={{
              marginTop: "auto",
              border: "none",
              cursor: canOpenTunnel ? "pointer" : "not-allowed",
              background: canOpenTunnel ? `linear-gradient(135deg, ${COLORS.accent}, #00D4FF)` : COLORS.card,
              color: canOpenTunnel ? COLORS.bg : COLORS.textMuted,
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
