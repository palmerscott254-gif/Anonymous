import React, { useState } from "react";
import { COLORS, FONT, SANS } from "../utils/constants.js";
import { normalizePeerCode, displayPeerCode, getEmoji, addAlpha } from "../utils/helpers.js";
import { Avatar } from "./UI.jsx";

const SEARCH_RESULTS = [];

export function SearchScreen({ roomDirectory, onJoinRoom }) {
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
