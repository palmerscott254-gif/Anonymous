import React, { useState } from "react";
import { COLORS, FONT, SANS } from "../utils/constants.js";
import { addAlpha } from "../utils/helpers.js";

export function CodeGenScreen({ onGenerateRoom }) {
  const [code, setCode] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copyState, setCopyState] = useState("idle");
  const [expiry, setExpiry] = useState(10);
  const [error, setError] = useState("");

  const handleGenerateCode = async () => {
    if (generating) return;
    setGenerating(true);
    setCopyState("idle");
    setError("");

    try {
      const nextCode = await onGenerateRoom(expiry);
      const displayCode = typeof nextCode === "string" ? nextCode : nextCode?.code;
      setCode(displayCode || null);
      if (!displayCode) {
        throw new Error("Backend did not return a peer code");
      }
    } catch (nextError) {
      setCode(null);
      setError(nextError?.message || "Failed to generate peer code");
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
          background: `linear-gradient(135deg, rgba(255, 255, 255, 0.02), rgba(10, 20, 40, 0.2))`,
          borderRadius: 20,
          padding: "28px 24px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.4)",
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
          <svg width={40} height={40} viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V7L12 2z" fill={COLORS.accent} fillOpacity="0.15" stroke={COLORS.accent} strokeWidth="1.5" />
          </svg>
        </div>

        {code && !generating && (
          <>
            <div style={{ fontFamily: FONT, fontSize: 32, fontWeight: 700, color: COLORS.accent, letterSpacing: 6, textShadow: `0 0 25px ${addAlpha(COLORS.accent, "40")}` }}>{code}</div>
            <div style={{ marginTop: 8, fontFamily: SANS, fontSize: 11, color: COLORS.textMuted }}>Expires in {expiry} minutes or after single use</div>
          </>
        )}

        {generating && <div style={{ fontFamily: FONT, fontSize: 14, color: COLORS.accent }}>● GENERATING...</div>}

        {!code && !generating && <div style={{ fontFamily: FONT, fontSize: 24, color: COLORS.textMuted }}>_ _ - _ _ _ _</div>}
      </div>

      {error && <div style={{ marginTop: 12, fontFamily: FONT, fontSize: 11, color: COLORS.red }}>{error}</div>}

      <div style={{ marginTop: 12, background: "rgba(255, 255, 255, 0.02)", borderRadius: 16, padding: "16px 18px", boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)" }}>
        <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.textMuted, marginBottom: 10 }}>EXPIRY DURATION</div>
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
                  border: "none",
                  background: selected ? "rgba(0, 255, 178, 0.12)" : "rgba(255, 255, 255, 0.03)",
                  color: selected ? COLORS.accent : COLORS.textMuted,
                  fontFamily: FONT,
                  fontSize: 11,
                  padding: "10px 0",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.2s ease",
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
        onClick={handleGenerateCode}
        disabled={generating}
        style={{
          width: "100%",
          marginTop: 12,
          padding: 13,
          borderRadius: 12,
          border: "none",
          cursor: generating ? "not-allowed" : "pointer",
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: 1,
          background: generating ? "rgba(255, 255, 255, 0.02)" : `linear-gradient(135deg, ${COLORS.accent}, #00D4FF)`,
          color: generating ? COLORS.accent : COLORS.bg,
          outline: "none",
          boxShadow: generating ? "none" : `0 4px 20px ${COLORS.accent}30`,
        }}
      >
        {generating ? "⟳ GENERATING..." : "⚡ GENERATE NEW CODE"}
      </button>

      <button
        type="button"
        onClick={copyCode}
        disabled={!code || generating}
        style={{
          width: "100%",
          marginTop: 8,
          padding: 12,
          borderRadius: 12,
          cursor: code && !generating ? "pointer" : "not-allowed",
          fontFamily: FONT,
          fontSize: 12,
          border: "none",
          background: copyState === "success" ? "rgba(0, 255, 178, 0.12)" : "rgba(255, 255, 255, 0.02)",
          color: copyState === "success" ? COLORS.accent : copyState === "error" ? COLORS.red : COLORS.textMuted,
          opacity: code ? 1 : 0.5,
          outline: "none",
        }}
      >
        {copyState === "success" ? "✓ COPIED!" : copyState === "error" ? "✕ COPY FAILED" : "📋 COPY CODE"}
      </button>

      <div style={{ marginTop: 18, background: "rgba(255, 255, 255, 0.01)", borderRadius: 16, padding: "16px 18px", boxShadow: "0 8px 30px rgba(0, 0, 0, 0.2)" }}>
        <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.accent, marginBottom: 12, letterSpacing: 0.5 }}>HOW IT WORKS</div>
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
                background: "rgba(0, 255, 178, 0.08)",
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
    </div>
  );
}
