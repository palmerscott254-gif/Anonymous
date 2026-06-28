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
            background: "rgba(168, 85, 247, 0.12)",
            border: "none",
            color: COLORS.purple,
            fontFamily: FONT,
            fontSize: 10,
            borderRadius: 20,
            padding: "8px 16px",
            cursor: "pointer",
            outline: "none",
            boxShadow: "0 2px 10px rgba(168, 85, 247, 0.1)",
          }}
        >
          + CREATE
        </button>
      </div>

      {showCreate && (
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 20, padding: 20, marginTop: 14, marginBottom: 14, boxShadow: "0 10px 40px rgba(0,0,0,0.4)" }}>
          <div style={{ fontFamily: FONT, fontSize: 11, color: COLORS.purple, letterSpacing: 1, marginBottom: 12 }}>NEW GROUP</div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: COLORS.textMuted, letterSpacing: 1, marginBottom: 8 }}>PICK AVATAR</div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
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
                  border: "none",
                  background: selectedEmoji === emoji ? "rgba(168, 85, 247, 0.2)" : "rgba(255,255,255,0.03)",
                  boxShadow: selectedEmoji === emoji ? `0 0 12px ${addAlpha(COLORS.purple, "30")}` : "none",
                  outline: "none",
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
            style={{
              width: "100%",
              background: "rgba(255, 255, 255, 0.03)",
              border: "none",
              borderRadius: 12,
              padding: "11px 14px",
              color: COLORS.text,
              fontFamily: SANS,
              fontSize: 13,
              outline: "none",
              marginBottom: 12,
              boxShadow: "inset 0 1px 4px rgba(0, 0, 0, 0.3)",
            }}
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
              borderRadius: 12,
              padding: 12,
              outline: "none",
              boxShadow: `0 4px 15px ${addAlpha(COLORS.purple, "30")}`,
            }}
          >
            CREATE SECURE GROUP
          </button>
        </div>
      )}

      {latestGroupCode && (
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontFamily: FONT, fontSize: 10, color: COLORS.purple, background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: "10px 14px", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }}>
          <span>Invite code: {latestGroupCode}</span>
          <button
            type="button"
            onClick={() => copyInviteCode(latestGroupCode, latestGroupCode)}
            style={{
              border: "none",
              borderRadius: 999,
              background: copyState[latestGroupCode] === "success" ? "rgba(168, 85, 247, 0.2)" : "rgba(255,255,255,0.05)",
              color: copyState[latestGroupCode] === "success" ? COLORS.purple : COLORS.textMuted,
              fontFamily: FONT,
              fontSize: 9,
              padding: "6px 12px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {copyState[latestGroupCode] === "success" ? "COPIED" : "COPY"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {groups.map((group) => (
          <div
            key={group.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenGroupRoom(group)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onOpenGroupRoom(group);
            }}
            style={{ background: "rgba(255,255,255,0.02)", borderRadius: 20, padding: 16, cursor: "pointer", boxShadow: "0 8px 30px rgba(0, 0, 0, 0.3)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: COLORS.purpleDim,
                  fontSize: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 4px 15px rgba(0, 0, 0, 0.4)",
                }}
              >
                {group.name?.match(/[\u{1F300}-\u{1FAFF}]/u)?.[0] || "👥"}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{group.name}</div>
                <div style={{ fontFamily: SANS, fontSize: 11, color: COLORS.textMuted }}>{group.members} members • encrypted</div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: FONT, fontSize: 10, color: COLORS.purple, fontWeight: 700 }}>{group.code}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyInviteCode(group.code, group.id);
                    }}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      background: copyState[group.id] === "success" ? "rgba(168, 85, 247, 0.2)" : "rgba(255, 255, 255, 0.05)",
                      color: copyState[group.id] === "success" ? COLORS.purple : COLORS.textMuted,
                      fontFamily: FONT,
                      fontSize: 9,
                      padding: "5px 10px",
                      cursor: "pointer",
                      outline: "none",
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

            <div style={{ marginTop: 12, paddingUp: 8, fontFamily: SANS, fontSize: 11, color: COLORS.textMuted, opacity: 0.8 }}>
              {group.last}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
