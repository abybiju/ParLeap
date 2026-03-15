#!/usr/bin/env node
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env');
  process.exit(1);
}

(async () => {
  try {
    const endpoint = url.replace(/\/$/, '') + '/rest/v1/heartbeat_pings';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({ source: 'github-actions' })
    });
    if (!res.ok) {
      console.error('Supabase insert failed', res.status, await res.text());
      process.exit(1);
    }
    const text = await res.text();
    if (text) {
      console.log('Supabase heartbeat inserted:', text);
    } else {
      console.log('Supabase heartbeat inserted (no body)');
    }
  } catch (error) {
    console.error('Supabase ping failed', error);
    process.exit(1);
  }
})();
