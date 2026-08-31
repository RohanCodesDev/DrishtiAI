// Setup Offscreen Document (for future Phase 10 Vision)
const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

async function setupOffscreenDocument() {
  // Firefox doesn't support chrome.offscreen, but Chrome MV3 requires it for DOM/Canvas.
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    try {
      const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
      });
      
      if (existingContexts.length > 0) {
        return; // Already exists
      }
      
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ['DOM_PARSER', 'WORKERS'], 
        justification: 'Required for future local vision processing and canvas rendering.'
      });
    } catch (err) {
      console.error('Failed to create offscreen document:', err);
    }
  }
}

// Initialize offscreen doc
setupOffscreenDocument();


// DrishtiAI Background Service Worker
// Manages tab-specific side panel behavior and message routing.

// Automatically open the side panel when the user clicks the extension icon
if (typeof chrome !== 'undefined' && chrome.sidePanel) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('DrishtiAI: Failed to set panel behavior:', err));
} else if (typeof chrome !== 'undefined' && chrome.sidePanel) {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('DrishtiAI: Failed to set panel behavior:', err));
}

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
    'https://chrome.google.com/webstore',
    'moz-extension://'
  ];
  return restrictedPrefixes.some((prefix) => url.startsWith(prefix));
}

// Fetch structured DOM from target tab with automatic content script injection fallback
async function getTabDOM(targetTabId, config = null) {
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

  // Attempt 1: Try sending message to active content script v2 in target tab
  try {
    const pingRes = await new Promise(resolve => {
      chrome.tabs.sendMessage(tabId, { type: 'PING' }, (res) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(res);
      });
    });

    if (pingRes && pingRes.version === 2) {
      const response = await new Promise(resolve => {
        chrome.tabs.sendMessage(tabId, { type: 'GET_DOM', config }, (res) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(res);
        });
      });
      if (response && response.success && response.data) {
        return response.data;
      }
    }
  } catch (msgErr) {
    // Content script may not be loaded; proceed to injection
  }

  // Attempt 2: Inject content script dynamically and retrieve structured DOM directly
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });

    const executionResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (cfg) => {
        if (window.__DrishtiFirewall && typeof window.__DrishtiFirewall.getStructuredDOM === 'function') {
          return await window.__DrishtiFirewall.getStructuredDOM(cfg);
        }
        return null;
      },
      args: [config]
    });

    if (executionResults && executionResults[0] && executionResults[0].result) {
      return executionResults[0].result;
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
        const domData = await getTabDOM(message.tabId, message.config);
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

  if (message && message.type === 'FIREWALL_CONFIG_UPDATED') {
    (async () => {
      try {
        let tabId = message.tabId;
        if (!tabId) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          tabId = activeTab?.id;
        }

        if (tabId) {
          try {
            const pingRes = await new Promise(resolve => {
              chrome.tabs.sendMessage(tabId, { type: 'PING' }, (res) => {
                if (chrome.runtime.lastError) resolve(null);
                else resolve(res);
              });
            });
            if (pingRes && pingRes.version === 2) {
              const response = await new Promise(resolve => {
                chrome.tabs.sendMessage(tabId, {
                  type: 'FIREWALL_CONFIG_UPDATED',
                  config: message.config
                }, (res) => {
                  if (chrome.runtime.lastError) resolve(null);
                  else resolve(res);
                });
              });
              if (response && response.success && response.data) {
                sendResponse({ success: true, data: response.data });
                return;
              }
            }
          } catch (e) {
            // fallback
          }
        }
        const domData = await getTabDOM(tabId, message.config);
        sendResponse({ success: true, data: domData });
      } catch (err) {
        sendResponse({
          success: false,
          error: err.code || 'DOM_EXTRACTION_ERROR',
          message: err.message
        });
      }
    })();
    return true;
  }

  if (message && message.type === 'EXECUTE_ACTION') {
    (async () => {
      let tabId = message.tabId;
      if (!tabId) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = activeTab?.id;
      }
      if (tabId) {
        chrome.tabs.sendMessage(tabId, message, (res) => {
          if (chrome.runtime.lastError) console.error('EXECUTE_ACTION error:', chrome.runtime.lastError.message);
          if (sendResponse) sendResponse(res);
        });
      }
    })();
    return true;
  }
});
