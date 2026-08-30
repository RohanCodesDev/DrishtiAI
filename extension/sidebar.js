// DrishtiAI Tab-Specific DOM JSON Sidebar Controller
// Exclusively bound to the specific browser tab for which it was opened.

(function () {
  'use strict';

  const jsonOutput = document.getElementById('json-output');
  const countBadge = document.getElementById('element-count-badge');
  const pageTitle = document.getElementById('page-title');
  const copyBtn = document.getElementById('copy-btn');
  const refreshBtn = document.getElementById('refresh-btn');

  // Read target tabId from URL query parameter (e.g. sidebar.html?tabId=123)
  const urlParams = new URLSearchParams(window.location.search);
  let boundTabId = urlParams.get('tabId') ? parseInt(urlParams.get('tabId'), 10) : null;

  let currentJsonText = '';

  // Extract and render DOM JSON strictly for the bound tab
  async function loadBoundTabDOM() {
    jsonOutput.textContent = 'Extracting DOM structure for this tab...';
    countBadge.textContent = 'Loading...';

    try {
      // If no tabId was passed in query, fallback to active tab once and lock onto it
      if (!boundTabId) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && activeTab.id) {
          boundTabId = activeTab.id;
        }
      }

      if (!boundTabId) {
        pageTitle.textContent = 'No target tab specified';
        countBadge.textContent = '0 elements';
        currentJsonText = JSON.stringify({ error: 'NO_TAB_SPECIFIED', message: 'No target tab associated with this sidebar.' }, null, 2);
        jsonOutput.textContent = currentJsonText;
        return;
      }

      // Fetch tab information
      const tab = await chrome.tabs.get(boundTabId).catch(() => null);
      if (!tab) {
        pageTitle.textContent = 'Tab closed';
        countBadge.textContent = 'Closed';
        currentJsonText = JSON.stringify({ error: 'TAB_CLOSED', message: 'The associated tab was closed.' }, null, 2);
        jsonOutput.textContent = currentJsonText;
        return;
      }

      pageTitle.textContent = tab.title ? `${tab.title} (${tab.url})` : (tab.url || `Tab #${boundTabId}`);

      // Request nested DOM for this specific tab from background service worker
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DOM',
        tabId: boundTabId
      });

      if (response && response.success && response.data) {
        const data = response.data;
        countBadge.textContent = `${data.element_count || 0} elements`;
        currentJsonText = JSON.stringify(data, null, 2);
        jsonOutput.textContent = currentJsonText;
      } else {
        const errObj = {
          error: response?.error || 'EXTRACTION_FAILED',
          message: response?.message || 'Failed to extract DOM from this tab.'
        };
        countBadge.textContent = 'Unavailable';
        currentJsonText = JSON.stringify(errObj, null, 2);
        jsonOutput.textContent = currentJsonText;
      }
    } catch (err) {
      console.error('DrishtiAI: loadBoundTabDOM error:', err);
      countBadge.textContent = 'Error';
      currentJsonText = JSON.stringify({ error: 'COMMUNICATION_ERROR', message: err.message }, null, 2);
      jsonOutput.textContent = currentJsonText;
    }
  }

  // Copy JSON to clipboard
  copyBtn.addEventListener('click', async () => {
    if (!currentJsonText) return;
    try {
      await navigator.clipboard.writeText(currentJsonText);
      const prevText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = prevText;
      }, 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  });

  // Manual refresh button for this tab
  refreshBtn.addEventListener('click', () => {
    loadBoundTabDOM();
  });

  // Listen for updates ONLY on this specific bound tab (navigation / reload)
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (tabId === boundTabId && changeInfo.status === 'complete') {
        loadBoundTabDOM();
      }
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      if (tabId === boundTabId) {
        pageTitle.textContent = 'Associated tab was closed';
        countBadge.textContent = 'Closed';
        currentJsonText = JSON.stringify({ error: 'TAB_CLOSED', message: 'The tab associated with this sidebar was closed.' }, null, 2);
        jsonOutput.textContent = currentJsonText;
      }
    });
  }

  // Initialize PII Settings
  async function initPiiSettings() {
    const toggles = document.querySelectorAll('.pii-toggle');
    const { piiConfig } = await chrome.storage.local.get('piiConfig');
    const config = piiConfig || {};

    toggles.forEach(toggle => {
      const type = toggle.dataset.piiType;
      toggle.checked = config[type] === true;

      toggle.addEventListener('change', async () => {
        const newConfig = {};
        toggles.forEach(t => {
          newConfig[t.dataset.piiType] = t.checked;
        });
        await chrome.storage.local.set({ piiConfig: newConfig });
        loadBoundTabDOM();
      });
    });
  }

  // Automatically fetch DOM on load
  document.addEventListener('DOMContentLoaded', () => {
    initPiiSettings();
    loadBoundTabDOM();
  });
})();
