const PROXY_URL    = 'https://gutter-api.vercel.app/api/explain';
const REFRESH_URL  = 'https://zwetyinnzamzmsvnraax.supabase.co/auth/v1/token?grant_type=refresh_token';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZXR5aW5uemFtem1zdm5yYWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NzQwNjAsImV4cCI6MjA5MzQ1MDA2MH0.hFjRaqJ-y3cbyKu5Jw6IzREfOBRKOpFynuaxinuJyJM';

async function refreshToken() {
  const { refreshToken } = await chrome.storage.local.get('refreshToken');
  if (!refreshToken) return null;

  const r = await fetch(REFRESH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
    body: JSON.stringify({ refresh_token: refreshToken })
  });

  const data = await r.json();
  if (!data.access_token) return null;

  await chrome.storage.local.set({
    token: data.access_token,
    refreshToken: data.refresh_token
  });

  return data.access_token;
}

async function callProxy(text, retries = 1) {
  let { token } = await chrome.storage.local.get('token');

  if (!token) {
    return { error: 'Not logged in. Open extension options to sign in.' };
  }

  const r = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ text })
  });

  if (r.status === 401) {
    const newToken = await refreshToken();
    if (newToken && retries > 0) {
      return callProxy(text, retries - 1);
    }
    await chrome.storage.local.remove(['token', 'email', 'refreshToken']);
    return { error: 'Session expired. Please log in again via extension options.' };
  }

  if (r.status === 503 && retries > 0) {
    await new Promise(res => setTimeout(res, 3000));
    return callProxy(text, retries - 1);
  }

  return r.json();
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action !== 'explain') return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  callProxy(message.text)
    .then(data => {
      if (data.result) {
        chrome.tabs.sendMessage(tabId, { action: 'result', result: data.result, remaining: data.remaining ?? null });
      } else {
        chrome.tabs.sendMessage(tabId, { action: 'result', error: data.error ?? 'No response.', message: data.message });
      }
    })
    .catch(err => chrome.tabs.sendMessage(tabId, { action: 'result', error: err.message }));
});
