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

});
