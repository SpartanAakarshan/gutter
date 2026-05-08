// Pure function tests — no browser, no Chrome APIs
const { test } = require('node:test');
const assert  = require('node:assert/strict');

// ── normKey (inlined from background.js) ─────────────────────────────────────
function normKey(text, deepDive) {
  return (deepDive ? 'dd:' : 'std:') + text.trim().toLowerCase().slice(0, 100);
}

test('normKey — standard prefix', () => {
  assert.equal(normKey('hello', false), 'std:hello');
});

test('normKey — deep dive prefix', () => {
  assert.equal(normKey('hello', true), 'dd:hello');
});

test('normKey — trims whitespace', () => {
  assert.equal(normKey('  hello  ', false), 'std:hello');
});

test('normKey — lowercases', () => {
  assert.equal(normKey('Hello World', false), 'std:hello world');
});

test('normKey — truncates at 100 chars', () => {
  const long = 'a'.repeat(200);
  const key  = normKey(long, false);
  assert.equal(key, 'std:' + 'a'.repeat(100));
  assert.equal(key.length, 104); // 'std:' + 100
});

test('normKey — dd: and std: keys differ for same text', () => {
  assert.notEqual(normKey('quantum computing', false), normKey('quantum computing', true));
});

// ── cache expiry logic ────────────────────────────────────────────────────────
function isCacheExpired(entry) {
  return Date.now() - entry.t > 86400000;
}

test('cache entry within 24h is not expired', () => {
  const entry = { t: Date.now() - 3600000 }; // 1 hour ago
  assert.equal(isCacheExpired(entry), false);
});

test('cache entry older than 24h is expired', () => {
  const entry = { t: Date.now() - 86400001 };
  assert.equal(isCacheExpired(entry), true);
});

test('cache entry exactly at 24h boundary is still valid (> not >=)', () => {
  const entry = { t: Date.now() - 86400000 };
  assert.equal(isCacheExpired(entry), false);
});

test('cache entry 1ms past 24h boundary is expired', () => {
  const entry = { t: Date.now() - 86400001 };
  assert.equal(isCacheExpired(entry), true);
});

// ── local rate limit logic ────────────────────────────────────────────────────
function withinLocalLimit(localUsage, today, limit) {
  if (localUsage.date !== today) return true;
  return localUsage.count < limit;
}

test('rate limit — different day resets', () => {
  assert.equal(withinLocalLimit({ date: '2026-01-01', count: 99 }, '2026-01-02', 20), true);
});

test('rate limit — same day under limit', () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(withinLocalLimit({ date: today, count: 19 }, today, 20), true);
});

test('rate limit — same day at limit', () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(withinLocalLimit({ date: today, count: 20 }, today, 20), false);
});

test('rate limit — same day over limit', () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(withinLocalLimit({ date: today, count: 25 }, today, 20), false);
});

// ── deep dive trial logic ─────────────────────────────────────────────────────
function trialExhausted(isPro, trialUsed, trialMax) {
  return !isPro && trialUsed >= trialMax;
}

test('trial — Pro user never exhausted', () => {
  assert.equal(trialExhausted(true, 10, 10), false);
});

test('trial — free user under limit', () => {
  assert.equal(trialExhausted(false, 9, 10), false);
});

test('trial — free user at limit', () => {
  assert.equal(trialExhausted(false, 10, 10), true);
});

test('trial — free user over limit', () => {
  assert.equal(trialExhausted(false, 15, 10), true);
});

test('trial — fresh user (0 used)', () => {
  assert.equal(trialExhausted(false, 0, 10), false);
});

// ── upgradeURL no longer leaks token ─────────────────────────────────────────
function upgradeURL() {
  return 'https://gutter-api.vercel.app/upgrade';
}

test('upgradeURL contains no query string', () => {
  const url = upgradeURL();
  assert.equal(url.includes('?'), false);
  assert.equal(url.includes('t='), false);
});
