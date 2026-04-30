/* EdgeIQ — Popup Controller */
(function () {
  'use strict';

  const DEFAULT_BACKEND = 'https://edgeiq-production-6e47.up.railway.app';

  // ── Nav ──────────────────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`panel-${tab}`).classList.add('active');
    });
  });

  // ── Load backend URL from storage ────────────────────────────────────────────
  function getBackendUrl(cb) {
    chrome.storage.sync.get('backendUrl', (r) => cb(r.backendUrl || DEFAULT_BACKEND));
  }

  function saveBackendUrl(url, cb) {
    chrome.storage.sync.set({ backendUrl: url }, cb);
  }

  // ── Tab status ───────────────────────────────────────────────────────────────
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const url = tab ? (tab.url || '') : '';

    const dot = document.getElementById('tab-dot');
    const statusEl = document.getElementById('tab-status');
    const urlEl = document.getElementById('tab-url');
    const iconEl = document.getElementById('tab-icon');

    let shortUrl = '';
    try {
      const parsed = new URL(url);
      shortUrl = parsed.hostname + parsed.pathname.replace(/\/$/, '');
    } catch (_) {
      shortUrl = url.slice(0, 50);
    }

    if (/tab\.com\.au\/(racing|sports)/i.test(url)) {
      dot.className = 'dot green';
      statusEl.className = 'scard-value green';
      statusEl.textContent = 'Active — Ready to Analyse';
      iconEl.className = 'scard-icon green';
      iconEl.textContent = '🏇';
    } else if (url.includes('tab.com.au')) {
      dot.className = 'dot amber';
      statusEl.className = 'scard-value amber';
      statusEl.textContent = 'On TAB — go to Racing or Sports';
      iconEl.className = 'scard-icon amber';
      iconEl.textContent = '🌐';
    } else {
      dot.className = 'dot gray';
      statusEl.className = 'scard-value gray';
      statusEl.textContent = 'Not on TAB.com.au';
      iconEl.className = 'scard-icon gray';
      iconEl.textContent = '🌐';
    }

    urlEl.textContent = shortUrl;
  });

  // ── Backend health check ─────────────────────────────────────────────────────
  function checkBackend(backendUrl, onResult) {
    const start = Date.now();
    fetch(`${backendUrl}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(6000),
    })
      .then((r) => {
        const ms = Date.now() - start;
        onResult(r.ok, ms, r.ok ? null : `HTTP ${r.status}`);
      })
      .catch((err) => {
        onResult(false, null, err.message || 'Unreachable');
      });
  }

  function renderBackendStatus(ok, ms, errMsg, backendUrl) {
    const dot = document.getElementById('backend-dot');
    const statusEl = document.getElementById('backend-status');
    const urlDisplayEl = document.getElementById('backend-url-display');
    const ftrEl = document.getElementById('ftr-backend');

    // Config panel health row
    const healthUrl = document.getElementById('health-url-display');
    const healthStatus = document.getElementById('health-status');

    let shortUrl = '';
    try { shortUrl = new URL(backendUrl).hostname; } catch (_) { shortUrl = backendUrl; }

    urlDisplayEl.textContent = shortUrl;
    if (healthUrl) healthUrl.textContent = shortUrl;
    if (ftrEl) ftrEl.textContent = shortUrl;

    if (ok) {
      dot.className = 'dot green';
      statusEl.className = 'scard-value green';
      statusEl.textContent = `Connected  ${ms}ms`;
      if (healthStatus) { healthStatus.className = 'health-val ok'; healthStatus.textContent = `✓ ${ms}ms`; }
    } else {
      dot.className = 'dot red';
      statusEl.className = 'scard-value red';
      statusEl.textContent = errMsg || 'Unreachable';
      if (healthStatus) { healthStatus.className = 'health-val err'; healthStatus.textContent = '✗ Error'; }
    }
  }

  // ── Fetch stats from backend ─────────────────────────────────────────────────
  function loadStats(backendUrl) {
    const balEl = document.getElementById('stat-balance');
    const betsEl = document.getElementById('stat-bets');
    const wrEl = document.getElementById('stat-winrate');

    Promise.all([
      fetch(`${backendUrl}/api/bankroll/balance`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`${backendUrl}/api/bets/active`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch(`${backendUrl}/api/bankroll/stats`, { signal: AbortSignal.timeout(5000) }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([balData, betsData, statsData]) => {
      if (balData && balData.data != null) {
        const bal = balData.data.balance ?? balData.data;
        balEl.className = 'stat-num';
        balEl.textContent = typeof bal === 'number' ? `$${bal.toFixed(0)}` : '—';
      } else {
        balEl.textContent = '—';
      }

      if (betsData && Array.isArray(betsData.data)) {
        betsEl.className = 'stat-num';
        betsEl.textContent = betsData.data.length;
      } else {
        betsEl.textContent = '—';
      }

      if (statsData && statsData.data) {
        const s = statsData.data;
        const wr = s.win_rate != null ? `${Math.round(s.win_rate * 100)}%` : '—';
        wrEl.className = 'stat-num';
        wrEl.textContent = wr;
      } else {
        wrEl.textContent = '—';
      }
    });
  }

  // ── Init with stored URL ─────────────────────────────────────────────────────
  getBackendUrl((url) => {
    const inp = document.getElementById('backendUrlInput');
    if (inp) inp.value = url;

    // Status panel backend check
    document.getElementById('backend-status').textContent = 'Checking…';
    checkBackend(url, (ok, ms, err) => renderBackendStatus(ok, ms, err, url));
    loadStats(url);

    // Config panel URL display
    const healthUrl = document.getElementById('health-url-display');
    if (healthUrl) {
      try { healthUrl.textContent = new URL(url).hostname; } catch (_) { healthUrl.textContent = url; }
    }

    // App link
    const appBtn = document.getElementById('btn-open-app');
    if (appBtn) appBtn.href = url;
  });

  // ── Refresh stats button ─────────────────────────────────────────────────────
  document.getElementById('btn-refresh-stats').addEventListener('click', (e) => {
    e.preventDefault();
    const btn = e.currentTarget;
    btn.style.opacity = '0.5';
    getBackendUrl((url) => {
      checkBackend(url, (ok, ms, err) => {
        renderBackendStatus(ok, ms, err, url);
        btn.style.opacity = '1';
      });
      loadStats(url);
    });
  });

  // ── Config panel: save URL ────────────────────────────────────────────────────
  function showFeedback(id, msg, isErr) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = `feedback ${isErr ? 'err' : 'ok'}`;
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => { el.textContent = ''; el.style.opacity = '1'; }, 400); }, 2500);
  }

  document.getElementById('saveUrlBtn').addEventListener('click', () => {
    const url = document.getElementById('backendUrlInput').value.trim();
    if (!url) { showFeedback('urlFeedback', 'Enter a URL', true); return; }
    try { new URL(url); } catch (_) { showFeedback('urlFeedback', 'Invalid URL — include https://', true); return; }

    saveBackendUrl(url, () => {
      if (chrome.runtime.lastError) {
        showFeedback('urlFeedback', 'Save failed: ' + chrome.runtime.lastError.message, true);
      } else {
        showFeedback('urlFeedback', '✓ Saved');
        const healthUrl = document.getElementById('health-url-display');
        if (healthUrl) { try { healthUrl.textContent = new URL(url).hostname; } catch (_) {} }
      }
    });
  });

  document.getElementById('backendUrlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('saveUrlBtn').click();
  });

  // ── Test connection button ────────────────────────────────────────────────────
  document.getElementById('testConnectionBtn').addEventListener('click', () => {
    const url = document.getElementById('backendUrlInput').value.trim() || DEFAULT_BACKEND;
    const healthStatus = document.getElementById('health-status');
    if (healthStatus) {
      healthStatus.className = 'health-val loading';
      healthStatus.innerHTML = '<span class="spin"></span>';
    }
    showFeedback('urlFeedback', 'Testing…');
    checkBackend(url, (ok, ms, err) => {
      renderBackendStatus(ok, ms, err, url);
      if (ok) {
        showFeedback('urlFeedback', `✓ Connected in ${ms}ms`);
      } else {
        showFeedback('urlFeedback', `✗ ${err}`, true);
      }
    });
  });

  // ── Reset to default ──────────────────────────────────────────────────────────
  document.getElementById('resetUrlBtn').addEventListener('click', () => {
    document.getElementById('backendUrlInput').value = DEFAULT_BACKEND;
    saveBackendUrl(DEFAULT_BACKEND, () => {
      showFeedback('urlFeedback', '✓ Reset to default');
      const healthUrl = document.getElementById('health-url-display');
      if (healthUrl) { try { healthUrl.textContent = new URL(DEFAULT_BACKEND).hostname; } catch (_) {} }
    });
  });

  // ── Toggles ───────────────────────────────────────────────────────────────────
  function initToggle(id, storageKey, defaultVal) {
    const btn = document.getElementById(id);
    if (!btn) return;
    chrome.storage.sync.get(storageKey, (r) => {
      const val = r[storageKey] != null ? r[storageKey] : defaultVal;
      if (val) btn.classList.add('on'); else btn.classList.remove('on');
    });
    btn.addEventListener('click', () => {
      const on = btn.classList.toggle('on');
      chrome.storage.sync.set({ [storageKey]: on });
    });
  }

  initToggle('toggle-autoexpand', 'autoExpand', false);
  initToggle('toggle-autoscan', 'autoScan', false);
  initToggle('toggle-sound', 'soundEnabled', false);

  // ── Screenshot quality slider ─────────────────────────────────────────────────
  const slider = document.getElementById('quality-slider');
  const qualityDisplay = document.getElementById('quality-display');

  chrome.storage.sync.get('screenshotQuality', (r) => {
    const q = r.screenshotQuality || 90;
    slider.value = q;
    qualityDisplay.textContent = `${q}%`;
  });

  slider.addEventListener('input', () => {
    qualityDisplay.textContent = `${slider.value}%`;
  });

  slider.addEventListener('change', () => {
    chrome.storage.sync.set({ screenshotQuality: parseInt(slider.value, 10) });
  });

})();
