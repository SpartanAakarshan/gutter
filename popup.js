const toggle  = document.getElementById('dd-toggle');
const badge   = document.getElementById('badge');
const row     = document.getElementById('toggle-row');
const label   = document.getElementById('toggle-label');
const footer  = document.getElementById('footer');
const usageEl = document.getElementById('usage');

const TRIAL_MAX = 10;
const FREE_MAX  = 20;

function apply(active, isPro, trialUsed, searchesUsed) {
  const trialLeft   = Math.max(0, TRIAL_MAX - trialUsed);
  const searchesLeft = Math.max(0, FREE_MAX - searchesUsed);
  const trialDone   = !isPro && trialLeft === 0;

  toggle.checked     = active && !trialDone;
  toggle.disabled    = trialDone;
  badge.textContent  = (active && !trialDone) ? 'Deep Dive' : 'Standard';
  badge.className    = (active && !trialDone) ? 'mode-badge on' : 'mode-badge';
  row.className      = (active && !trialDone) ? 'toggle-row active' : 'toggle-row';
  label.textContent  = (active && !trialDone) ? 'On' : 'Off';
  label.className    = (active && !trialDone) ? 'toggle-label active' : 'toggle-label';
  footer.textContent = (active && !trialDone)
    ? 'Page context active — replies scoped to this page.'
    : 'Alt+Click any heading or selected text to use.';
  footer.className   = (active && !trialDone) ? 'footer active' : 'footer';

  if (!isPro) {
    usageEl.style.display = 'block';
    const trialLine   = trialDone
      ? 'Deep Dive trials used up — upgrade to unlock'
      : `${trialLeft} / ${TRIAL_MAX} Deep Dive trials remaining`;
    usageEl.innerHTML =
      `${searchesLeft} / ${FREE_MAX} searches left today<br>${trialLine}`;
  } else {
    usageEl.style.display = 'none';
  }
}

function load() {
  chrome.storage.local.get(['deepDive', 'isPro', 'deepDiveTrialUsed', 'localUsage']).then(
    ({ deepDive, isPro, deepDiveTrialUsed, localUsage }) => {
      const today = new Date().toISOString().slice(0, 10);
      const searchesUsed = (localUsage?.date === today) ? (localUsage?.count ?? 0) : 0;
      apply(!!deepDive, !!isPro, deepDiveTrialUsed ?? 0, searchesUsed);
    }
  );
}

load();

toggle.addEventListener('change', () => {
  const active = toggle.checked;
  chrome.storage.local.set({ deepDive: active });
  load();
});
