export function sanitizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

export function sanitizeUsername(value) {
  return sanitizeText(value, 'Ghost').slice(0, 40);
}

export function sanitizeEmoji(value) {
  return sanitizeText(value, '👤').slice(0, 4);
}

export function normalizeRoomCode(value = '') {
  const normalized = String(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!normalized) return '';
  if (normalized.length <= 2) return normalized;
  if (normalized.length === 8) {
    return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  }
  return `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
}
