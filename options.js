const SUPABASE_URL  = 'https://krirwdkqjezbzyythioq.supabase.co';
const SUPABASE_ANON = 'sb_publishable_FjoiQluqAIe3hl3ufdWfaA_BJGr7e5b';
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

async function checkSession() {
  const { token, email, hasKey } = await chrome.storage.local.get(['token', 'email', 'hasKey']);
  if (!token) {
    loggedOutEl.style.display = 'block';
    loggedInEl.style.display  = 'none';
    return;
  }
  loggedOutEl.style.display = 'none';
  loggedInEl.style.display  = 'block';
  userEmailEl.textContent   = email ?? '';
  keyConfigured.style.display = hasKey ? 'block' : 'none';
  keyMissing.style.display    = hasKey ? 'none'  : 'block';
}

document.getElementById('btn-google').addEventListener('click', () => {
  showStatus('Opening sign-in…');

  const redirectURL = chrome.identity.getRedirectURL();
  const oauthURL    = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectURL)}`;

  chrome.identity.launchWebAuthFlow({ url: oauthURL, interactive: true }, async (redirectUrl) => {
    if (chrome.runtime.lastError || !redirectUrl) {
      showStatus('Sign in cancelled or failed.', true);
      return;
    }

    const hash         = new URL(redirectUrl).hash.substring(1);
    const params       = new URLSearchParams(hash);
    const token        = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!token) {
      showStatus('No token received. Try again.', true);
      return;
    }

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_ANON }
    });
    const user = await userRes.json();

    await chrome.storage.local.set({ token, refreshToken, email: user.email, hasKey: false });
    showStatus('Signed in.');
    checkSession();
  });
});

document.getElementById('btn-save-key').addEventListener('click', async () => {
  const apiKey = document.getElementById('api-key').value.trim();
  if (!apiKey || apiKey.length < 10) {
    showStatus('Enter a valid API key.', true);
    return;
  }

  const btn = document.getElementById('btn-save-key');
  btn.disabled = true;
  showStatus('Saving…');

  const { token } = await chrome.storage.local.get('token');
  const res  = await fetch(`${API_BASE}/keys`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body:    JSON.stringify({ apiKey, provider: 'gemini' })
  });
  const data = await res.json();
  btn.disabled = false;

  if (data.success) {
    await chrome.storage.local.set({ hasKey: true });
    document.getElementById('api-key').value = '';
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
  const res  = await fetch(`${API_BASE}/keys`, {
    method:  'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();

  if (data.success) {
    await chrome.storage.local.set({ hasKey: false });
    showStatus('Key removed.');
    checkSession();
  } else {
    showStatus(data.error ?? 'Failed to remove key.', true);
  }
});

document.getElementById('btn-logout').addEventListener('click', async () => {
  await chrome.storage.local.remove(['token', 'email', 'refreshToken', 'hasKey']);
  showStatus('Logged out.');
  checkSession();
});

checkSession();
