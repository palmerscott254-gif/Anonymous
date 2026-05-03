import React, { useState } from "react";
import { COLORS, FONT, SANS, EMOJI_OPTIONS } from "../utils/constants.js";
import { stripLeadingEmoji, addAlpha, copyTextToClipboard } from "../utils/helpers.js";

export function GroupsScreen({ groups, onCreateGroupRoom, onOpenGroupRoom }) {
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [createError, setCreateError] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("🛸");
  const [latestGroupCode, setLatestGroupCode] = useState("");
  const [copyState, setCopyState] = useState({});

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
            {EMOJI_OPTIONS.groups.map((emoji) => (
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
              {group.name?.match(/[\u{1F300}-\u{1FAFF}]/u)?.[0] || "👥"}
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
