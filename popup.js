const toggle   = document.getElementById('dd-toggle');
const badge    = document.getElementById('badge');
const row      = document.getElementById('toggle-row');
const label    = document.getElementById('toggle-label');
const footer   = document.getElementById('footer');

function apply(active) {
  toggle.checked = active;
  badge.textContent  = active ? 'Deep Dive' : 'Standard';
  badge.className    = active ? 'mode-badge on' : 'mode-badge';
  row.className      = active ? 'toggle-row active' : 'toggle-row';
  label.textContent  = active ? 'On' : 'Off';
  label.className    = active ? 'toggle-label active' : 'toggle-label';
  footer.textContent = active
    ? 'Page context active — replies scoped to this page.'
    : 'Alt+Click any heading or selected text to use.';
  footer.className   = active ? 'footer active' : 'footer';
}

chrome.storage.local.get('deepDive').then(({ deepDive }) => apply(!!deepDive));

toggle.addEventListener('change', () => {
  const active = toggle.checked;
  chrome.storage.local.set({ deepDive: active });
  apply(active);
});
