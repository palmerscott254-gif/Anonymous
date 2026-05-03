/**
 * Utility functions for GhostChat
 * Common helpers used across components
 */

export function addAlpha(hex, alphaHex) {
  return `${hex}${alphaHex}`;
}

export function createSafeRegex(pattern, flags, fallback) {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return fallback;
  }
}

export const EMOJI_REGEX = createSafeRegex("\\p{Emoji}", "u", /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
export const LEADING_EMOJI_REGEX = createSafeRegex("^\\p{Emoji}\\s*", "u", /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u);

export function getEmoji(name = "") {
  const match = name.match(EMOJI_REGEX);
  return match ? match[0] : "👤";
}

export function stripLeadingEmoji(name = "") {
  return name.replace(LEADING_EMOJI_REGEX, "").trim();
}

export function getNowHHMM() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

export function generatePeerCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const first = letters[Math.floor(Math.random() * letters.length)];
  const second = letters[Math.floor(Math.random() * letters.length)];
  const tail = Array.from({ length: 4 }, () => digits[Math.floor(Math.random() * digits.length)]).join("");
  return `${first}${second}-${tail}`;
}

export function normalizePeerCode(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function displayPeerCode(value = "") {
  const normalized = normalizePeerCode(value);
  if (!normalized) return "";
  if (normalized.length <= 2) return normalized;
  return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
}

export function formatFileSize(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function appendMessageUnique(items = [], nextMessage) {
  if (!nextMessage?.id) return [...items, nextMessage];
  if (items.some((item) => item.id === nextMessage.id)) return items;
  return [...items, nextMessage];
}

export function isImageMimeType(mime = "") {
  return /^image\//i.test(mime);
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall back below
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textArea);
    return copied;
  } catch {
    return false;
  }
}
