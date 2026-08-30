// DrishtiAI Background Service Worker
// Manages tab-specific side panel behavior and message routing.

// Disable the side panel globally by default so it does NOT appear on all tabs
chrome.sidePanel
  .setOptions({ enabled: false })
  .catch((err) => console.error('DrishtiAI: Failed to disable global side panel:', err));

// When the user clicks the extension action icon on a specific tab:
// Enable and open the side panel EXCLUSIVELY for that specific tab.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;

  try {
    // Enable and set path specifically for this tab
    await chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: `sidebar.html?tabId=${tab.id}`,
      enabled: true
    });

    // Open side panel specifically for this tab
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.error('DrishtiAI: Failed to open tab-specific side panel:', err);
  }
});

// Helper: Check if a URL is restricted from content script execution
function isRestrictedUrl(url) {
  if (!url) return true;
  const restrictedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'devtools://',
    'view-source:',
    'https://chromewebstore.google.com',
    'https://chrome.google.com/webstore'
  ];
  return restrictedPrefixes.some((prefix) => url.startsWith(prefix));
}

// Fetch structured DOM from target tab with automatic content script injection fallback
async function getTabDOM(targetTabId) {
  let tabId = targetTabId;
  let tabUrl = '';

  if (!tabId) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      throw new Error('NO_ACTIVE_TAB');
    }
    tabId = activeTab.id;
    tabUrl = activeTab.url || '';
  } else {
    try {
      const tab = await chrome.tabs.get(tabId);
      tabUrl = tab?.url || '';
    } catch (tabErr) {
      throw new Error(`TAB_NOT_FOUND: ${tabErr.message}`);
    }
  }

  if (isRestrictedUrl(tabUrl)) {
    const err = new Error('RESTRICTED_PAGE');
    err.code = 'RESTRICTED_PAGE';
    err.url = tabUrl;
    throw err;
  }

  // Attempt 1: Try sending message to existing content script in the target tab
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_DOM' });
    if (response && response.success && response.data) {
      return response.data;
    }
  } catch (msgErr) {
    // Content script may not be loaded yet in this tab; proceed to fallback injection
  }

  // Attempt 2: Inject content script dynamically and retrieve structured DOM
  try {
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });

    if (injectionResults && injectionResults[0] && injectionResults[0].result) {
      return injectionResults[0].result;
    }
  } catch (injectErr) {
    throw new Error(`INJECTION_FAILED: ${injectErr.message}`);
  }

  throw new Error('NO_DOM_DATA_RETURNED');
}

// Listen for messages from tab-specific sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && (message.type === 'GET_DOM' || message.type === 'GET_PAGE_CONTEXT')) {
    (async () => {
      try {
        const domData = await getTabDOM(message.tabId);
        sendResponse({ success: true, data: domData });
      } catch (err) {
        sendResponse({
          success: false,
          error: err.code || 'DOM_EXTRACTION_ERROR',
          message: err.message,
          url: err.url || ''
        });
      }
    })();
    return true; // Keep channel open for async sendResponse
  }
});
