/**
 * UI Theme and Constants
 */

export const COLORS = {
  bg: "#080B12",
  surface: "#0D1117",
  card: "#111827",
  border: "#1F2937",
  accent: "#00FFB2",
  accentDim: "#00FFB220",
  accentGlow: "#00FFB240",
  purple: "#A855F7",
  purpleDim: "#A855F720",
  red: "#FF4444",
  text: "#F1F5F9",
  textMuted: "#6B7280",
  textSub: "#9CA3AF",
  bubble: "#1A2235",
  bubbleSelf: "#003D2A",
};

export const FONT = "'Space Mono', monospace";
export const SANS = "'DM Sans', sans-serif";

export const DEFAULT_SETTINGS = {
  endToEndEncryption: true,
  websocketTunnels: true,
  messageShredding: true,
  stealthMode: false,
  androidOptimization: true,
};

export const DEFAULT_PROFILE = {
  username: "Ghost",
  emoji: "🦅",
  // peerCode will be generated at runtime
};

export const DEFAULT_ACTIVITY = {
  messages: 0,
};

export const STORAGE_KEYS = {
  chats: "gc.chats",
  groups: "gc.groups",
  rooms: "gc.rooms",
  messages: "gc.messages",
  drafts: "gc.drafts",
  pendingMessages: "gc.pendingMessages",
  settings: "gc.settings",
  profile: "gc.profile",
  activity: "gc.activity",
};

export const MESSAGE_REACTION_OPTIONS = ["👍", "❤️", "🔥", "👀"];

export const EMOJI_OPTIONS = {
  profile: ["🦅", "🦊", "🐺", "🌙", "🔥", "⚡", "🎭", "🐉", "🦋", "🛸", "💀", "🌊"],
  groups: ["🛸", "🌊", "🔥", "⚡", "🌙", "🦋", "🐺", "🦊", "🐉", "🎭", "💀", "🌌"],
};

export const ANIMATION_KEYFRAMES = `
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
`;
