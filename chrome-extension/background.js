// EdgeIQ Background Service Worker

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_SCREENSHOT') {
    const windowId = sender.tab ? sender.tab.windowId : chrome.windows.WINDOW_ID_CURRENT;

    // Load quality preference from storage (default 90)
    chrome.storage.sync.get('screenshotQuality', (r) => {
      const quality = r.screenshotQuality || 90;

      chrome.tabs.captureVisibleTab(
        windowId,
        { format: 'jpeg', quality },
        (dataUrl) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError.message });
          } else {
            sendResponse({ dataUrl });
          }
        }
      );
    });

    // Return true to keep the message channel open for async response
    return true;
  }
});
