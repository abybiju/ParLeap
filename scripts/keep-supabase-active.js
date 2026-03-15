#!/usr/bin/env node
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env');
  process.exit(1);
}
(async () => {
  try {
    const rpcUrl = url.replace(/\/$/, '') + '/rest/v1/rpc/now';
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`
      },
      body: 'null'
    });
    if (!res.ok) {
      console.error('Supabase RPC failed', res.status, await res.text());
      process.exit(1);
    }
    const payload = await res.json();
    console.log('Supabase ping successful:', JSON.stringify(payload));
  } catch (error) {
    console.error('Supabase ping failed', error);
    process.exit(1);
  }
})();
