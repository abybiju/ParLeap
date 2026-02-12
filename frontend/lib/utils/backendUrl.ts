export function getBackendHttpUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL;
  if (process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL.replace(/^wss?:\/\//, 'https://');
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'www.parleap.com') {
    return 'https://parleapbackend-production.up.railway.app';
  }
  return 'http://localhost:3001';
}
