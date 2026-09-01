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
  const analyzeBtn = document.getElementById('analyze-btn');
  const aiResponseBanner = document.getElementById('ai-response-banner');
  const aiResponseText = document.getElementById('ai-response-text');
  const debugErrorBanner = document.getElementById('debug-error-banner');
  const debugErrorText = document.getElementById('debug-error-text');

  // Firewall & Settings Elements
  const settingsToggleBtn = document.getElementById('settings-toggle-btn');
  const settingsPane = document.getElementById('settings-pane');
  const settingsBackdrop = document.getElementById('settings-backdrop');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const firewallStatusStrip = document.getElementById('firewall-status-strip');
  const firewallStatusText = document.getElementById('firewall-status-text');
  const blCountPill = document.getElementById('bl-count-pill');
  const wlCountPill = document.getElementById('wl-count-pill');
  const ocrCountPill = document.getElementById('ocr-count-pill');

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
  
  const runAgentBtn = document.getElementById('run-agent-btn');
  const taskInput = document.getElementById('task-input');
  const autoLoopCb = document.getElementById('auto-loop-cb');
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

    if (ocrCountPill) {
      const canvasCount = Array.isArray(data?.canvases) ? data.canvases.length : 0;
      if (data && data.visual_context && !data.visual_context.startsWith('(')) {
        ocrCountPill.className = 'tag-pill tag-ocr synced';
        ocrCountPill.textContent = canvasCount > 0 ? `👁️ OCR (${canvasCount} Canvas)` : '👁️ OCR Synced';
        ocrCountPill.title = `Local Vision OCR synchronized: ${canvasCount} canvas graphic(s), ${data.visual_context.length} chars`;
      } else {
        ocrCountPill.className = 'tag-pill tag-ocr';
        ocrCountPill.textContent = canvasCount > 0 ? `👁️ ${canvasCount} Canvas` : '👁️ OCR Active';
        ocrCountPill.title = data?.visual_context || 'Local Vision OCR Engine Ready';
      }
    }
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

      let caughtLastError = null;
      let resType = 'unknown';
      let isResNull = false;
      let isResUndefined = false;

      const getDomPromise = new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'GET_DOM',
          tabId: tabId,
          config: currentConfig
        }, (res) => {
          resType = typeof res;
          isResNull = res === null;
          isResUndefined = res === undefined;

          if (chrome.runtime.lastError) {
            caughtLastError = chrome.runtime.lastError.message || JSON.stringify(chrome.runtime.lastError);
            console.error("Native Messaging Error:", chrome.runtime.lastError);
            resolve(res || { success: false, error: caughtLastError });
          } else {
            resolve(res);
          }
        });
      });

      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: false,
            error: 'TIMEOUT',
            message: 'DOM extraction timed out after 20s. Please ensure tab is responsive.'
          });
        }, 20000);
      });

      const response = await Promise.race([getDomPromise, timeoutPromise]);

      if (debugErrorBanner) {
        debugErrorBanner.style.display = 'none';
        debugErrorText.textContent = '';
      }

      if (response && response.success && response.data) {
        renderDOMResult(response.data);
      } else {
        if (debugErrorBanner) {
          debugErrorBanner.style.display = 'block';
          debugErrorText.textContent = `Type: ${resType} | isNull: ${isResNull} | isUndefined: ${isResUndefined}\nRaw Response: ${JSON.stringify(response, null, 2)}\n\nCaptured Last Error: ${caughtLastError || 'None'}`;
        }
        
        const errObj = {
          error: response?.error || 'EXTRACTION_FAILED',
          message: response?.message || 'Failed to extract DOM from this tab.',
          raw_response: response || null
        };
        countBadge.textContent = 'Unavailable';
        currentJsonText = JSON.stringify(errObj, null, 2);
        jsonOutput.textContent = currentJsonText;
      }
    } catch (err) {
      if (debugErrorBanner) {
        debugErrorBanner.style.display = 'block';
        debugErrorText.textContent = `Exception: ${err.message}\nStack: ${err.stack}\nChrome Last Error: ${chrome.runtime.lastError ? chrome.runtime.lastError.message : 'None'}`;
      }
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

    // Analyze with AI button
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', async () => {
        if (!currentJsonText) return;
        
        const originalText = analyzeBtn.textContent;
        analyzeBtn.textContent = 'Sending...';
        analyzeBtn.disabled = true;
        
        if (aiResponseBanner) aiResponseBanner.style.display = 'flex';
        if (aiResponseText) aiResponseText.textContent = 'Transmitting sanitized DOM to local backend...';

        try {
          const payload = JSON.parse(currentJsonText);
          
          const response = await fetch('http://localhost:3000/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const result = await response.json();
          
          if (result.success && result.ai_response) {
            if (aiResponseText) {
              aiResponseText.innerHTML = `<strong>Action:</strong> ${result.ai_response.action} <br/> <strong>Reason:</strong> ${result.ai_response.reason}`;
            }
          } else {
            if (aiResponseText) aiResponseText.textContent = `Error: ${result.error || 'Unknown error'}`;
          }
        } catch (err) {
          console.error('Analysis failed:', err);
          if (aiResponseText) aiResponseText.textContent = 'Connection failed. Is the backend server running?';
        } finally {
          analyzeBtn.textContent = originalText;
          analyzeBtn.disabled = false;
        }
      });
    }

    if (runAgentBtn && taskInput) {
      async function executeAgentStep(loopCount = 1, actionHistory = []) {
        if (loopCount > 10) {
          if (aiResponseText) aiResponseText.innerHTML += '<br/><strong>Loop Limit Reached (10).</strong>';
          runAgentBtn.textContent = 'Run Agent';
          runAgentBtn.disabled = false;
          return;
        }

        if (!currentJsonText) return;
        
        const userTask = taskInput.value.trim().replace(/^["']+|["']+$/g, '').trim();
        if (!userTask) {
          alert('Please enter an objective for the agent.');
          return;
        }

        runAgentBtn.textContent = `Running (Loop ${loopCount})...`;
        runAgentBtn.disabled = true;
        
        if (aiResponseBanner) aiResponseBanner.style.display = 'flex';
        if (aiResponseText) {
          if (loopCount === 1) aiResponseText.textContent = 'Transmitting to backend...';
        }

        try {
          const payload = JSON.parse(currentJsonText);
          payload.userTask = userTask;
          payload.actionHistory = actionHistory;
          
          const response = await fetch('http://localhost:3000/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const result = await response.json();
          let isDone = false;
          
          if (result.success && result.ai_response && result.ai_response.actions) {
            const actions = result.ai_response.actions;
            
            if (aiResponseText) {
              let html = `<strong>[Loop ${loopCount}] Planned ${actions.length} Actions:</strong><br/>`;
              actions.forEach((ai, idx) => {
                html += `<em>${idx + 1}. ${ai.action}</em>`;
                if (ai.target_id) html += ` (Target: ${ai.target_id})`;
                if (ai.value) html += ` (Value: ${ai.value})`;
                html += `<br/>`;
              });
              aiResponseText.innerHTML = html;
            }
            
            for (const ai of actions) {
              if (ai.action === 'DONE') {
                isDone = true;
                break;
              } else if (ai.action === 'REPLY') {
                // If it's a direct message to the user, render it and record success.
                actionHistory.push({ action: ai.action, target: 'USER', value: ai.value, execution_result: 'SUCCESS' });
                if (aiResponseText) aiResponseText.innerHTML += `<br/><strong style="color: #22c55e;">🤖 Agent Reply:</strong> ${ai.value}`;
                isDone = true; // A reply usually signifies the end of a question objective.
                break;
              } else if (ai.action === 'WAIT') {
                // Actually pause execution for the wait command
                actionHistory.push({ action: ai.action, target: 'N/A', value: '2000ms', execution_result: 'SUCCESS' });
                if (aiResponseText) aiResponseText.innerHTML += `<br/><span style="color: #f59e0b;">⏳ Waiting...</span>`;
                await new Promise(resolve => setTimeout(resolve, 2000));
              } else if (ai.action) {
                // Forward action to background to execute in content script
                const feedback = await new Promise((resolve) => {
                  chrome.runtime.sendMessage({
                    type: 'EXECUTE_ACTION',
                    tabId: boundTabId,
                    action: ai
                  }, (res) => {
                    resolve(res);
                  });
                });
                
                const executionResult = (feedback && feedback.success) ? 'SUCCESS' : ('FAILED: ' + (feedback?.error || 'Unknown error'));
                actionHistory.push({ action: ai.action, target: ai.target_id, value: ai.value, execution_result: executionResult });
                
                // Micro-delay between actions in the same loop
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
          } else if (result.success && result.ai_response && result.ai_response.action) {
            // Fallback for single action response from LLM if it disobeys schema
            const ai = result.ai_response;
            if (aiResponseText) {
              let html = `<strong>[Loop ${loopCount}] Action:</strong> ${ai.action}`;
              if (ai.target_id) html += `<br/> <strong>Target:</strong> ${ai.target_id}`;
              if (ai.value) html += `<br/> <strong>Value:</strong> ${ai.value}`;
              html += `<br/> <strong>Reason:</strong> ${ai.reason}`;
              aiResponseText.innerHTML = html;
            }
            
            if (ai.action === 'DONE') {
              isDone = true;
            } else if (ai.action === 'REPLY') {
              actionHistory.push({ action: ai.action, target: 'USER', value: ai.value, execution_result: 'SUCCESS' });
              if (aiResponseText) aiResponseText.innerHTML += `<br/><strong style="color: #22c55e;">🤖 Agent Reply:</strong> ${ai.value}`;
              isDone = true;
            } else if (ai.action === 'WAIT') {
              actionHistory.push({ action: ai.action, target: 'N/A', value: '2000ms', execution_result: 'SUCCESS' });
              if (aiResponseText) aiResponseText.innerHTML += `<br/><span style="color: #f59e0b;">⏳ Waiting...</span>`;
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else if (ai.action) {
              const feedback = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                  type: 'EXECUTE_ACTION',
                  tabId: boundTabId,
                  action: ai
                }, (res) => {
                  resolve(res);
                });
              });
              
              const executionResult = (feedback && feedback.success) ? 'SUCCESS' : ('FAILED: ' + (feedback?.error || 'Unknown error'));
              actionHistory.push({ action: ai.action, target: ai.target_id, value: ai.value, execution_result: executionResult });
            }
          } else if (result.error === 'RATE_LIMIT_EXCEEDED') {
            if (aiResponseText) aiResponseText.innerHTML += '<br/><strong>⏳ Rate Limit Hit! Backing off for 6 seconds before retrying...</strong>';
            if (autoLoopCb && autoLoopCb.checked) {
              setTimeout(async () => {
                await loadBoundTabDOM();
                executeAgentStep(loopCount, actionHistory); // Retry the exact same loop
              }, 6000);
            }
            return;
          } else {
            if (aiResponseText) aiResponseText.textContent = `Error: ${result.error || result.message || 'Unknown error'}`;
            isDone = true; // Stop loop on error
          }

          // Handle Auto-Looping
          if (!isDone && autoLoopCb && autoLoopCb.checked) {
            if (aiResponseText) {
              aiResponseText.innerHTML += `<br/><br/><div style="padding: 8px; background: #1e3a8a; color: #93c5fd; border-radius: 4px; font-size: 11px; text-align: center; border: 1px dashed #3b82f6;">
                <strong>🔄 Autonomous Mode Active</strong><br/>
                <em>Evaluating results and preparing Loop ${loopCount + 1}...</em>
              </div>`;
            }
            
            // Disable button during auto-loop
            if (runAgentBtn) {
              runAgentBtn.disabled = true;
              runAgentBtn.textContent = 'Agent Running...';
            }
            
            setTimeout(async () => {
              await loadBoundTabDOM();
              executeAgentStep(loopCount + 1, actionHistory);
            }, 2500);
          } else {
            if (runAgentBtn) {
              runAgentBtn.disabled = false;
              runAgentBtn.textContent = 'Run Agent';
            }
          }

        } catch (err) {
          console.error('Analysis failed:', err);
          if (aiResponseText) aiResponseText.textContent = 'Connection failed. Is the backend server running?';
          runAgentBtn.textContent = 'Run Agent';
          runAgentBtn.disabled = false;
        }
      }

      runAgentBtn.addEventListener('click', () => executeAgentStep(1, []));
    }

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
