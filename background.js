const PROXY_URL    = 'https://gutter-api.vercel.app/api/explain';
const STATUS_URL   = 'https://gutter-api.vercel.app/api/status';
const REFRESH_URL  = 'https://zwetyinnzamzmsvnraax.supabase.co/auth/v1/token?grant_type=refresh_token';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3ZXR5aW5uemFtem1zdm5yYWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NzQwNjAsImV4cCI6MjA5MzQ1MDA2MH0.hFjRaqJ-y3cbyKu5Jw6IzREfOBRKOpFynuaxinuJyJM';

const CACHE_MAX            = 5;
const LOCAL_LIMIT          = 20;
const DEEP_DIVE_TRIAL_MAX  = 10;

function normKey(text, deepDive) {
  return (deepDive ? 'dd:' : 'std:') + text.trim().toLowerCase().slice(0, 100);
}

async function getCached(text, deepDive) {
  const { summaryCache = [] } = await chrome.storage.local.get('summaryCache');
  const entry = summaryCache.find(e => e.k === normKey(text, deepDive));
  if (!entry) return null;
  if (Date.now() - entry.t > 86400000) return null;
  return entry.r;
}

async function storeCached(text, result, deepDive) {
  const { summaryCache = [] } = await chrome.storage.local.get('summaryCache');
  const key = normKey(text, deepDive);
  const filtered = summaryCache.filter(e => e.k !== key);
  filtered.unshift({ k: key, r: result, t: Date.now() });
  await chrome.storage.local.set({ summaryCache: filtered.slice(0, CACHE_MAX) });
}

async function checkLocalLimit() {
  const { hasKey } = await chrome.storage.local.get('hasKey');
  if (hasKey) return true;
  const today = new Date().toISOString().slice(0, 10);
  const { localUsage = { date: '', count: 0 } } = await chrome.storage.local.get('localUsage');
  if (localUsage.date !== today) return true;
  return localUsage.count < LOCAL_LIMIT;
}

async function incrementLocalCount() {
  const { hasKey } = await chrome.storage.local.get('hasKey');
  if (hasKey) return;
  const today = new Date().toISOString().slice(0, 10);
  const { localUsage = { date: '', count: 0 } } = await chrome.storage.local.get('localUsage');
  const count = localUsage.date === today ? localUsage.count + 1 : 1;
  await chrome.storage.local.set({ localUsage: { date: today, count } });
}

async function fetchPlanStatus(token) {
  try {
    const r = await fetch(STATUS_URL, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!r.ok) return;
    const { isPro } = await r.json();
    await chrome.storage.local.set({ isPro: !!isPro });
  } catch {}
}

// Fetch plan on startup if token exists
chrome.storage.local.get('token').then(({ token }) => {
  if (token) fetchPlanStatus(token);
}).catch(() => {});

// Inject content script into already-open tabs after login
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.token) return;
  const wasLoggedOut = !changes.token.oldValue;
  const nowLoggedIn  = !!changes.token.newValue;
  if (!wasLoggedOut || !nowLoggedIn) return;
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (!tab.url || !/^https?:/.test(tab.url)) continue;
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      }).catch(() => {});
    }
  });
});

async function refreshToken() {
  const { refreshToken } = await chrome.storage.local.get('refreshToken');
  if (!refreshToken) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  let r;
  try {
    r = await fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON },
      body: JSON.stringify({ refresh_token: refreshToken }),
      signal: controller.signal
    });
  } catch {
    clearTimeout(timer);
    return null;
  }
  clearTimeout(timer);

  const data = await r.json().catch(() => ({}));
  if (!data.access_token) return null;

  await chrome.storage.local.set({
    token: data.access_token,
    refreshToken: data.refresh_token
  });

  fetchPlanStatus(data.access_token);
  return data.access_token;
}

async function callProxy(text, meta = null, retries = 1) {
  let { token } = await chrome.storage.local.get('token');

  if (!token) {
    return { error: 'Not logged in. Open extension options to sign in.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let r;
  try {
    r = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text, ...(meta && { meta }) }),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timer);
    return { error: e.name === 'AbortError' ? 'Request timed out.' : e.message };
  }
  clearTimeout(timer);

  if (r.status === 401) {
    const newToken = await refreshToken();
    if (newToken && retries > 0) {
      return callProxy(text, meta, retries - 1);
    }
    await chrome.storage.local.remove(['token', 'email', 'refreshToken']);
    return { error: 'Session expired. Please log in again via extension options.' };
  }

  if (r.status === 503 && retries > 0) {
    await new Promise(res => setTimeout(res, 3000));
    return callProxy(text, meta, retries - 1);
  }

  return r.json();
}

async function getSessionMeta(tabId) {
  const key = `meta_${tabId}`;
  const result = await chrome.storage.session.get(key);
  return result[key] ?? null;
}

async function storeSessionMeta(tabId, meta) {
  await chrome.storage.session.set({ [`meta_${tabId}`]: meta });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(`meta_${tabId}`);
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action !== 'explain') return;

  const tabId = sender.tab?.id;
  if (!tabId) return;

  (async () => {
    if (typeof message.text !== 'string' || !message.text) return;

    if (message.meta) await storeSessionMeta(tabId, message.meta);

    const { deepDive } = await chrome.storage.local.get('deepDive');
    const isDeepDive = !!deepDive;

    const cached = await getCached(message.text, isDeepDive);
    if (cached) {
      chrome.tabs.sendMessage(tabId, { action: 'result', result: cached }).catch(() => {});
      return;
    }

    // Deep Dive trial gate for non-Pro users
    if (isDeepDive) {
      const { isPro, deepDiveTrialUsed = 0 } = await chrome.storage.local.get(['isPro', 'deepDiveTrialUsed']);
      if (!isPro && deepDiveTrialUsed >= DEEP_DIVE_TRIAL_MAX) {
        chrome.tabs.sendMessage(tabId, {
          action: 'result',
          error: 'UPGRADE_REQUIRED',
          message: `You've used all ${DEEP_DIVE_TRIAL_MAX} Deep Dive trials. Upgrade to Pro for unlimited.`
        }).catch(() => {});
        return;
      }
    }

    const allowed = await checkLocalLimit();
    if (!allowed) {
      chrome.tabs.sendMessage(tabId, {
        action: 'result',
        error: 'NO_API_KEY',
        message: "You've hit the daily limit. Add your API key in options — it's free to get one."
      }).catch(() => {});
      return;
    }

    const meta = isDeepDive ? await getSessionMeta(tabId) : null;

    try {
      const data = await callProxy(message.text, meta);
      if (data.result) {
        await storeCached(message.text, data.result, isDeepDive);
        await incrementLocalCount();

        if (isDeepDive) {
          const { isPro, deepDiveTrialUsed = 0 } = await chrome.storage.local.get(['isPro', 'deepDiveTrialUsed']);
          if (!isPro) await chrome.storage.local.set({ deepDiveTrialUsed: deepDiveTrialUsed + 1 });
        }

        chrome.tabs.sendMessage(tabId, { action: 'result', result: data.result, remaining: data.remaining ?? null }).catch(() => {});
      } else {
        chrome.tabs.sendMessage(tabId, { action: 'result', error: data.error ?? 'No response.', message: data.message }).catch(() => {});
      }
    } catch (err) {
      chrome.tabs.sendMessage(tabId, { action: 'result', error: err.message }).catch(() => {});
    }
  })();
});
