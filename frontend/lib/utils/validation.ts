const ALLOWED_URL_PROTOCOLS = ['https:'];
const MAX_URL_LENGTH = 2048;

export function isValidHttpsUrl(url: string): boolean {
  if (!url || url.length > MAX_URL_LENGTH) return false;
  try {
    const parsed = new URL(url);
    return ALLOWED_URL_PROTOCOLS.includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function isValidMediaUrl(url: string): boolean {
  if (!isValidHttpsUrl(url)) return false;
  try {
    const parsed = new URL(url);
    return !parsed.hostname.includes('localhost') && !parsed.hostname.match(/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/);
  } catch {
    return false;
  }
}

export function sanitizeSearchQuery(query: string, maxLength = 200): string {
  return query
    .replace(/[%_\\]/g, (c) => `\\${c}`)
    .slice(0, maxLength);
}

export function sanitizeText(text: string, maxLength = 1000): string {
  // Strip control chars (except newline/tab), trim, limit length
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLength);
}
