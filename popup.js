const toggle = document.getElementById('deep-dive-toggle');
const status = document.getElementById('status');

function setStatus(active) {
  if (active) {
    status.innerHTML = '<span class="blink"></span>Deep Dive Active';
    status.className = 'status-line active';
  } else {
    status.textContent = 'Standard mode';
    status.className = 'status-line';
  }
}

chrome.storage.local.get('deepDive').then(({ deepDive }) => {
  toggle.checked = !!deepDive;
  setStatus(!!deepDive);
});

toggle.addEventListener('change', () => {
  const active = toggle.checked;
  chrome.storage.local.set({ deepDive: active });
  setStatus(active);
});
