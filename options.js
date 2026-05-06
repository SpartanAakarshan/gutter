const SUPABASE_URL  = 'https://zwetyinnzamzmsvnraax.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZXR5aW5uemFtem1zdm5yYWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NzQwNjAsImV4cCI6MjA5MzQ1MDA2MH0.hFjRaqJ-y3cbyKu5Jw6IzREfOBRKOpFynuaxinuJyJM';
const API_BASE      = 'https://gutter-api.vercel.app/api';

const statusEl      = document.getElementById('status');
const loggedInEl    = document.getElementById('logged-in');
const loggedOutEl   = document.getElementById('logged-out');
const userEmailEl   = document.getElementById('user-email');
const keyConfigured = document.getElementById('key-configured');
const keyMissing    = document.getElementById('key-missing');

function showStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? 'err' : 'ok';
}

const PROVIDER_LABELS = {
  gemini: 'Gemini (Google)',
  openai: 'OpenAI',
  claude: 'Claude (Anthropic)',
  grok:   'Grok (xAI)'
};

async function checkSession() {
  const { token, email, hasKey, activeProvider } = await chrome.storage.local.get(['token', 'email', 'hasKey', 'activeProvider']);
  if (!token) {
    loggedOutEl.style.display = 'block';
    loggedInEl.style.display  = 'none';
    return;
  }
  loggedOutEl.style.display   = 'none';
  loggedInEl.style.display    = 'block';
  userEmailEl.textContent     = email ?? '';
  keyConfigured.style.display = hasKey ? 'block' : 'none';
  keyMissing.style.display    = hasKey ? 'none'  : 'block';
  if (hasKey && activeProvider) {
    document.getElementById('key-status-text').textContent =
      `${PROVIDER_LABELS[activeProvider] ?? activeProvider} key configured`;
  }
}

async function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function fetchWithTimeout(url, options, ms = 8000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

async function handleTokens(token, refreshToken) {
  let email = '';
  try {
    const userRes = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON }
    });
    if (userRes.ok) {
      const user = await userRes.json();
      email = user.email ?? '';
    }
  } catch {}
  await chrome.storage.local.set({ token, refreshToken, email, hasKey: false });
  showStatus('Signed in.');
  checkSession();
}

document.getElementById('btn-google').addEventListener('click', async () => {
  showStatus('Opening sign-in…');

  const redirectURL   = chrome.identity.getRedirectURL();
  const codeVerifier  = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  await chrome.storage.local.set({ pkce_verifier: codeVerifier });

  const oauthURL = `${SUPABASE_URL}/auth/v1/authorize?` + new URLSearchParams({
    provider:              'google',
    redirect_to:           redirectURL,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256'
  });

  chrome.identity.launchWebAuthFlow({ url: oauthURL, interactive: true }, async (redirectUrl) => {
    try {
      if (chrome.runtime.lastError || !redirectUrl) {
        showStatus('Sign in cancelled or failed.', true);
        return;
      }

      const url  = new URL(redirectUrl);
      const code = url.searchParams.get('code');

      if (!code) {
        showStatus('No auth code received. Try again.', true);
        return;
      }

      const { pkce_verifier } = await chrome.storage.local.get('pkce_verifier');
      await chrome.storage.local.remove('pkce_verifier');

      const res  = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
        body:    JSON.stringify({ auth_code: code, code_verifier: pkce_verifier })
      });
      const data = await res.json();

      if (!data.access_token) {
        showStatus(data.error_description ?? data.message ?? data.error ?? 'Token exchange failed.', true);
        return;
      }

      await handleTokens(data.access_token, data.refresh_token);
    } catch (err) {
      showStatus('Error: ' + err.message, true);
    }
  });
});

const PLACEHOLDERS = {
  gemini: 'AIzaSy...',
  openai: 'sk-...',
  claude: 'sk-ant-...',
  grok:   'xai-...'
};

const providerEl = document.getElementById('provider');
const apiKeyEl   = document.getElementById('api-key');

providerEl.addEventListener('change', () => {
  apiKeyEl.placeholder = PLACEHOLDERS[providerEl.value] ?? '';
});

document.getElementById('btn-save-key').addEventListener('click', async () => {
  const apiKey   = apiKeyEl.value.trim();
  const provider = providerEl.value;

  if (!apiKey || apiKey.length < 10) {
    showStatus('Enter a valid API key.', true);
    return;
  }

  const btn = document.getElementById('btn-save-key');
  btn.disabled = true;
  showStatus('Saving…');

  const { token } = await chrome.storage.local.get('token');
  const res  = await fetchWithTimeout(`${API_BASE}/keys`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body:    JSON.stringify({ apiKey, provider })
  });
  const data = await res.json();
  btn.disabled = false;

  if (data.success) {
    await chrome.storage.local.set({ hasKey: true, activeProvider: data.provider });
    apiKeyEl.value = '';
    showStatus('API key saved.');
    checkSession();
  } else {
    showStatus(data.error ?? 'Failed to save key.', true);
  }
});

document.getElementById('btn-remove-key').addEventListener('click', async () => {
  if (!confirm('Remove your API key?')) return;

  showStatus('Removing…');
  const { token } = await chrome.storage.local.get('token');
  const res  = await fetchWithTimeout(`${API_BASE}/keys`, {
    method:  'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();

  if (data.success) {
    await chrome.storage.local.set({ hasKey: false, activeProvider: null });
    showStatus('Key removed.');
    checkSession();
  } else {
    showStatus(data.error ?? 'Failed to remove key.', true);
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await chrome.storage.local.remove(['token', 'email', 'refreshToken', 'hasKey', 'pkce_verifier', 'activeProvider']);
  showStatus('Logged out.');
  checkSession();
});

checkSession();
