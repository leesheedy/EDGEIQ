/* EdgeIQ TAB Analyser — Content Script */
(function () {
  'use strict';

  const DEFAULT_BACKEND = 'https://edgeiq-production-6e47.up.railway.app';
  const LOADING_MESSAGES = [
    'Capturing page…',
    'Extracting data…',
    'Researching runners…',
    'Building verdict…',
  ];

  // Random per-session token — host element has no fingerprint-able ID or class
  const SESSION_KEY = '_' + Math.random().toString(36).slice(2, 10);

  // ── All styles live inside Shadow DOM — invisible to page JS / CSS ──────────
  const PANEL_CSS = `
@keyframes eq-spin{to{transform:rotate(360deg)}}
*,*::before,*::after{box-sizing:border-box}
:host{all:initial;position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:2147483647;display:flex;pointer-events:none}
.eq-panel{position:relative;display:flex;flex-direction:row;align-items:stretch;pointer-events:none;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.4;color:#e8eaf0;user-select:none}
.eq-panel.eq-collapsed .eq-body{width:0;opacity:0;overflow:hidden;border:none}
.eq-toggle{pointer-events:all;width:28px;background:#0a0f1a;border:1px solid #1e2a3a;border-right:none;border-radius:8px 0 0 8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:14px 0;cursor:pointer;transition:background .2s,border-color .2s;box-shadow:-3px 0 16px rgba(0,0,0,.5);min-height:120px}
.eq-toggle:hover{background:#101828;border-color:#39d97c}
.eq-ti{font-size:14px;line-height:1;display:block}
.eq-tt{writing-mode:vertical-rl;text-orientation:mixed;transform:rotate(180deg);font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#39d97c}
.eq-body{pointer-events:all;width:360px;background:#0a0f1a;border:1px solid #1e2a3a;border-right:none;display:flex;flex-direction:column;max-height:85vh;overflow:hidden;box-shadow:-4px 0 24px rgba(0,0,0,.6);transition:width .3s cubic-bezier(.4,0,.2,1),opacity .3s}
.eq-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;border-bottom:1px solid #1e2a3a;flex-shrink:0;background:#070c14}
.eq-hl{display:flex;align-items:center;gap:8px}
.eq-lm{font-size:18px;line-height:1}
.eq-brand{font-size:13px;font-weight:700;letter-spacing:.04em;color:#39d97c}
.eq-ha{display:flex;align-items:center;gap:6px}
.eq-close{background:none;border:none;color:#4a5568;cursor:pointer;font-size:16px;line-height:1;padding:2px 4px;border-radius:4px;transition:color .15s}
.eq-close:hover{color:#e8eaf0}
.eq-content{flex:1;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#1e2a3a transparent}
.eq-content::-webkit-scrollbar{width:4px}
.eq-content::-webkit-scrollbar-thumb{background:#1e2a3a;border-radius:2px}
.eq-idle{padding:20px 16px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}
.eq-idle-icon{font-size:36px;line-height:1}
.eq-idle-title{font-size:14px;font-weight:600;color:#e8eaf0;margin:0}
.eq-idle-sub{font-size:11px;color:#4a5568;margin:0;line-height:1.5}
.eq-btn-analyse{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#39d97c;color:#070c14;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;width:100%;max-width:220px;transition:background .2s,transform .1s}
.eq-btn-analyse:hover{background:#2fc46e;transform:translateY(-1px)}
.eq-loading{padding:28px 16px;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center}
.eq-spinner{width:32px;height:32px;border:3px solid #1e2a3a;border-top-color:#39d97c;border-radius:50%;animation:eq-spin .8s linear infinite}
.eq-load-msg{font-size:12px;color:#6b7a8d;min-height:18px;transition:opacity .3s}
.eq-error{padding:20px 16px;display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
.eq-error-icon{font-size:28px}
.eq-error-msg{font-size:12px;color:#e85c5c;line-height:1.5;background:rgba(232,92,92,.08);border:1px solid rgba(232,92,92,.2);border-radius:6px;padding:10px 12px;width:100%;word-break:break-word}
.eq-btn-retry{display:inline-flex;align-items:center;gap:5px;background:transparent;color:#39d97c;border:1px solid #39d97c;border-radius:7px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;transition:background .15s}
.eq-btn-retry:hover{background:rgba(57,217,124,.1)}
.eq-results{display:flex;flex-direction:column}
.eq-section-label{font-size:9px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#3a4a5a;font-family:monospace;padding:10px 14px 4px;display:block}
.eq-rec-header{margin:0 12px 10px;padding:12px 14px;border-radius:8px;border-left:4px solid #39d97c;background:rgba(57,217,124,.06)}
.eq-rec-BET{border-left-color:#39d97c;background:rgba(57,217,124,.07)}
.eq-rec-WATCH{border-left-color:#f5a623;background:rgba(245,166,35,.07)}
.eq-rec-PASS{border-left-color:#e8743b;background:rgba(232,116,59,.07)}
.eq-rec-SKIP{border-left-color:#4a5568;background:rgba(74,85,104,.07)}
.eq-rec-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
.eq-rec-BET .eq-rec-badge{background:rgba(57,217,124,.2);color:#39d97c}
.eq-rec-WATCH .eq-rec-badge{background:rgba(245,166,35,.2);color:#f5a623}
.eq-rec-PASS .eq-rec-badge{background:rgba(232,116,59,.2);color:#e8743b}
.eq-rec-SKIP .eq-rec-badge{background:rgba(74,85,104,.2);color:#8899aa}
.eq-rec-event{font-size:12px;font-weight:600;color:#c8d0dc;margin-bottom:5px;word-break:break-word}
.eq-rec-verdict{font-size:11px;color:#6b7a8d;font-style:italic;line-height:1.5}
.eq-stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin:0 12px 10px;background:#1e2a3a;border-radius:8px;overflow:hidden;border:1px solid #1e2a3a}
.eq-stat-cell{background:#0d1420;padding:10px 8px;text-align:center;display:flex;flex-direction:column;gap:3px}
.eq-stat-value{font-size:18px;font-weight:700;font-family:monospace;color:#39d97c;line-height:1}
.eq-stat-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#3a4a5a;font-family:monospace}
.eq-selection{margin:0 12px 10px;padding:10px 12px;background:#0d1420;border:1px solid #1e2a3a;border-radius:7px;display:flex;align-items:center;gap:8px}
.eq-sel-label{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#3a4a5a;font-family:monospace;white-space:nowrap}
.eq-sel-name{font-size:13px;font-weight:700;color:#e8eaf0;word-break:break-word}
.eq-key-stat{margin:0 12px 10px;padding:8px 12px;background:rgba(57,217,124,.05);border:1px solid rgba(57,217,124,.15);border-radius:7px;font-size:11px;color:#8ad4a8;line-height:1.5}
.eq-key-stat::before{content:'★ ';color:#39d97c}
.eq-no-value{margin:0 12px 10px;padding:12px 14px;background:rgba(232,116,59,.06);border:1px solid rgba(232,116,59,.15);border-radius:7px}
.eq-no-value-hdr{font-size:12px;font-weight:700;color:#e8743b;margin-bottom:6px}
.eq-pass-reason{font-size:11px;color:#8899aa;line-height:1.5}
.eq-wait-box{margin:0 12px 10px;padding:10px 12px;background:rgba(245,166,35,.06);border:1px solid rgba(245,166,35,.25);border-radius:7px;display:flex;gap:8px;align-items:flex-start}
.eq-wait-icon{font-size:13px;flex-shrink:0;margin-top:1px}
.eq-wait-text{font-size:11px;color:#c9933a;line-height:1.5}
.eq-risk-flags{display:flex;flex-wrap:wrap;gap:5px;padding:0 12px 10px}
.eq-risk-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(232,92,92,.1);border:1px solid rgba(232,92,92,.2);border-radius:20px;font-size:10px;color:#e85c5c}
.eq-risk-chip::before{content:'⚠ ';font-size:9px}
.eq-details-toggle{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;cursor:pointer;border-top:1px solid #1e2a3a;border-bottom:1px solid #1e2a3a;background:#070c14;user-select:none}
.eq-details-toggle:hover{background:#0d1420}
.eq-details-lbl{font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#4a5568;font-family:monospace}
.eq-details-arrow{font-size:10px;color:#4a5568;transition:transform .2s}
.eq-details-toggle.eq-open .eq-details-arrow{transform:rotate(180deg)}
.eq-details-body{display:none;padding:12px 14px;background:#070c14;border-bottom:1px solid #1e2a3a}
.eq-details-body.eq-open{display:block}
.eq-reasoning{font-size:11px;color:#6b7a8d;line-height:1.65;white-space:pre-wrap;word-break:break-word}
.eq-runners{display:flex;flex-direction:column;gap:1px;margin-bottom:2px}
.eq-runner-row{display:flex;align-items:center;gap:8px;padding:7px 14px;background:#0a0f1a;transition:background .1s}
.eq-runner-row:hover{background:#0d1420}
.eq-runner-row.eq-selected{background:rgba(57,217,124,.08);border-left:3px solid #39d97c;padding-left:11px}
.eq-barrier{width:22px;height:22px;border-radius:50%;background:#1e2a3a;color:#8899aa;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:monospace}
.eq-runner-row.eq-selected .eq-barrier{background:rgba(57,217,124,.2);color:#39d97c}
.eq-runner-info{flex:1;min-width:0}
.eq-runner-name{font-size:12px;font-weight:600;color:#c8d0dc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eq-runner-row.eq-selected .eq-runner-name{color:#39d97c}
.eq-runner-jockey{font-size:10px;color:#4a5568;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.eq-runner-odds{font-size:12px;font-weight:700;color:#8899aa;font-family:monospace;flex-shrink:0}
.eq-runner-row.eq-selected .eq-runner-odds{color:#39d97c}
.eq-prob-table{width:100%;border-collapse:collapse;font-size:10px;font-family:monospace}
.eq-prob-table th{padding:5px 8px;text-align:left;color:#3a4a5a;font-weight:700;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #1e2a3a;font-size:9px}
.eq-prob-table th:last-child{text-align:center}
.eq-prob-table td{padding:5px 8px;border-bottom:1px solid #0d1420;color:#8899aa;vertical-align:middle}
.eq-prob-table tr:last-child td{border-bottom:none}
.eq-prob-runner-name{color:#c8d0dc;font-weight:600;max-width:100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.eq-vbadge{display:inline-block;width:18px;height:18px;border-radius:50%;text-align:center;line-height:18px;font-size:10px;font-weight:700}
.eq-vgood{background:rgba(57,217,124,.2);color:#39d97c}
.eq-vpoor{background:rgba(232,92,92,.15);color:#e85c5c}
.eq-vfair{background:rgba(74,85,104,.3);color:#6b7a8d}
.eq-table-wrap{padding:0 12px 10px;overflow-x:auto}
.eq-footer{padding:10px 12px;border-top:1px solid #1e2a3a;background:#070c14;flex-shrink:0;display:flex;gap:8px}
.eq-btn-again{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:transparent;color:#39d97c;border:1px solid rgba(57,217,124,.4);border-radius:7px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;transition:background .15s,border-color .15s}
.eq-btn-again:hover{background:rgba(57,217,124,.08);border-color:#39d97c}
`;

  // ── State ─────────────────────────────────────────────────────────────────────
  let hostEl = null;
  let panel = null;
  let panelContent = null;
  let isExpanded = false;
  let loadingInterval = null;
  let currentState = 'idle';
  let lastUrl = location.href;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function isTargetPage() {
    return /tab\.com\.au\/(racing|sports)/i.test(location.href);
  }

  function isDesktop() {
    return window.innerWidth >= 1024;
  }

  function updateVisibility() {
    if (!hostEl) return;
    hostEl.style.display = isDesktop() ? 'flex' : 'none';
  }

  // ── Build panel inside closed Shadow DOM ──────────────────────────────────────
  function init() {
    if (document.querySelector(`[data-s="${SESSION_KEY}"]`)) return;
    if (!isDesktop()) return;

    buildPanel();
    attachSpaObserver();
    attachResizeListener();
  }

  function buildPanel() {
    // Host element — generic attrs, no fingerprint-able ID or class
    hostEl = document.createElement('div');
    hostEl.setAttribute('data-s', SESSION_KEY);

    // Closed shadow root: page JS cannot access .shadowRoot — returns null
    const shadow = hostEl.attachShadow({ mode: 'closed' });

    // Inject styles inside shadow root (scoped, invisible to page CSS detectors)
    const styleEl = document.createElement('style');
    styleEl.textContent = PANEL_CSS;
    shadow.appendChild(styleEl);

    panel = document.createElement('div');
    panel.className = 'eq-panel eq-collapsed';

    // ── Toggle strip ──
    const toggle = document.createElement('div');
    toggle.className = 'eq-toggle';
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('aria-label', 'EdgeIQ analysis panel');
    toggle.innerHTML = `<span class="eq-ti">⚡</span><span class="eq-tt">EdgeIQ</span>`;
    toggle.addEventListener('click', togglePanel);

    // ── Main body ──
    const panelBody = document.createElement('div');
    panelBody.className = 'eq-body';

    const header = document.createElement('div');
    header.className = 'eq-header';
    header.innerHTML = `
      <div class="eq-hl"><span class="eq-lm">⚡</span><span class="eq-brand">EdgeIQ</span></div>
      <div class="eq-ha"><button class="eq-close" title="Close">✕</button></div>
    `;
    header.querySelector('.eq-close').addEventListener('click', collapsePanel);

    panelContent = document.createElement('div');
    panelContent.className = 'eq-content';

    panelBody.appendChild(header);
    panelBody.appendChild(panelContent);

    panel.appendChild(toggle);
    panel.appendChild(panelBody);
    shadow.appendChild(panel);

    document.body.appendChild(hostEl);
    showIdle();
    updateVisibility();
  }

  // ── Panel state ───────────────────────────────────────────────────────────────
  function togglePanel() { isExpanded ? collapsePanel() : expandPanel(); }

  function expandPanel() {
    if (!panel) return;
    panel.classList.remove('eq-collapsed');
    isExpanded = true;
  }

  function collapsePanel() {
    if (!panel) return;
    panel.classList.add('eq-collapsed');
    isExpanded = false;
  }

  // ── Idle ──────────────────────────────────────────────────────────────────────
  function showIdle() {
    currentState = 'idle';
    stopLoadingMessages();
    const onTarget = isTargetPage();
    panelContent.innerHTML = `
      <div class="eq-idle">
        <div class="eq-idle-icon">🏇</div>
        <p class="eq-idle-title">${onTarget ? 'Ready to analyse' : 'Go to a racing or sports page'}</p>
        <p class="eq-idle-sub">${onTarget
          ? 'Click below to capture and get AI-powered analysis.'
          : 'EdgeIQ works on tab.com.au/racing and /sports pages.'}</p>
        ${onTarget ? `<button class="eq-btn-analyse">⚡ Analyse This Page</button>` : ''}
      </div>
    `;
    if (onTarget) panelContent.querySelector('.eq-btn-analyse').addEventListener('click', runAnalysis);
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  function showLoading() {
    currentState = 'loading';
    panelContent.innerHTML = `
      <div class="eq-loading">
        <div class="eq-spinner"></div>
        <div class="eq-load-msg" id="eq-lmsg">${LOADING_MESSAGES[0]}</div>
      </div>
    `;
    let idx = 0;
    loadingInterval = setInterval(() => {
      idx = (idx + 1) % LOADING_MESSAGES.length;
      const el = panelContent.querySelector('#eq-lmsg');
      if (el) {
        el.style.opacity = '0';
        setTimeout(() => { if (el) { el.textContent = LOADING_MESSAGES[idx]; el.style.opacity = '1'; } }, 200);
      }
    }, 2200);
  }

  function stopLoadingMessages() {
    if (loadingInterval) { clearInterval(loadingInterval); loadingInterval = null; }
  }

  // ── Error ─────────────────────────────────────────────────────────────────────
  function showError(message) {
    currentState = 'error';
    stopLoadingMessages();
    panelContent.innerHTML = `
      <div class="eq-error">
        <div class="eq-error-icon">⚠️</div>
        <div class="eq-error-msg">${escHtml(message)}</div>
        <button class="eq-btn-retry">↺ Try Again</button>
      </div>
    `;
    panelContent.querySelector('.eq-btn-retry').addEventListener('click', runAnalysis);
  }

  // ── Analysis flow ─────────────────────────────────────────────────────────────
  async function runAnalysis() {
    if (!isTargetPage()) {
      showError('Please navigate to a TAB.com.au racing or sports page first.');
      return;
    }

    // Collapse so panel doesn't obstruct the screenshot
    collapsePanel();
    await delay(350);

    let screenshotResult;
    try {
      screenshotResult = await sendMessage({ type: 'CAPTURE_SCREENSHOT' });
    } catch (err) {
      expandPanel();
      showError('Screenshot failed: ' + (err.message || String(err)));
      return;
    }

    if (screenshotResult.error) {
      expandPanel();
      showError('Screenshot error: ' + screenshotResult.error);
      return;
    }

    expandPanel();
    showLoading();

    let backendUrl = DEFAULT_BACKEND;
    try {
      const stored = await storageGet('backendUrl');
      if (stored && stored.backendUrl) backendUrl = stored.backendUrl;
    } catch (_) {}

    let responseData;
    try {
      const resp = await fetch(`${backendUrl}/api/screenshot/analyse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: screenshotResult.dataUrl, mediaType: 'image/jpeg' }),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => `HTTP ${resp.status}`);
        throw new Error(`Server error ${resp.status}: ${errText.slice(0, 200)}`);
      }

      responseData = await resp.json();
    } catch (err) {
      stopLoadingMessages();
      showError('Analysis failed: ' + (err.message || String(err)));
      return;
    }

    stopLoadingMessages();
    try {
      renderResults(responseData);
    } catch (err) {
      showError('Display error: ' + err.message);
    }
  }

  // ── Results ───────────────────────────────────────────────────────────────────
  function renderResults(responseData) {
    currentState = 'results';

    const data = responseData.data || responseData;
    const rec = data.recommendation || {};
    const recommendation = (rec.recommendation || 'SKIP').toUpperCase();
    const eventName = data.event_name || data.sport || 'Unknown Event';
    const runners = data.runners || [];
    const probTable = rec.probability_table || [];

    const container = document.createElement('div');
    container.className = 'eq-results';

    // Rec header
    const recHeader = document.createElement('div');
    recHeader.className = `eq-rec-header eq-rec-${recommendation}`;
    const icon = { BET: '✅', WATCH: '👁', PASS: '⏭', SKIP: '⏩' }[recommendation] || '📊';
    recHeader.innerHTML = `
      <div class="eq-rec-badge">${icon} ${recommendation}</div>
      <div class="eq-rec-event">${escHtml(eventName)}</div>
      ${rec.professional_verdict ? `<div class="eq-rec-verdict">${escHtml(rec.professional_verdict)}</div>` : ''}
    `;
    container.appendChild(recHeader);

    if (recommendation === 'BET' || recommendation === 'WATCH') {
      if (rec.selection) {
        const selEl = document.createElement('div');
        selEl.className = 'eq-selection';
        selEl.innerHTML = `<span class="eq-sel-label">Selection</span><span class="eq-sel-name">${escHtml(rec.selection)}</span>`;
        container.appendChild(selEl);
      }

      const hasStats = rec.confidence_score != null || rec.expected_value != null || rec.suggested_stake_percent != null;
      if (hasStats) {
        const grid = document.createElement('div');
        grid.className = 'eq-stats-grid';
        const conf = rec.confidence_score != null ? `${Math.round(rec.confidence_score)}%` : '—';
        const ev = rec.expected_value != null ? fmtEV(rec.expected_value) : '—';
        const stake = rec.suggested_stake_percent != null ? `${rec.suggested_stake_percent}%` : '—';
        grid.innerHTML = `
          <div class="eq-stat-cell"><div class="eq-stat-value">${escHtml(conf)}</div><div class="eq-stat-label">Confidence</div></div>
          <div class="eq-stat-cell"><div class="eq-stat-value">${escHtml(ev)}</div><div class="eq-stat-label">Edge (EV)</div></div>
          <div class="eq-stat-cell"><div class="eq-stat-value">${escHtml(stake)}</div><div class="eq-stat-label">Stake</div></div>
        `;
        container.appendChild(grid);
      }

      if (rec.key_stat) {
        const ks = document.createElement('div');
        ks.className = 'eq-key-stat';
        ks.textContent = rec.key_stat;
        container.appendChild(ks);
      }

      if (recommendation === 'WATCH' && rec.wait_for) {
        const wf = document.createElement('div');
        wf.className = 'eq-wait-box';
        wf.innerHTML = `<span class="eq-wait-icon">⏱</span><span class="eq-wait-text">${escHtml(rec.wait_for)}</span>`;
        container.appendChild(wf);
      }
    }

    if (recommendation === 'PASS' || recommendation === 'SKIP') {
      const noVal = document.createElement('div');
      noVal.className = 'eq-no-value';
      noVal.innerHTML = `
        <div class="eq-no-value-hdr">No Value Found</div>
        ${rec.pass_reason ? `<div class="eq-pass-reason">${escHtml(rec.pass_reason)}</div>` : ''}
      `;
      container.appendChild(noVal);

      if (rec.wait_for) {
        const wf = document.createElement('div');
        wf.className = 'eq-wait-box';
        wf.innerHTML = `<span class="eq-wait-icon">⏱</span><span class="eq-wait-text">${escHtml(rec.wait_for)}</span>`;
        container.appendChild(wf);
      }

      if (rec.key_stat) {
        const ks = document.createElement('div');
        ks.className = 'eq-key-stat';
        ks.textContent = rec.key_stat;
        container.appendChild(ks);
      }
    }

    if (rec.risk_flags && rec.risk_flags.length > 0) {
      const riskWrap = document.createElement('div');
      riskWrap.className = 'eq-risk-flags';
      rec.risk_flags.forEach((flag) => {
        const chip = document.createElement('span');
        chip.className = 'eq-risk-chip';
        chip.textContent = flag;
        riskWrap.appendChild(chip);
      });
      container.appendChild(riskWrap);
    }

    if (rec.reasoning) {
      const dt = document.createElement('div');
      dt.className = 'eq-details-toggle';
      dt.innerHTML = `<span class="eq-details-lbl">Full Analysis</span><span class="eq-details-arrow">▼</span>`;
      const db = document.createElement('div');
      db.className = 'eq-details-body';
      db.innerHTML = `<div class="eq-reasoning">${escHtml(rec.reasoning)}</div>`;
      dt.addEventListener('click', () => {
        const open = dt.classList.contains('eq-open');
        dt.classList.toggle('eq-open', !open);
        db.classList.toggle('eq-open', !open);
      });
      container.appendChild(dt);
      container.appendChild(db);
    }

    if (runners.length > 0) {
      const label = document.createElement('span');
      label.className = 'eq-section-label';
      label.textContent = `Runners (${runners.length})`;
      container.appendChild(label);

      const list = document.createElement('div');
      list.className = 'eq-runners';
      const selLower = (rec.selection || '').toLowerCase();

      runners.forEach((r) => {
        const isSelected = selLower && (r.name || '').toLowerCase().includes(selLower.split(' ')[0]);
        const row = document.createElement('div');
        row.className = `eq-runner-row${isSelected ? ' eq-selected' : ''}`;
        const barrier = r.barrier != null ? r.barrier : '—';
        const odds = r.odds != null ? `$${Number(r.odds).toFixed(2)}` : '—';
        row.innerHTML = `
          <div class="eq-barrier">${escHtml(String(barrier))}</div>
          <div class="eq-runner-info">
            <div class="eq-runner-name">${escHtml(r.name || 'Unknown')}</div>
            ${(r.jockey || r.trainer) ? `<div class="eq-runner-jockey">${escHtml(r.jockey || r.trainer)}</div>` : ''}
          </div>
          <div class="eq-runner-odds">${escHtml(odds)}</div>
        `;
        list.appendChild(row);
      });
      container.appendChild(list);
    }

    if (probTable.length > 0) {
      const pl = document.createElement('span');
      pl.className = 'eq-section-label';
      pl.textContent = 'Probability Breakdown';
      container.appendChild(pl);

      const tw = document.createElement('div');
      tw.className = 'eq-table-wrap';
      const tbl = document.createElement('table');
      tbl.className = 'eq-prob-table';
      tbl.innerHTML = `<thead><tr><th>Runner</th><th>Mkt%</th><th>True%</th><th>Value</th></tr></thead><tbody></tbody>`;
      const tbody = tbl.querySelector('tbody');

      probTable.forEach((row) => {
        const rating = (row.value_rating || '').toLowerCase();
        const badge = rating === 'good'
          ? '<span class="eq-vbadge eq-vgood">✓</span>'
          : rating === 'poor'
          ? '<span class="eq-vbadge eq-vpoor">✗</span>'
          : '<span class="eq-vbadge eq-vfair">~</span>';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="eq-prob-runner-name">${escHtml(row.runner || '—')}</span></td>
          <td>${escHtml(fmtPct(row.implied_prob))}</td>
          <td>${escHtml(fmtPct(row.true_prob))}</td>
          <td style="text-align:center">${badge}</td>
        `;
        tbody.appendChild(tr);
      });

      tw.appendChild(tbl);
      container.appendChild(tw);
    }

    const footer = document.createElement('div');
    footer.className = 'eq-footer';
    footer.innerHTML = `<button class="eq-btn-again">⚡ Analyse Again</button>`;
    footer.querySelector('.eq-btn-again').addEventListener('click', runAnalysis);
    container.appendChild(footer);

    panelContent.innerHTML = '';
    panelContent.appendChild(container);
    panelContent.scrollTop = 0;
  }

  // ── SPA observer ──────────────────────────────────────────────────────────────
  function attachSpaObserver() {
    const observer = new MutationObserver(() => {
      const cur = location.href;
      if (cur !== lastUrl) { lastUrl = cur; onUrlChange(); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function onUrlChange() {
    updateVisibility();
    if (currentState !== 'loading') showIdle();
  }

  function attachResizeListener() {
    window.addEventListener('resize', updateVisibility, { passive: true });
  }

  // ── Utilities ─────────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function sendMessage(msg) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(msg, (response) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(response);
        });
      } catch (err) { reject(err); }
    });
  }

  function storageGet(key) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.sync.get(key, (result) => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(result);
        });
      } catch (err) { reject(err); }
    });
  }

  function fmtEV(val) {
    if (val == null) return '—';
    const n = Number(val);
    return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
  }

  function fmtPct(val) {
    if (val == null || val === '') return '—';
    const n = Number(val);
    if (isNaN(n)) return String(val);
    return `${(n * (n <= 1 ? 100 : 1)).toFixed(1)}%`;
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
