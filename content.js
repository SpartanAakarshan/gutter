let tooltipHost = null;
let tooltipShadow = null;
let tooltipBox = null;

function buildTooltip() {
  const host = document.createElement('div');
  host.id = 'gutter-host';
  host.style.cssText = 'position:absolute;z-index:2147483647;display:none;pointer-events:none;';

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .box {
      background: #03030f;
      color: #b8b8ff;
      border: 1px solid #4a4aff;
      border-radius: 2px;
      padding: 14px 16px;
      max-width: 300px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      line-height: 1.7;
      box-shadow:
        0 0 0 1px #1a1a6e,
        0 0 16px rgba(80, 80, 255, 0.35),
        0 0 40px rgba(50, 50, 200, 0.12),
        inset 0 0 20px rgba(0, 0, 40, 0.6);
      pointer-events: auto;
      letter-spacing: 0.03em;
    }
    .label {
      font-size: 10px;
      color: #6666ff;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.25em;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #1e1e6e;
    }
    .close {
      float: right;
      background: none;
      border: 1px solid #3333aa;
      color: #5555cc;
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
      background: #2222aa;
      border-color: #8888ff;
    }
    .loading {
      color: #3a3a99;
      animation: cp-pulse 1.2s step-end infinite;
    }
    @keyframes cp-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
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
  loading.textContent = 'Finding…';

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

function updateUpgrade(message) {
  buildBox('Upgrade Required', message, 'Get unlimited access →', 'https://gutter-api.vercel.app/upgrade');
}

function hide() {
  if (tooltipHost) tooltipHost.style.display = 'none';
}

let pendingTimer = null;

function askGemini(text, x, y) {
  const trimmed = text.slice(0, 2000);
  show(x, y);
  clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => update('Timed out. Try again.'), 20000);
  chrome.runtime.sendMessage({ action: 'explain', text: trimmed });
}

// Receive result pushed back from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action !== 'result') return;
  clearTimeout(pendingTimer);
  if (message.error === 'UPGRADE_REQUIRED') {
    updateUpgrade(message.message);
  } else if (message.result) {
    update(message.result, message.remaining);
  } else {
    update('Error: ' + (message.error ?? 'unknown'));
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

    const text = el.innerText.trim();
    if (!text) return;
    askGemini(text, e.clientX, e.clientY);
  });
}

const SELECTOR = 'h1, h2, h3, b, strong';

// Initial scan
document.querySelectorAll(SELECTOR).forEach(attachHeader);

// SPA support — catch elements added after load
const observer = new MutationObserver((mutations) => {
  for (const { addedNodes } of mutations) {
    for (const node of addedNodes) {
      if (node.nodeType !== 1) continue;
      if (/^(H[123]|B|STRONG)$/.test(node.tagName)) attachHeader(node);
      node.querySelectorAll?.(SELECTOR).forEach(attachHeader);
    }
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

// Alt+Click on any selected text → explain selection
document.addEventListener('click', (e) => {
  if (!e.altKey) return;
  const selection = window.getSelection()?.toString().trim();
  if (!selection || selection.length < 10) return;
  e.preventDefault();
  askGemini(selection, e.clientX, e.clientY);
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
