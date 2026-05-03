/**
 * UI Component: Sidebar & Navigation
 */

import React, { useState } from 'react';

const COLORS = {
  bg: '#080B12',
  surface: '#0D1117',
  card: '#111827',
  border: '#1F2937',
  accent: '#00FFB2',
  accentDim: '#00FFB220',
  accentGlow: '#00FFB240',
  purple: '#A855F7',
  purpleDim: '#A855F720',
  red: '#FF4444',
  text: '#F1F5F9',
  textMuted: '#6B7280',
  textSub: '#9CA3AF',
  bubble: '#1A2235',
  bubbleSelf: '#003D2A',
};

const FONT = "'Space Mono', monospace";
const SANS = "'DM Sans', sans-serif";

function addAlpha(hex, alphaHex) {
  return `${hex}${alphaHex}`;
}

function getEmoji(name = '') {
  const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const match = name.match(EMOJI_REGEX);
  return match ? match[0] : '👤';
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

function Avatar({ name, size = 42, online }) {
  function OnlineDot({ online }) {
    return (
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          position: 'absolute',
          bottom: 0,
          right: 0,
          background: online ? COLORS.accent : COLORS.textMuted,
          boxShadow: online ? `0 0 6px ${COLORS.accent}` : 'none',
          border: `2px solid ${COLORS.bg}`,
        }}
      />
    );
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${COLORS.card}, ${COLORS.border})`,
          border: `1.5px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.45,
        }}
      >
        {getEmoji(name)}
      </div>
      {typeof online === 'boolean' && <OnlineDot online={online} />}
    </div>
  );
}

function NavBar({ tab, onTab }) {
  const items = [
    { id: 'chats', icon: '💬', label: 'Chats' },
    { id: 'search', icon: '🔍', label: 'Search' },
    { id: 'codegen', icon: '🔑', label: 'Keys' },
    { id: 'groups', icon: '👥', label: 'Groups' },
    { id: 'profile', icon: '🦅', label: 'Profile' },
  ];

  return (
    <div style={{ display: 'flex', background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`, padding: '6px 0 10px' }}>
      {items.map((item) => {
        const active = item.id === tab;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onTab(item.id)}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              color: COLORS.textMuted,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18, filter: active ? 'none' : 'grayscale(1)', opacity: active ? 1 : 0.5 }}>{item.icon}</span>
            <span style={{ fontFamily: FONT, fontSize: 9, letterSpacing: 0.5, color: active ? COLORS.accent : COLORS.textMuted }}>{item.label}</span>
            <span style={{ width: 16, height: 2, borderRadius: 999, background: active ? COLORS.accent : 'transparent' }} />
          </button>
        );
      })}
    </div>
  );
}

export { Avatar, NavBar, ShieldIcon, COLORS, FONT, SANS, addAlpha, getEmoji };
