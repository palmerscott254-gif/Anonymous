import React, { useRef, useEffect, useState } from "react";
import { COLORS, FONT, SANS } from "../utils/constants.js";
import { MESSAGE_REACTION_OPTIONS } from "../utils/constants.js";
import { formatFileSize, isImageMimeType, getNowHHMM, addAlpha } from "../utils/helpers.js";
import { Avatar, LockIcon } from "./UI.jsx";

export function ChatRoom({ chat, onBack, settings, messages, onSendMessage, onPruneMessages, onMessageSent, onTypingChange, onDraftChange, onReactMessage, remoteTyping = false, draft = "", replyTarget, onReplyTargetChange }) {
  const [msg, setMsg] = useState(draft || "");
  const [typing, setTyping] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [attachmentError, setAttachmentError] = useState("");
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  useEffect(() => {
    setMsg(draft || "");
    setTyping(false);
    setPendingAttachment(null);
    setAttachmentError("");
    onDraftChange?.(chat?.id, draft || "");
    onTypingChange?.(chat?.id, false);
  }, [chat?.id]);

  useEffect(() => {
    setMsg(draft || "");
  }, [draft, chat?.id]);

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
      const reader = new FileReader();
      reader.onload = () => {
        setPendingAttachment({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: reader.result,
        });
        setAttachmentError("");
      };
      reader.onerror = () => {
        setAttachmentError("Unable to attach this file right now.");
      };
      reader.readAsDataURL(file);
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
      pendingAttachment,
      replyTarget || null
    );
    if (onMessageSent) onMessageSent();
    setMsg("");
    onDraftChange?.(chat?.id, "");
    onReplyTargetChange?.(null);
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
              {m.replyTo ? (
                <div style={{ marginBottom: 6, borderLeft: `2px solid ${COLORS.accent}`, paddingLeft: 8, color: COLORS.textMuted, fontFamily: SANS, fontSize: 11 }}>
                  <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.accent }}>REPLYING TO {m.replyTo.sender || "message"}</div>
                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.replyTo.preview || "Reply"}</div>
                </div>
              ) : null}

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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 2 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => onReplyTargetChange?.({ msgId: m.serverMsgId || m.id, sender: m.fromUsername || m.sender || m.from, preview: m.text || m.attachment?.name || "Attachment" })}
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.surface,
                      color: COLORS.textMuted,
                      borderRadius: 999,
                      fontFamily: FONT,
                      fontSize: 9,
                      padding: "3px 7px",
                      cursor: "pointer",
                    }}
                  >
                    ↩ Reply
                  </button>
                  {MESSAGE_REACTION_OPTIONS.map((emoji) => (
                    <button
                      key={`${m.id}-${emoji}`}
                      type="button"
                      onClick={() => onReactMessage?.(chat?.id, m.id, emoji)}
                      style={{
                        border: `1px solid ${COLORS.border}`,
                        background: COLORS.surface,
                        color: COLORS.textMuted,
                        borderRadius: 999,
                        fontFamily: FONT,
                        fontSize: 9,
                        padding: "3px 6px",
                        cursor: "pointer",
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div style={{ fontFamily: FONT, fontSize: 9, color: COLORS.textMuted, textAlign: "right" }}>
                  {m.time}
                  {m.from === "me" ? ` ${m.read ? "✓✓" : "✓"}` : ""}
                </div>
              </div>

              {m.reactions && Object.keys(m.reactions).length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {Object.entries(m.reactions).map(([emoji, count]) => (
                    <span key={`${m.id}-${emoji}`} style={{ fontFamily: FONT, fontSize: 9, color: COLORS.accent, background: COLORS.accentDim, borderRadius: 999, padding: "2px 6px" }}>
                      {emoji} {count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {(typing || remoteTyping) && (
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
          onChange={(e) => {
            const nextValue = e.target.value;
            setMsg(nextValue);
            onDraftChange?.(chat?.id, nextValue);
            const nextTyping = Boolean(nextValue.trim());
            setTyping(nextTyping);
            onTypingChange?.(chat?.id, nextTyping);
          }}
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
      {replyTarget && (
        <div style={{ padding: "0 12px 8px", background: COLORS.surface }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.card, padding: "8px 10px" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.accent }}>Replying to {replyTarget.sender || "message"}</div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: COLORS.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{replyTarget.preview || "Reply"}</div>
            </div>
            <button
              type="button"
              onClick={() => onReplyTargetChange?.(null)}
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
              CLEAR
            </button>
          </div>
        </div>
      )}
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
