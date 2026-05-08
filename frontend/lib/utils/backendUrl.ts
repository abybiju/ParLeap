import { createClient } from '../supabase/client';

export function getBackendHttpUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL;
  if (process.env.NEXT_PUBLIC_WS_URL) {
    const u = process.env.NEXT_PUBLIC_WS_URL;
    return u.startsWith('wss://') ? u.replace(/^wss:\/\//, 'https://') : u.replace(/^ws:\/\//, 'http://');
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'www.parleap.com') {
    return 'https://parleapbackend-production.up.railway.app';
  }
  return 'http://localhost:3001';
}

export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...init, headers });
}
