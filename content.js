let tooltipHost = null;
let tooltipShadow = null;
let tooltipBox = null;

// ── Deep Dive floating widget ────────────────────────────────────────────────
let _widgetHost = null;

function buildWidget(isPro, deepDiveOn) {
  if (_widgetHost) _widgetHost.remove();

  const host = document.createElement('div');
  host.id = 'gutter-widget';
  host.style.cssText = 'position:fixed;top:14px;right:14px;z-index:2147483646;pointer-events:auto;';
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .widget {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #000000;
      border: 1px solid ${deepDiveOn ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.18)'};
      padding: 5px 10px 5px 8px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 9px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: ${deepDiveOn ? '#ffffff' : 'rgba(255,255,255,0.35)'};
      cursor: pointer;
      user-select: none;
      transition: border-color 100ms, color 100ms;
      white-space: nowrap;
    }
    .widget:hover {
      border-color: rgba(255,255,255,0.6);
      color: rgba(255,255,255,0.8);
    }
    .dot {
      width: 5px; height: 5px;
      background: ${deepDiveOn ? '#ffffff' : 'rgba(255,255,255,0.2)'};
      border-radius: 50%;
      flex-shrink: 0;
      ${deepDiveOn ? 'animation: pulse 1.4s ease-in-out infinite;' : ''}
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    .lock { font-size: 8px; opacity: 0.4; }
  `;

  const btn = document.createElement('div');
  btn.className = 'widget';

  const dot = document.createElement('span');
  dot.className = 'dot';

  const label = document.createElement('span');

  if (!isPro) {
    label.textContent = 'Deep Dive';
    const lock = document.createElement('span');
    lock.className = 'lock';
    lock.textContent = '⊘ Pro';
    btn.appendChild(dot);
    btn.appendChild(label);
    btn.appendChild(lock);
    btn.addEventListener('click', () => {
      window.open('https://gutter-api.vercel.app/upgrade', '_blank');
    });
  } else {
    label.textContent = deepDiveOn ? 'Deep Dive: On' : 'Deep Dive: Off';
    btn.appendChild(dot);
    btn.appendChild(label);
    btn.addEventListener('click', () => {
      const next = !_deepDive;
      _deepDive = next;
      _metaSent = false;
      chrome.storage.local.set({ deepDive: next });
      buildWidget(true, next);
    });
  }

  shadow.appendChild(style);
  shadow.appendChild(btn);
  document.documentElement.appendChild(host);
  _widgetHost = host;
}

function initWidget() {
  chrome.storage.local.get(['isPro', 'deepDive', 'token']).then(({ isPro, deepDive, token }) => {
    if (!token) return;
    buildWidget(!!isPro, !!deepDive);
  }).catch(() => {});
}

initWidget();
// ─────────────────────────────────────────────────────────────────────────────

function buildTooltip() {
  const host = document.createElement('div');
  host.id = 'gutter-host';
  host.style.cssText = 'position:absolute;z-index:2147483647;display:none;pointer-events:none;';

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .box {
      background: #000000;
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.75);
      border-radius: 2px;
      padding: 14px 16px;
      max-width: 300px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.7;
      box-shadow: 0 4px 24px rgba(0,0,0,0.9);
      pointer-events: auto;
      letter-spacing: 0.03em;
    }
    .label {
      font-size: 10px;
      color: rgba(255,255,255,0.35);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.25em;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .close {
      float: right;
      background: none;
      border: 1px solid rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.35);
      cursor: pointer;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      line-height: 1;
      padding: 2px 5px;
      margin-left: 8px;
      margin-top: -2px;
    }
    .close:hover {
      color: #ffffff;
      background: rgba(255,255,255,0.08);
      border-color: rgba(255,255,255,0.5);
    }
    .loading {
      color: rgba(255,255,255,0.35);
      animation: cp-pulse 1.2s step-end infinite;
    }
    @keyframes cp-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  `;

  const box = document.createElement('div');
  box.className = 'box';

  shadow.appendChild(style);
  shadow.appendChild(box);
  document.documentElement.appendChild(host);

  tooltipHost = host;
  tooltipShadow = shadow;
  tooltipBox = box;
}

function positionTooltip(x, y) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x + 14;
  let top = y + 14;
  if (left + 320 > vw) left = x - 320;
  if (top + 140 > vh) top = y - 140;
  tooltipHost.style.left = Math.max(8, left + window.scrollX) + 'px';
  tooltipHost.style.top = Math.max(8, top + window.scrollY) + 'px';
}

function showLoading() {
  const closeBtn = document.createElement('button');
  closeBtn.className = 'close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', hide);

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = 'Gutter';

  const loading = document.createElement('span');
  loading.className = 'loading';
  loading.textContent = 'Pulling context…';

  tooltipBox.innerHTML = '';
  tooltipBox.appendChild(closeBtn);
  tooltipBox.appendChild(label);
  tooltipBox.appendChild(loading);
}

function show(x, y) {
  if (!tooltipHost) buildTooltip();
  positionTooltip(x, y);
  showLoading();
  tooltipHost.style.display = 'block';
}

function buildBox(labelText, bodyText, footerText = null, footerHref = null) {
  if (!tooltipHost) return;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', hide);

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = labelText;

  const body = document.createElement('div');
  body.textContent = bodyText;

  tooltipBox.innerHTML = '';
  tooltipBox.appendChild(closeBtn);
  tooltipBox.appendChild(label);
  tooltipBox.appendChild(body);

  if (footerText) {
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:8px;font-size:10px;color:#3a3a99;';
    if (footerHref) {
      const a = document.createElement('a');
      a.href = footerHref;
      a.target = '_blank';
      a.textContent = footerText;
      a.style.cssText = 'color:#6666ff;text-decoration:none;';
      footer.appendChild(a);
    } else {
      footer.textContent = footerText;
    }
    tooltipBox.appendChild(footer);
  }
}

function update(text, remaining = null) {
  const footer = remaining !== null && remaining <= 3
    ? `${remaining} free search${remaining === 1 ? '' : 'es'} left — upgrade for $5/mo`
    : null;
  buildBox('Gutter', text, footer);
}

let _sessionToken = null;
let _deepDive = false;
chrome.storage.local.get(['token', 'deepDive']).then(({ token, deepDive }) => {
  _sessionToken = token ?? null;
  _deepDive = !!deepDive;
}).catch(() => {});

// Deep Dive: scraped once per page load, only when mode is active
let _metaSent = false;

function scrapePageMetadata() {
  const cap = (s) => (s ?? '').trim().slice(0, 200);
  return {
    title:    cap(document.title),
    metaDesc: cap(document.querySelector('meta[name="description"]')?.content),
    ogDesc:   cap(document.querySelector('meta[property="og:description"]')?.content),
    h1:       cap(document.querySelector('h1')?.innerText)
  };
}

function upgradeURL() {
  const base = 'https://gutter-api.vercel.app/upgrade';
  return _sessionToken ? `${base}?t=${encodeURIComponent(_sessionToken)}` : base;
}

function updateUpgrade(message) {
  buildBox('Upgrade Required', message, 'Get unlimited access →', upgradeURL());
}

function updateError(message) {
  buildBox('Lost Signal', message);
}

function hide() {
  if (tooltipHost) tooltipHost.style.display = 'none';
}

let pendingTimer = null;

function askGemini(text, x, y) {
  if (!navigator.onLine) {
    if (!tooltipHost) buildTooltip();
    positionTooltip(x, y);
    tooltipHost.style.display = 'block';
    updateError('No connection. Check your network and try again.');
    return;
  }
  const trimmed = text.slice(0, 2000);
  show(x, y);
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => updateError('Timed out. Try again.'), 20000);

  const msg = { action: 'explain', text: trimmed };
  if (_deepDive && !_metaSent) {
    msg.meta = scrapePageMetadata();
    _metaSent = true;
  }
  try {
    chrome.runtime.sendMessage(msg);
  } catch (e) {
    clearTimeout(pendingTimer);
    updateError('Extension updated — reload the page and try again.');
  }
}

// Receive result pushed back from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action !== 'result') return;
  clearTimeout(pendingTimer);
  if (message.error === 'UPGRADE_REQUIRED' || message.error === 'NO_API_KEY') {
    updateUpgrade(message.message);
  } else if (message.result) {
    update(message.result, message.remaining);
  } else {
    updateError(message.error ?? 'Unknown error. Try again.');
  }
});

function attachHeader(el) {
  if (el.dataset.cpAttached) return;
  el.dataset.cpAttached = 'true';

  el.addEventListener('mouseenter', () => document.body.classList.add('gutter-mode'));
  el.addEventListener('mouseleave', () => document.body.classList.remove('gutter-mode'));

  el.addEventListener('click', (e) => {
    if (!e.altKey) return;
    e.preventDefault();
    e.stopPropagation();

    const text = el.innerText.trim().slice(0, 100);
    if (!text) return;
    setTimeout(() => askGemini(text, e.clientX, e.clientY), 200);
  });
}

const SELECTOR = 'h1, h2, h3, b, strong';

function scanRoot(root) {
  root.querySelectorAll(SELECTOR).forEach(attachHeader);
  root.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) scanRoot(el.shadowRoot);
  });
}

function processNode(node) {
  if (node.nodeType !== 1) return;
  if (/^(H[123]|B|STRONG)$/.test(node.tagName)) attachHeader(node);
  node.querySelectorAll?.(SELECTOR).forEach(attachHeader);
  if (node.shadowRoot) scanRoot(node.shadowRoot);
}

// Initial scan
scanRoot(document);

// SPA + Shadow DOM support
const observer = new MutationObserver((mutations) => {
  for (const { addedNodes } of mutations) {
    for (const node of addedNodes) processNode(node);
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

// Capture selection on mousedown — click event clears it before handler fires
let _savedSelection = '';
document.addEventListener('mousedown', (e) => {
  if (e.altKey) _savedSelection = window.getSelection()?.toString().trim() ?? '';
});

// Alt+Click on any selected text → explain selection
document.addEventListener('click', (e) => {
  if (!e.altKey) return;
  const selection = _savedSelection || window.getSelection()?.toString().trim();
  _savedSelection = '';
  if (!selection || selection.length < 10) return;
  e.preventDefault();
  setTimeout(() => askGemini(selection, e.clientX, e.clientY), 200);
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) document.body.classList.remove('gutter-mode');
});
