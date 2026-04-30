// EdgeIQ Background Service Worker
// Requests made here use the extension's host_permissions and bypass CORS.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── Screenshot capture ──────────────────────────────────────────────────────
  if (message.type === 'CAPTURE_SCREENSHOT') {
    const windowId = sender.tab ? sender.tab.windowId : chrome.windows.WINDOW_ID_CURRENT;

    chrome.storage.sync.get('screenshotQuality', (r) => {
      const quality = r.screenshotQuality || 90;

      chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality }, (dataUrl) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ dataUrl });
        }
      });
    });

    return true; // keep channel open for async response
  }

  // ── Analysis fetch — runs from background to bypass CORS ───────────────────
  // Content scripts share the tab's origin (tab.com.au) which triggers CORS.
  // Background service workers use the extension's host_permissions instead.
  if (message.type === 'ANALYSE_PAGE') {
    const { backendUrl, image, mediaType } = message;

    fetch(`${backendUrl}/api/screenshot/analyse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, mediaType: mediaType || 'image/jpeg' }),
    })
      .then((r) => {
        if (!r.ok) {
          return r.text()
            .catch(() => `HTTP ${r.status}`)
            .then((t) => { throw new Error(`Server error ${r.status}: ${String(t).slice(0, 200)}`); });
        }
        return r.json();
      })
      .then((data) => sendResponse({ data }))
      .catch((err) => sendResponse({ error: err.message || String(err) }));

    return true; // keep channel open for async response
  }

  // ── Bankroll balance fetch ──────────────────────────────────────────────────
  if (message.type === 'GET_BANKROLL') {
    const { backendUrl } = message;

    fetch(`${backendUrl}/api/bankroll/balance`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
      .then((r) => {
        if (!r.ok) {
          return r.text()
            .catch(() => `HTTP ${r.status}`)
            .then((t) => { throw new Error(`Server error ${r.status}: ${String(t).slice(0, 200)}`); });
        }
        return r.json();
      })
      .then((data) => sendResponse({ data }))
      .catch((err) => sendResponse({ error: err.message || String(err) }));

    return true; // keep channel open for async response
  }

  // ── Text-based analysis fetch ───────────────────────────────────────────────
  if (message.type === 'ANALYSE_TEXT') {
    const { backendUrl, pageText, pageUrl } = message;

    fetch(`${backendUrl}/api/screenshot/analyse-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageText, pageUrl }),
    })
      .then((r) => {
        if (!r.ok) {
          return r.text()
            .catch(() => `HTTP ${r.status}`)
            .then((t) => { throw new Error(`Server error ${r.status}: ${String(t).slice(0, 200)}`); });
        }
        return r.json();
      })
      .then((data) => sendResponse({ data }))
      .catch((err) => sendResponse({ error: err.message || String(err) }));

    return true; // keep channel open for async response
  }

  // ── Find and capture an open TAB.com.au tab ─────────────────────────────────
  if (message.type === 'FIND_AND_CAPTURE_TAB') {
    chrome.tabs.query({ url: '*://*.tab.com.au/*' }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ error: 'No TAB.com.au racing tab found — open TAB.com.au in another tab first.' });
        return;
      }

      // Prefer a racing/sports page
      const racingTab = tabs.find((t) => /tab\.com\.au\/(racing|sports)/i.test(t.url || ''));
      const tab = racingTab || tabs[0];

      chrome.tabs.update(tab.id, { active: true }, () => {
        chrome.windows.update(tab.windowId, { focused: true }, () => {
          setTimeout(() => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 90 }, (dataUrl) => {
              if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
              } else {
                sendResponse({ dataUrl, tabUrl: tab.url });
              }
            });
          }, 600);
        });
      });
    });

    return true; // keep channel open for async response
  }

});
