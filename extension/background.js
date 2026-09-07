// DrishtiAI Background Service Worker
// Manages tab-specific side panel behavior, offscreen OCR workers, and message routing.

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';
let creatingOffscreenPromise = null;

async function ensureOffscreenDocument() {
  if (typeof chrome === 'undefined' || !chrome.offscreen) return;
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);

  try {
    if (chrome.runtime.getContexts) {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [offscreenUrl]
      });
      if (contexts && contexts.length > 0) return;
    } else if (chrome.offscreen.hasDocument) {
      const hasDoc = await chrome.offscreen.hasDocument();
      if (hasDoc) return;
    }
  } catch (ctxErr) {
    // Continue to creation attempt if context lookup fails
  }

  if (creatingOffscreenPromise) {
    await creatingOffscreenPromise;
    return;
  }

  creatingOffscreenPromise = chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['WORKERS', 'BLOBS', 'DOM_SCRAPING'],
    justification: 'Required for local vision processing, OCR, and canvas rendering without cloud transmission.'
  }).catch((err) => {
    if (!err.message || !err.message.includes('Only a single offscreen document')) {
      console.error('Failed to create offscreen document:', err);
    }
  }).finally(() => {
    creatingOffscreenPromise = null;
  });

  await creatingOffscreenPromise;
}

// Pre-warm offscreen doc at startup
ensureOffscreenDocument().catch(() => {});

// Automatically open the side panel when the user clicks the extension icon
if (typeof chrome !== 'undefined' && chrome.sidePanel) {
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
    const isNewTab = tabUrl.startsWith('chrome://newtab') || tabUrl.startsWith('about:') || tabUrl.startsWith('edge://newtab') || tabUrl === '';
    const friendlyTitle = isNewTab ? 'New Tab' : (tabUrl || 'Restricted Page');
    return {
      title: friendlyTitle,
      url: tabUrl || 'chrome://newtab',
      element_count: 1,
      is_restricted: true,
      canvases: [],
      root: {
        id: 'drishti-restricted-root',
        tag: 'BODY',
        type: 'root',
        text: `Active tab is on ${friendlyTitle} (${tabUrl}). Ready for navigation. To visit a website, issue a NAVIGATE action with the target URL (e.g. https://www.google.com).`,
        children: [
          {
            id: 'drishti-newtab-notice',
            tag: 'DIV',
            type: 'container',
            text: `Browser Page: ${friendlyTitle}`,
            children: []
          }
        ]
      },
      visual_context: `(Active tab is ${friendlyTitle} [${tabUrl}]. Ready for navigation.)`
    };
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
    // Return fallback synthetic DOM if script injection is not allowed on this page
    return {
      title: tabUrl || 'Browser Tab',
      url: tabUrl,
      element_count: 1,
      canvases: [],
      root: {
        id: 'drishti-fallback-root',
        tag: 'BODY',
        type: 'root',
        text: `Tab loaded (${tabUrl}). Ready for navigation or analysis.`,
        children: []
      },
      visual_context: `(Tab loaded at ${tabUrl})`
    };
  }

  throw new Error('NO_DOM_DATA_RETURNED');
}

// Helper: Handshake with offscreen document to ensure message listeners are active
async function pingOffscreenDocument(maxRetries = 5, retryDelayMs = 150) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const pingRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ target: 'offscreen', type: 'PING' }, (res) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(res);
        });
      });
      if (pingRes && pingRes.success) return true;
    } catch (e) {}
    if (attempt < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  return false;
}

// Helper: Deep scroll, capture multiple viewports, and stitch OCR contexts
async function captureAndStitchOCR(targetTabId, config = null, canvases = []) {
  try {
    let targetWindowId = null;
    if (targetTabId) {
      const tab = await chrome.tabs.get(targetTabId).catch(() => null);
      if (tab && tab.windowId !== undefined) {
        targetWindowId = tab.windowId;
      }
    }

    let stitchedText = '';
    let isAtBottom = false;
    let loops = 0;
    const MAX_LOOPS = 4; // Prevent infinite loops or memory overload
    
    // First, ensure we start from the top
    await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: () => window.scrollTo(0, 0)
    }).catch(() => {});
    
    // Allow a tiny delay for scroll reset to render
    await new Promise(resolve => setTimeout(resolve, 200));

    while (!isAtBottom && loops < MAX_LOOPS) {
      loops++;
      const text = await captureAndRunOCR(targetTabId, config, canvases);
      if (text && !text.includes('(OCR processing failed')) {
        stitchedText += `\n[Viewport ${loops}]\n` + text;
      }

      // Scroll down
      isAtBottom = await new Promise(resolve => {
        chrome.tabs.sendMessage(targetTabId, { type: 'EXECUTE_ACTION', action: { action: 'SCROLL_DOWN_VIEWPORT' } }, (res) => {
          if (chrome.runtime.lastError || !res) resolve(true); // Fallback to stop if error
          else resolve(res.isAtBottom);
        });
      });
      // Wait for lazy render
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Restore scroll position to top
    await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: () => window.scrollTo(0, 0)
    }).catch(() => {});

    console.log(`[DrishtiAI Background] 🧵 Stitched ${loops} viewports. Total OCR text length: ${stitchedText.length}`);
    return stitchedText || '(No text detected during full scan)';
  } catch (err) {
    console.error('Full scan OCR stitching failed:', err);
    return '(Full scan OCR stitching failed)';
  }
}

// Helper: Synchronize screenshot capture and offscreen OCR worker processing
async function captureAndRunOCR(targetTabId, config = null, canvases = []) {
  try {
    console.log('[DrishtiAI Background] 👁️ Step 2/3: Initializing Offscreen OCR Engine...');
    await ensureOffscreenDocument();
    await pingOffscreenDocument(5, 150);

    let targetWindowId = null;
    if (targetTabId) {
      const tab = await chrome.tabs.get(targetTabId).catch(() => null);
      if (tab && tab.windowId !== undefined) {
        targetWindowId = tab.windowId;
      }
    }

    console.log('[DrishtiAI Background] 📸 Step 2/3: Capturing visible viewport screenshot...');
    const dataUrl = await chrome.tabs.captureVisibleTab(targetWindowId, { format: 'png' });
    if (!dataUrl && (!canvases || canvases.length === 0)) {
      console.warn('[DrishtiAI Background] Screenshot capture returned empty.');
      return '(No visual screenshot available)';
    }

    console.log('[DrishtiAI Background] ⏳ Step 3/3: Running Tesseract OCR in Offscreen Worker...');
    const ocrPromise = new Promise((resolve) => {
      chrome.runtime.sendMessage({
        target: 'offscreen',
        type: 'RUN_OCR',
        dataUrl: dataUrl,
        canvases: canvases,
        config: config
      }, (res) => {
        if (chrome.runtime.lastError) {
          const lastErrMsg = chrome.runtime.lastError.message || 'Offscreen document connection error';
          console.warn('[DrishtiAI Background] Offscreen OCR runtime error:', lastErrMsg);
          resolve({ success: false, error: lastErrMsg });
        } else {
          resolve(res || { success: false, error: 'Empty response from offscreen OCR worker' });
        }
      });
    });

    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.warn('[DrishtiAI Background] ⏱️ OCR processing timed out after 25s.');
        resolve({ success: false, error: 'OCR processing timed out after 25s' });
      }, 25000);
    });

    const ocrResponse = await Promise.race([ocrPromise, timeoutPromise]);

    if (ocrResponse && ocrResponse.success && ocrResponse.text) {
      console.log(`[DrishtiAI Background] ✨ OCR Success! Recognized ${ocrResponse.text.length} chars (Confidence: ${Math.round(ocrResponse.confidence || 0)}%)`);
      return ocrResponse.text;
    } else if (ocrResponse && ocrResponse.success && !ocrResponse.text) {
      console.log('[DrishtiAI Background] ✨ OCR Completed: No text detected on screen.');
      return '(No visual text detected on screen)';
    } else {
      console.warn('[DrishtiAI Background] ⚠️ OCR Failed:', ocrResponse?.error);
      return '(OCR processing failed: ' + (ocrResponse?.error || 'Unknown error') + ')';
    }
  } catch (visionErr) {
    console.warn('[DrishtiAI Background] Vision OCR skipped or failed:', visionErr.message);
    return '(OCR capture skipped: ' + visionErr.message + ' - NOTE: If testing on a local file, ensure "Allow access to file URLs" is enabled in chrome://extensions for DrishtiAI)';
  }
}

// Helper: Fast direct canvas graphic decoding without full-viewport screenshot capture
async function decodeCanvasesDirect(canvases = [], config = null) {
  if (!canvases || !Array.isArray(canvases) || canvases.length === 0) return '';
  try {
    await ensureOffscreenDocument();
    let text = '';
    for (const c of canvases) {
      if (!c.dataUrl) continue;
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'RUN_CANVAS_OCR_DIRECT',
          dataUrl: c.dataUrl,
          config: config
        }, (r) => resolve(r));
      });
      if (res && res.success && res.text) {
        text += `\n[CANVAS GRAPHIC #${c.id}]:\n${res.text}\n`;
      }
    }
    return text.trim();
  } catch (e) {
    console.warn('[DrishtiAI Background] Fast canvas decoding skipped:', e);
    return '';
  }
}

// Listen for messages from tab-specific sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && (message.type === 'GET_DOM' || message.type === 'GET_PAGE_CONTEXT')) {
    (async () => {
      try {
        console.log(`\n[DrishtiAI Background] 📥 Step 1/3: Extracting DOM & Context for Tab #${message.tabId}...`);
        const domData = await getTabDOM(message.tabId, message.config);
        
        if (!domData.is_restricted) {
          if (message.full_scan) {
            console.log('[DrishtiAI Background] 🔍 Full Scan requested. Performing deep scroll and multi-viewport OCR stitch...');
            domData.visual_context = await captureAndStitchOCR(message.tabId, message.config, domData.canvases);
          } else if (message.skip_ocr) {
            console.log('[DrishtiAI Background] ⚡ Fast path: Bypassing heavy viewport OCR.');
            if (domData.canvases && domData.canvases.length > 0) {
              domData.visual_context = await decodeCanvasesDirect(domData.canvases, message.config);
            } else {
              domData.visual_context = '';
            }
          } else {
            domData.visual_context = await captureAndRunOCR(message.tabId, message.config, domData.canvases);
          }
        }
        
        console.log(`[DrishtiAI Background] ✅ Context Packaged: ${domData.element_count} elements, OCR text length: ${domData.visual_context?.length || 0}`);
        sendResponse({ success: true, data: domData });
      } catch (err) {
        console.error('[DrishtiAI Background] ❌ Context Extraction Failed:', err.message);
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
                if (!response.data.is_restricted) {
                  response.data.visual_context = await captureAndRunOCR(tabId, message.config, response.data.canvases);
                }
                sendResponse({ success: true, data: response.data });
                return;
              }
            }
          } catch (e) {
            // fallback
          }
        }
        const domData = await getTabDOM(tabId, message.config);
        if (!domData.is_restricted) {
          domData.visual_context = await captureAndRunOCR(tabId, message.config, domData.canvases);
        }
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
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
        tabId = activeTab?.id;
      }

      if (!tabId) {
        sendResponse({ success: false, error: 'NO_ACTIVE_TAB_FOUND' });
        return;
      }

      const ai = message.action;

      // Helper: Resolve URLs and auto-format web search queries
      function resolveTargetUrl(rawVal) {
        let val = (rawVal || '').trim();
        if (!val) return 'https://www.google.com';
        if (/^https?:\/\//i.test(val) || val.startsWith('chrome://') || val.startsWith('about:')) {
          return val;
        }
        const isSearch = val.includes(' ') || !val.includes('.') || /^(search|google)\s+/i.test(val);
        if (isSearch) {
          const cleanQuery = val.replace(/^(search\s+for|search|google)\s+/i, '').trim();
          return 'https://www.google.com/search?q=' + encodeURIComponent(cleanQuery || val);
        }
        return 'https://' + val;
      }

      // Handle NEW_TAB via chrome.tabs.create in background worker
      if (ai && ai.action === 'NEW_TAB') {
        const targetUrl = resolveTargetUrl(ai.value);
        try {
          console.log(`DrishtiAI: Opening new tab at "${targetUrl}"...`);
          const newTab = await chrome.tabs.create({ url: targetUrl, active: true });
          const newTabId = newTab.id;

          // Wait for tab navigation to complete loading
          await new Promise((resolve) => {
            const navTimeout = setTimeout(() => {
              chrome.tabs.onUpdated.removeListener(navListener);
              resolve();
            }, 7000);

            const navListener = (updatedTabId, changeInfo) => {
              if (updatedTabId === newTabId && changeInfo.status === 'complete') {
                clearTimeout(navTimeout);
                chrome.tabs.onUpdated.removeListener(navListener);
                resolve();
              }
            };
            chrome.tabs.onUpdated.addListener(navListener);
          });

          sendResponse({ success: true, tabId: newTabId, navigatedTo: targetUrl, is_new_tab: true });
          return;
        } catch (tabErr) {
          console.error('Background NEW_TAB error:', tabErr);
          sendResponse({ success: false, error: tabErr.message });
          return;
        }
      }

      // Handle NAVIGATE directly via chrome.tabs API in background worker
      if (ai && ai.action === 'NAVIGATE' && ai.value) {
        const targetUrl = resolveTargetUrl(ai.value);

        try {
          console.log(`DrishtiAI: Navigating tab #${tabId} to "${targetUrl}"...`);
          await chrome.tabs.update(tabId, { url: targetUrl });

          // Wait for tab navigation to complete loading
          await new Promise((resolve) => {
            const navTimeout = setTimeout(() => {
              chrome.tabs.onUpdated.removeListener(navListener);
              resolve();
            }, 7000);

            const navListener = (updatedTabId, changeInfo) => {
              if (updatedTabId === tabId && changeInfo.status === 'complete') {
                clearTimeout(navTimeout);
                chrome.tabs.onUpdated.removeListener(navListener);
                resolve();
              }
            };
            chrome.tabs.onUpdated.addListener(navListener);
          });

          sendResponse({ success: true, navigatedTo: targetUrl });
          return;
        } catch (navErr) {
          console.error('Background navigation error:', navErr);
          sendResponse({ success: false, error: navErr.message });
          return;
        }
      }

      // Forward to content script with automatic injection retry fallback
      chrome.tabs.sendMessage(tabId, message, async (res) => {
        if (chrome.runtime.lastError) {
          console.warn('EXECUTE_ACTION failed to reach content script, injecting content.js and retrying...');
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              files: ['content.js']
            });
            await new Promise((r) => setTimeout(r, 100));
            chrome.tabs.sendMessage(tabId, message, (retryRes) => {
              if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse(retryRes || { success: true });
              }
            });
          } catch (injectErr) {
            sendResponse({ success: false, error: injectErr.message });
          }
        } else {
          sendResponse(res || { success: false, error: 'EMPTY_TAB_RESPONSE' });
        }
      });
    })();
    return true;
  }
});
