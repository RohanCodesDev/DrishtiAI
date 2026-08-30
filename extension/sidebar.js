// DrishtiAI Tab-Specific DOM JSON Sidebar Controller & Privacy Firewall Manager
// Exclusively bound to the specific browser tab for which it was opened.

(function () {
  'use strict';

  // DOM Elements
  const jsonOutput = document.getElementById('json-output');
  const countBadge = document.getElementById('element-count-badge');
  const pageTitle = document.getElementById('page-title');
  const copyBtn = document.getElementById('copy-btn');
  const refreshBtn = document.getElementById('refresh-btn');

  // Firewall & Settings Elements
  const settingsToggleBtn = document.getElementById('settings-toggle-btn');
  const settingsPane = document.getElementById('settings-pane');
  const settingsBackdrop = document.getElementById('settings-backdrop');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const firewallStatusStrip = document.getElementById('firewall-status-strip');
  const firewallStatusText = document.getElementById('firewall-status-text');
  const blCountPill = document.getElementById('bl-count-pill');
  const wlCountPill = document.getElementById('wl-count-pill');

  // Preset Buttons
  const presetProtectAll = document.getElementById('preset-protect-all');
  const presetAllowAll = document.getElementById('preset-allow-all');
  const presetReset = document.getElementById('preset-reset');

  // Tag & Input Elements
  const blacklistForm = document.getElementById('blacklist-form');
  const blacklistInput = document.getElementById('blacklist-input');
  const blacklistTags = document.getElementById('blacklist-tags');
  const whitelistForm = document.getElementById('whitelist-form');
  const whitelistInput = document.getElementById('whitelist-input');
  const whitelistTags = document.getElementById('whitelist-tags');

  // Default Firewall Configuration
  const DEFAULT_FIREWALL_CONFIG = {
    rules: {
      email: true,
      phone: true,
      credit_card: true,
      ssn: true,
      aadhaar: true,
      pan_card: true,
      api_key: true,
      ip_address: true,
      crypto_wallet: true,
      passport: true
    },
    custom_blacklist: [],
    custom_whitelist: []
  };

  let currentConfig = JSON.parse(JSON.stringify(DEFAULT_FIREWALL_CONFIG));
  let currentJsonText = '';

  // Read target tabId from URL query parameter (e.g. sidebar.html?tabId=123)
  const urlParams = new URLSearchParams(window.location.search);
  let boundTabId = urlParams.get('tabId') ? parseInt(urlParams.get('tabId'), 10) : null;

  // Normalize configuration from storage
  function normalizeConfig(stored) {
    const config = {
      rules: { ...DEFAULT_FIREWALL_CONFIG.rules },
      custom_blacklist: [],
      custom_whitelist: []
    };

    if (!stored) return config;

    const raw = stored.firewallConfig || stored;

    if (raw.rules && typeof raw.rules === 'object') {
      Object.keys(DEFAULT_FIREWALL_CONFIG.rules).forEach((key) => {
        if (typeof raw.rules[key] === 'boolean') {
          config.rules[key] = raw.rules[key];
        }
      });
    } else if (raw.piiConfig && typeof raw.piiConfig === 'object') {
      // Legacy backward compatibility
      Object.keys(DEFAULT_FIREWALL_CONFIG.rules).forEach((key) => {
        if (typeof raw.piiConfig[key] === 'boolean') {
          config.rules[key] = !raw.piiConfig[key];
        }
      });
    }

    if (Array.isArray(raw.custom_blacklist)) {
      config.custom_blacklist = raw.custom_blacklist.filter(
        (x) => typeof x === 'string' && x.trim().length > 0
      );
    }

    if (Array.isArray(raw.custom_whitelist)) {
      config.custom_whitelist = raw.custom_whitelist.filter(
        (x) => typeof x === 'string' && x.trim().length > 0
      );
    }

    return config;
  }

  // Update UI components (Toggles, Tags, Status Strip)
  function renderConfigUI() {
    // 1. Update Rule Checkbox Toggles
    const toggles = document.querySelectorAll('.rule-toggle');
    toggles.forEach((toggle) => {
      const rule = toggle.dataset.rule;
      if (rule && typeof currentConfig.rules[rule] === 'boolean') {
        toggle.checked = currentConfig.rules[rule];
      }
    });

    // 2. Render Custom Blacklist Tags
    blacklistTags.innerHTML = '';
    if (currentConfig.custom_blacklist.length === 0) {
      blacklistTags.innerHTML = '<span class="empty-hint">No custom blacklist entries</span>';
    } else {
      currentConfig.custom_blacklist.forEach((item, index) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip bl';
        chip.textContent = item;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'tag-remove-btn';
        removeBtn.textContent = '✕';
        removeBtn.title = `Remove "${item}"`;
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeBlacklistItem(index);
        });

        chip.appendChild(removeBtn);
        blacklistTags.appendChild(chip);
      });
    }

    // 3. Render Custom Whitelist Tags
    whitelistTags.innerHTML = '';
    if (currentConfig.custom_whitelist.length === 0) {
      whitelistTags.innerHTML = '<span class="empty-hint">No custom whitelist entries</span>';
    } else {
      currentConfig.custom_whitelist.forEach((item, index) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip wl';
        chip.textContent = item;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'tag-remove-btn';
        removeBtn.textContent = '✕';
        removeBtn.title = `Remove "${item}"`;
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeWhitelistItem(index);
        });

        chip.appendChild(removeBtn);
        whitelistTags.appendChild(chip);
      });
    }

    // 4. Update Status Bar & Pills
    const activeRulesCount = Object.keys(currentConfig.rules).filter(
      (k) => currentConfig.rules[k]
    ).length;
    firewallStatusText.textContent = `Shield Active: ${activeRulesCount} / 10 Rules`;
    blCountPill.textContent = `${currentConfig.custom_blacklist.length} BL`;
    wlCountPill.textContent = `${currentConfig.custom_whitelist.length} WL`;
  }

  // Helper: Resolve active tab ID dynamically
  async function getTargetTabId() {
    if (boundTabId) {
      // Verify tab is still open
      const tab = await chrome.tabs.get(boundTabId).catch(() => null);
      if (tab) return boundTabId;
    }
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.id) {
        boundTabId = activeTab.id;
        return boundTabId;
      }
    }
    return null;
  }

  // Save current config to storage and trigger real-time re-sanitization
  async function saveConfigAndSync() {
    try {
      const targetId = await getTargetTabId();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ firewallConfig: currentConfig });
      }
      renderConfigUI();

      // Send real-time update message to content script
      const response = await chrome.runtime.sendMessage({
        type: 'FIREWALL_CONFIG_UPDATED',
        tabId: targetId,
        config: currentConfig
      });

      if (response && response.success && response.data) {
        renderDOMResult(response.data);
      } else {
        // Fallback to standard extraction
        loadBoundTabDOM();
      }
    } catch (err) {
      console.warn('DrishtiAI: saveConfigAndSync error:', err);
      loadBoundTabDOM();
    }
  }

  // Blacklist Item Management
  function addBlacklistItem(val) {
    const text = val.trim();
    if (!text || currentConfig.custom_blacklist.includes(text)) return;
    currentConfig.custom_blacklist.push(text);
    saveConfigAndSync();
  }

  function removeBlacklistItem(index) {
    if (index >= 0 && index < currentConfig.custom_blacklist.length) {
      currentConfig.custom_blacklist.splice(index, 1);
      saveConfigAndSync();
    }
  }

  // Whitelist Item Management
  function addWhitelistItem(val) {
    const text = val.trim();
    if (!text || currentConfig.custom_whitelist.includes(text)) return;
    currentConfig.custom_whitelist.push(text);
    saveConfigAndSync();
  }

  function removeWhitelistItem(index) {
    if (index >= 0 && index < currentConfig.custom_whitelist.length) {
      currentConfig.custom_whitelist.splice(index, 1);
      saveConfigAndSync();
    }
  }

  // Render DOM Data in Sidebar
  function renderDOMResult(data) {
    countBadge.textContent = `${data.element_count || 0} elements`;
    currentJsonText = JSON.stringify(data, null, 2);
    jsonOutput.textContent = currentJsonText;
  }

  // Extract and render DOM JSON strictly for the bound tab
  async function loadBoundTabDOM() {
    jsonOutput.textContent = 'Extracting DOM structure for this tab...';
    countBadge.textContent = 'Loading...';

    try {
      const tabId = await getTargetTabId();

      if (!tabId) {
        pageTitle.textContent = 'No target tab specified';
        countBadge.textContent = '0 elements';
        currentJsonText = JSON.stringify(
          { error: 'NO_TAB_SPECIFIED', message: 'No target tab associated with this sidebar.' },
          null,
          2
        );
        jsonOutput.textContent = currentJsonText;
        return;
      }

      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) {
        pageTitle.textContent = 'Tab closed';
        countBadge.textContent = 'Closed';
        currentJsonText = JSON.stringify(
          { error: 'TAB_CLOSED', message: 'The associated tab was closed.' },
          null,
          2
        );
        jsonOutput.textContent = currentJsonText;
        return;
      }

      pageTitle.textContent = tab.title ? `${tab.title} (${tab.url})` : (tab.url || `Tab #${tabId}`);

      const response = await chrome.runtime.sendMessage({
        type: 'GET_DOM',
        tabId: tabId,
        config: currentConfig
      });

      if (response && response.success && response.data) {
        renderDOMResult(response.data);
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

  // Settings Pane Open/Close Controls
  function openSettingsPane() {
    settingsPane.classList.add('open');
    settingsPane.setAttribute('aria-hidden', 'false');
    settingsToggleBtn.classList.add('active');
  }

  function closeSettingsPane() {
    settingsPane.classList.remove('open');
    settingsPane.setAttribute('aria-hidden', 'true');
    settingsToggleBtn.classList.remove('active');
  }

  function toggleSettingsPane() {
    if (settingsPane.classList.contains('open')) {
      closeSettingsPane();
    } else {
      openSettingsPane();
    }
  }

  // Initialize Event Listeners
  function initEvents() {
    // Settings Pane Toggle Buttons
    settingsToggleBtn.addEventListener('click', toggleSettingsPane);
    firewallStatusStrip.addEventListener('click', openSettingsPane);
    closeSettingsBtn.addEventListener('click', closeSettingsPane);
    settingsBackdrop.addEventListener('click', closeSettingsPane);

    // Escape key closes settings pane
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && settingsPane.classList.contains('open')) {
        closeSettingsPane();
      }
    });

    // Preset Buttons
    presetProtectAll.addEventListener('click', () => {
      Object.keys(currentConfig.rules).forEach((k) => {
        currentConfig.rules[k] = true;
      });
      saveConfigAndSync();
    });

    presetAllowAll.addEventListener('click', () => {
      Object.keys(currentConfig.rules).forEach((k) => {
        currentConfig.rules[k] = false;
      });
      saveConfigAndSync();
    });

    presetReset.addEventListener('click', () => {
      currentConfig = JSON.parse(JSON.stringify(DEFAULT_FIREWALL_CONFIG));
      saveConfigAndSync();
    });

    // Rule Toggles (Real-Time reflection)
    const toggles = document.querySelectorAll('.rule-toggle');
    toggles.forEach((toggle) => {
      toggle.addEventListener('change', () => {
        const rule = toggle.dataset.rule;
        if (rule) {
          currentConfig.rules[rule] = toggle.checked;
          saveConfigAndSync();
        }
      });
    });

    // Blacklist Form Submission
    blacklistForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = blacklistInput.value;
      if (val) {
        addBlacklistItem(val);
        blacklistInput.value = '';
      }
    });

    // Whitelist Form Submission
    whitelistForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = whitelistInput.value;
      if (val) {
        addWhitelistItem(val);
        whitelistInput.value = '';
      }
    });

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

    // Refresh button
    refreshBtn.addEventListener('click', () => {
      loadBoundTabDOM();
    });

    // Listen for tab switching and navigation events
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.onActivated.addListener(async (activeInfo) => {
        boundTabId = activeInfo.tabId;
        loadBoundTabDOM();
      });

      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tabId === boundTabId && changeInfo.status === 'complete') {
          loadBoundTabDOM();
        }
      });

      chrome.tabs.onRemoved.addListener((tabId) => {
        if (tabId === boundTabId) {
          boundTabId = null;
          pageTitle.textContent = 'Associated tab was closed';
          countBadge.textContent = 'Closed';
          currentJsonText = JSON.stringify(
            { error: 'TAB_CLOSED', message: 'The tab associated with this sidebar was closed.' },
            null,
            2
          );
          jsonOutput.textContent = currentJsonText;
        }
      });
    }

    // Synchronize if storage changes externally
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && (changes.firewallConfig || changes.piiConfig)) {
          const newStored = changes.firewallConfig ? changes.firewallConfig.newValue : changes.piiConfig.newValue;
          currentConfig = normalizeConfig(newStored);
          renderConfigUI();
          loadBoundTabDOM();
        }
      });
    }
  }

  // Initialize Sidebar Controller
  async function init() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['firewallConfig', 'piiConfig']);
      currentConfig = normalizeConfig(stored);
    }
    renderConfigUI();
    initEvents();
    loadBoundTabDOM();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
