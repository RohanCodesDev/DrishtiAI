// DrishtiAI Agentic Chat Controller & Privacy Firewall Manager
// Tab-specific persistent autonomous agent interface with live DOM JSON search & inspection.

(function () {
  'use strict';

  // Core DOM Elements
  const chatWorkspace = document.getElementById('chat-workspace');
  const welcomeScreen = document.getElementById('welcome-screen');
  const chatMessages = document.getElementById('chat-messages');
  const agentActivityIndicator = document.getElementById('agent-activity-indicator');
  const activityText = document.getElementById('activity-text');
  
  const pageTitle = document.getElementById('page-title');
  const elementCountBadge = document.getElementById('element-count-badge');
  const contextElementsHint = document.getElementById('context-elements-hint');
  
  // Header Actions
  const newChatBtn = document.getElementById('new-chat-btn');
  const refreshBtn = document.getElementById('refresh-btn');
  const settingsToggleBtn = document.getElementById('settings-toggle-btn');
  
  // Composer Elements
  const taskInput = document.getElementById('task-input');
  const autoLoopCb = document.getElementById('auto-loop-cb');
  const runAgentBtn = document.getElementById('run-agent-btn');
  const stopAgentBtn = document.getElementById('stop-agent-btn');
  const quickChips = document.querySelectorAll('.quick-chip');

  // Settings & Inspector Drawer
  const settingsPane = document.getElementById('settings-pane');
  const settingsBackdrop = document.getElementById('settings-backdrop');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const drawerTabs = document.querySelectorAll('.drawer-tab');
  const tabContentFirewall = document.getElementById('tab-content-firewall');
  const tabContentDom = document.getElementById('tab-content-dom');

  // Firewall Elements
  const firewallStatusText = document.getElementById('firewall-status-text');
  const blCountPill = document.getElementById('bl-count-pill');
  const wlCountPill = document.getElementById('wl-count-pill');
  const presetProtectAll = document.getElementById('preset-protect-all');
  const presetAllowAll = document.getElementById('preset-allow-all');
  const presetReset = document.getElementById('preset-reset');
  const blacklistForm = document.getElementById('blacklist-form');
  const blacklistInput = document.getElementById('blacklist-input');
  const blacklistTags = document.getElementById('blacklist-tags');
  const whitelistForm = document.getElementById('whitelist-form');
  const whitelistInput = document.getElementById('whitelist-input');
  const whitelistTags = document.getElementById('whitelist-tags');

  // DOM JSON Inspector Elements
  const jsonContainer = document.getElementById('json-container');
  const jsonOutput = document.getElementById('json-output');
  const domSearchInput = document.getElementById('dom-search-input');
  const domSearchCount = document.getElementById('dom-search-count');
  const domSearchPrevBtn = document.getElementById('dom-search-prev-btn');
  const domSearchNextBtn = document.getElementById('dom-search-next-btn');
  const domCopyBtn = document.getElementById('dom-copy-btn');
  const domRefreshBtn = document.getElementById('dom-refresh-btn');

  // State Management
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
  let currentDomData = null;
  let chatHistory = [];
  let currentTurn = null;

  let isAgentRunning = false;
  let agentAbortController = null;
  let pendingLoopTimer = null;

  // Search State
  let searchMatches = [];
  let currentMatchIndex = -1;

  // Read target tabId from URL query parameter (e.g. sidebar.html?tabId=123)
  const urlParams = new URLSearchParams(window.location.search);
  let boundTabId = urlParams.get('tabId') ? parseInt(urlParams.get('tabId'), 10) : null;

  // ==========================================================================
  // Helper Utilities
  // ==========================================================================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function formatTime(timestamp) {
    const d = timestamp ? new Date(timestamp) : new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function scrollToBottom() {
    if (chatWorkspace) {
      chatWorkspace.scrollTo({
        top: chatWorkspace.scrollHeight,
        behavior: 'smooth'
      });
    }
  }

  // ==========================================================================
  // Privacy Firewall Configuration & Management
  // ==========================================================================
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

  function renderConfigUI() {
    const toggles = document.querySelectorAll('.rule-toggle');
    toggles.forEach((toggle) => {
      const rule = toggle.dataset.rule;
      if (rule && typeof currentConfig.rules[rule] === 'boolean') {
        toggle.checked = currentConfig.rules[rule];
      }
    });

    // Custom Blacklist Tags
    if (blacklistTags) {
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
    }

    // Custom Whitelist Tags
    if (whitelistTags) {
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
    }

    // Status Bar & Pills
    const activeRulesCount = Object.keys(currentConfig.rules).filter(
      (k) => currentConfig.rules[k]
    ).length;
    if (firewallStatusText) {
      firewallStatusText.textContent = `Shield Active: ${activeRulesCount} / 10 Rules`;
    }
    if (blCountPill) blCountPill.textContent = `${currentConfig.custom_blacklist.length} BL`;
    if (wlCountPill) wlCountPill.textContent = `${currentConfig.custom_whitelist.length} WL`;
  }

  async function getTargetTabId() {
    if (boundTabId) {
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

  async function saveConfigAndSync() {
    try {
      const targetId = await getTargetTabId();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ firewallConfig: currentConfig });
      }
      renderConfigUI();

      const response = await chrome.runtime.sendMessage({
        type: 'FIREWALL_CONFIG_UPDATED',
        tabId: targetId,
        config: currentConfig
      });

      if (response && response.success && response.data) {
        renderDOMResult(response.data);
      } else {
        loadBoundTabDOM();
      }
    } catch (err) {
      console.warn('DrishtiAI: saveConfigAndSync error:', err);
      loadBoundTabDOM();
    }
  }

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

  // ==========================================================================
  // DOM JSON Extraction & Rendering
  // ==========================================================================
  function renderDOMResult(data) {
    currentDomData = data;
    const count = data.element_count || 0;
    if (elementCountBadge) elementCountBadge.textContent = `${count} elements`;
    if (contextElementsHint) contextElementsHint.textContent = `📄 ${count} elements`;
    
    currentJsonText = JSON.stringify(data, null, 2);
    applyDOMSearchOrRaw();
  }

  async function loadBoundTabDOM() {
    if (jsonOutput) jsonOutput.textContent = 'Extracting DOM structure for active tab...';
    if (elementCountBadge) elementCountBadge.textContent = 'Extracting...';

    try {
      const tabId = await getTargetTabId();
      if (!tabId) {
        if (pageTitle) pageTitle.textContent = 'No active tab';
        if (elementCountBadge) elementCountBadge.textContent = '0 elements';
        currentJsonText = JSON.stringify({ error: 'NO_TAB', message: 'No target tab available.' }, null, 2);
        applyDOMSearchOrRaw();
        return;
      }

      const tab = await chrome.tabs.get(tabId).catch(() => null);
      if (!tab) {
        if (pageTitle) pageTitle.textContent = 'Tab closed';
        if (elementCountBadge) elementCountBadge.textContent = 'Closed';
        currentJsonText = JSON.stringify({ error: 'TAB_CLOSED', message: 'The active tab was closed.' }, null, 2);
        applyDOMSearchOrRaw();
        return;
      }

      if (pageTitle) {
        pageTitle.textContent = tab.title ? `${tab.title} (${tab.url})` : (tab.url || `Tab #${tabId}`);
      }

      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'GET_DOM',
          tabId: tabId,
          config: currentConfig
        }, (res) => {
          resolve(res);
        });
      });

      if (response && response.success && response.data) {
        renderDOMResult(response.data);
      } else {
        const fallbackData = {
          title: tab.title || (tab.url && tab.url.startsWith('chrome://newtab') ? 'New Tab' : 'Active Page'),
          url: tab.url || 'chrome://newtab',
          element_count: 1,
          is_fallback: true,
          root: {
            id: 'drishti-tab-root',
            tag: 'BODY',
            type: 'root',
            text: `Active tab is on ${tab.title || 'New Tab'} (${tab.url || 'chrome://newtab'}). Ready for navigation. To visit a website, issue a NAVIGATE action with target URL.`,
            children: []
          },
          visual_context: `(Active tab at ${tab.url || 'chrome://newtab'})`
        };
        renderDOMResult(fallbackData);
      }
    } catch (err) {
      console.error('DrishtiAI: loadBoundTabDOM error:', err);
      const fallbackData = {
        title: 'Active Tab',
        url: 'chrome://newtab',
        element_count: 1,
        is_fallback: true,
        root: {
          id: 'drishti-err-fallback-root',
          tag: 'BODY',
          type: 'root',
          text: `Ready for navigation. Issue a NAVIGATE action to go to a website.`,
          children: []
        },
        visual_context: '(Ready for navigation)'
      };
      renderDOMResult(fallbackData);
    }
  }

  // ==========================================================================
  // DOM JSON Search Engine
  // ==========================================================================
  function applyDOMSearchOrRaw() {
    if (!jsonOutput) return;

    const query = domSearchInput ? domSearchInput.value.trim() : '';
    if (!query || !currentJsonText) {
      jsonOutput.textContent = currentJsonText || 'No DOM structure loaded.';
      if (domSearchCount) domSearchCount.textContent = '0 matches';
      if (domSearchPrevBtn) domSearchPrevBtn.disabled = true;
      if (domSearchNextBtn) domSearchNextBtn.disabled = true;
      searchMatches = [];
      currentMatchIndex = -1;
      return;
    }

    try {
      const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
      const parts = currentJsonText.split(regex);
      
      let matchIdx = 0;
      const htmlParts = parts.map((part) => {
        if (regex.test(part)) {
          const mHtml = `<mark class="search-match" data-match-idx="${matchIdx}">${escapeHtml(part)}</mark>`;
          matchIdx++;
          return mHtml;
        }
        return escapeHtml(part);
      });

      jsonOutput.innerHTML = htmlParts.join('');
      searchMatches = Array.from(jsonOutput.querySelectorAll('.search-match'));

      if (searchMatches.length > 0) {
        currentMatchIndex = 0;
        highlightActiveMatch();
        if (domSearchPrevBtn) domSearchPrevBtn.disabled = false;
        if (domSearchNextBtn) domSearchNextBtn.disabled = false;
      } else {
        currentMatchIndex = -1;
        if (domSearchCount) domSearchCount.textContent = '0 matches';
        if (domSearchPrevBtn) domSearchPrevBtn.disabled = true;
        if (domSearchNextBtn) domSearchNextBtn.disabled = true;
      }
    } catch (e) {
      console.warn('Search regex error:', e);
      jsonOutput.textContent = currentJsonText;
    }
  }

  function highlightActiveMatch() {
    searchMatches.forEach((el, idx) => {
      if (idx === currentMatchIndex) {
        el.classList.add('active-match');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        el.classList.remove('active-match');
      }
    });

    if (domSearchCount) {
      domSearchCount.textContent = `${currentMatchIndex + 1} of ${searchMatches.length}`;
    }
  }

  function nextSearchMatch() {
    if (searchMatches.length === 0) return;
    currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
    highlightActiveMatch();
  }

  function prevSearchMatch() {
    if (searchMatches.length === 0) return;
    currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    highlightActiveMatch();
  }

  // ==========================================================================
  // Agentic Chat History & Renderer
  // ==========================================================================
  async function loadChatHistory(tabId) {
    if (!tabId) return;
    try {
      const key = `drishti_chat_history_${tabId}`;
      const res = await chrome.storage.local.get([key]);
      chatHistory = Array.isArray(res[key]) ? res[key] : [];
      renderAllChatHistory();
    } catch (err) {
      console.warn('DrishtiAI: loadChatHistory error:', err);
    }
  }

  async function saveChatHistory() {
    const tabId = await getTargetTabId();
    if (!tabId) return;
    try {
      const key = `drishti_chat_history_${tabId}`;
      await chrome.storage.local.set({ [key]: chatHistory });
    } catch (err) {
      console.warn('DrishtiAI: saveChatHistory error:', err);
    }
  }

  function renderAllChatHistory() {
    if (!chatMessages || !welcomeScreen) return;

    if (chatHistory.length === 0) {
      welcomeScreen.style.display = 'flex';
      chatMessages.style.display = 'none';
      chatMessages.innerHTML = '';
      return;
    }

    welcomeScreen.style.display = 'none';
    chatMessages.style.display = 'flex';
    chatMessages.innerHTML = '';

    chatHistory.forEach((turn, turnIdx) => {
      const turnEl = document.createElement('div');
      turnEl.className = 'chat-turn';
      turnEl.dataset.turnIdx = turnIdx;

      // 1. User Bubble
      const userWrap = document.createElement('div');
      userWrap.className = 'user-msg-wrapper';
      userWrap.innerHTML = `
        <div class="user-bubble">
          <div class="user-meta">
            <span>👤 You</span> • <span>${formatTime(turn.timestamp)}</span>
          </div>
          <div>${escapeHtml(turn.userPrompt)}</div>
        </div>
      `;
      turnEl.appendChild(userWrap);

      // 2. Agent Cards for each loop in this turn
      if (Array.isArray(turn.loops)) {
        turn.loops.forEach((loop) => {
          const card = createAgentCardElement(loop);
          turnEl.appendChild(card);
        });
      }

      chatMessages.appendChild(turnEl);
    });

    scrollToBottom();
  }

  function createAgentCardElement(loop) {
    const card = document.createElement('div');
    card.className = 'agent-card';
    card.dataset.loop = loop.loopCount;

    // Header
    let headerHtml = `
      <div class="agent-header">
        <div class="agent-header-left">
          <span class="agent-avatar">🤖</span>
          <span class="agent-name">Drishti Agent</span>
          <span class="loop-badge">Loop ${loop.loopCount}</span>
        </div>
      </div>
    `;

    // Thought / Reason
    let thoughtHtml = '';
    if (loop.thought) {
      thoughtHtml = `<div class="agent-thought">${escapeHtml(loop.thought)}</div>`;
    }

    // Actions Plan
    let actionsHtml = '';
    if (Array.isArray(loop.actions) && loop.actions.length > 0) {
      actionsHtml = `
        <div class="actions-plan-container">
          <div class="actions-plan-header">Planned Actions (${loop.actions.length})</div>
          <div class="actions-list">
      `;

      loop.actions.forEach((ai, idx) => {
        let details = '';
        if (ai.target_id) details += ` Target: <strong>${escapeHtml(ai.target_id)}</strong>`;
        if (ai.value) details += ` Value: <em>"${escapeHtml(ai.value)}"</em>`;
        if (!details && ai.reason) details = ` ${escapeHtml(ai.reason)}`;

        let statusClass = 'success';
        let statusText = '✓ Done';
        if (ai.status === 'running') {
          statusClass = 'running';
          statusText = '⏳ Executing';
        } else if (ai.status === 'failed') {
          statusClass = 'failed';
          statusText = `✕ Failed (${escapeHtml(ai.error || 'Error')})`;
        } else if (ai.status === 'pending') {
          statusClass = 'running';
          statusText = '...';
        }

        actionsHtml += `
          <div class="action-step-item" id="action-step-${loop.loopCount}-${idx}">
            <span class="action-badge ${escapeHtml(ai.action)}">${escapeHtml(ai.action)}</span>
            <span class="action-details">${details}</span>
            <span class="action-status-pill ${statusClass}">${statusText}</span>
          </div>
        `;
      });

      actionsHtml += `</div></div>`;
    }

    // Direct Reply Box
    let replyHtml = '';
    if (loop.reply) {
      replyHtml = `
        <div class="agent-reply-box">
          <div class="agent-reply-header">
            <span>💬</span> Drishti Reply
          </div>
          <div>${escapeHtml(loop.reply)}</div>
        </div>
      `;
    }

    // Status Banner
    let bannerHtml = '';
    if (loop.banner) {
      bannerHtml = `<div class="status-pill-banner ${escapeHtml(loop.banner.type)}">${loop.banner.html}</div>`;
    }

    card.innerHTML = headerHtml + thoughtHtml + actionsHtml + replyHtml + bannerHtml;
    return card;
  }

  function showActivityIndicator(text = 'Drishti is reasoning...') {
    if (agentActivityIndicator && activityText) {
      activityText.textContent = text;
      agentActivityIndicator.style.display = 'flex';
      scrollToBottom();
    }
  }

  function hideActivityIndicator() {
    if (agentActivityIndicator) {
      agentActivityIndicator.style.display = 'none';
    }
  }

  function setAgentRunningState(running) {
    isAgentRunning = running;
    if (runAgentBtn) {
      runAgentBtn.disabled = running;
      runAgentBtn.innerHTML = running ? '<span>⏳</span> ...' : '<span>➤</span> Run';
    }
    if (stopAgentBtn) {
      stopAgentBtn.disabled = !running;
    }
    if (taskInput) {
      taskInput.disabled = running;
    }
  }

  function stopAgentExecution() {
    if (!isAgentRunning) return;
    isAgentRunning = false;
    
    if (pendingLoopTimer) {
      clearTimeout(pendingLoopTimer);
      pendingLoopTimer = null;
    }
    
    if (agentAbortController) {
      try {
        agentAbortController.abort();
      } catch (e) {}
      agentAbortController = null;
    }

    hideActivityIndicator();
    setAgentRunningState(false);

    // Append Stopped Banner to current loop if active
    if (currentTurn && currentTurn.loops && currentTurn.loops.length > 0) {
      const activeLoop = currentTurn.loops[currentTurn.loops.length - 1];
      activeLoop.banner = {
        type: 'stopped',
        html: '<strong>⏹ Agent stopped by user.</strong>'
      };
      renderAllChatHistory();
      saveChatHistory();
    }
  }

  function cancellableDelay(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      if (agentAbortController) {
        agentAbortController.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve();
        }, { once: true });
      }
    });
  }

  // ==========================================================================
  // Agent Execution Flow
  // ==========================================================================
  async function startAgentRun(objectiveText) {
    if (isAgentRunning) return;
    const task = (objectiveText || (taskInput ? taskInput.value : '')).trim();
    if (!task) {
      alert('Please enter an objective for the agent.');
      return;
    }

    if (!currentJsonText) {
      alert('Extracting page context. Please wait a moment...');
      await loadBoundTabDOM();
      if (!currentJsonText) return;
    }

    if (taskInput) taskInput.value = '';

    // Create new Chat Turn
    currentTurn = {
      userPrompt: task,
      timestamp: Date.now(),
      loops: []
    };
    chatHistory.push(currentTurn);
    renderAllChatHistory();

    agentAbortController = new AbortController();
    setAgentRunningState(true);

    executeAgentStep(1, []);
  }

  async function executeAgentStep(loopCount = 1, actionHistory = []) {
    if (!isAgentRunning) return;

    if (loopCount > 10) {
      hideActivityIndicator();
      if (currentTurn) {
        const lastLoop = currentTurn.loops[currentTurn.loops.length - 1] || {};
        lastLoop.banner = {
          type: 'backoff',
          html: '<strong>⚠️ Safety Loop Limit (10) reached.</strong>'
        };
        renderAllChatHistory();
        saveChatHistory();
      }
      setAgentRunningState(false);
      return;
    }

    showActivityIndicator(`Loop ${loopCount}: Observing page & reasoning...`);

    const loopData = {
      loopCount: loopCount,
      thought: '',
      actions: [],
      reply: '',
      isDone: false,
      banner: null
    };
    currentTurn.loops.push(loopData);
    renderAllChatHistory();

    try {
      const payload = JSON.parse(currentJsonText);
      payload.userTask = currentTurn.userPrompt;
      payload.actionHistory = actionHistory;

      const response = await fetch('http://localhost:3000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: agentAbortController ? agentAbortController.signal : undefined
      });

      if (!isAgentRunning) return;

      const result = await response.json();
      if (!isAgentRunning) return;

      let isDone = false;

      if (result.success && result.ai_response && result.ai_response.actions) {
        const rawActions = result.ai_response.actions;
        loopData.thought = result.ai_response.reason || `Determined ${rawActions.length} actions for this step.`;
        loopData.actions = rawActions.map((a) => ({
          ...a,
          status: 'pending'
        }));
        renderAllChatHistory();

        // Sequential execution of planned actions
        for (let i = 0; i < rawActions.length; i++) {
          if (!isAgentRunning) {
            isDone = true;
            break;
          }

          const ai = rawActions[i];
          loopData.actions[i].status = 'running';
          renderAllChatHistory();

          if (ai.action === 'DONE') {
            loopData.actions[i].status = 'success';
            isDone = true;
            loopData.banner = {
              type: 'done',
              html: '<strong>🎯 Objective Successfully Completed.</strong>'
            };
            break;
          } else if (ai.action === 'REPLY') {
            loopData.actions[i].status = 'success';
            loopData.reply = ai.value || 'Done.';
            actionHistory.push({ action: ai.action, target: 'USER', value: ai.value, execution_result: 'SUCCESS' });
            isDone = true;
            break;
          } else if (ai.action === 'WAIT') {
            showActivityIndicator(`Loop ${loopCount}: Waiting 2000ms...`);
            actionHistory.push({ action: ai.action, target: 'N/A', value: '2000ms', execution_result: 'SUCCESS' });
            await cancellableDelay(2000);
            loopData.actions[i].status = 'success';
            if (!isAgentRunning) {
              isDone = true;
              break;
            }
          } else if (ai.action) {
            showActivityIndicator(`Loop ${loopCount}: Executing ${ai.action} on ${ai.target_id || 'page'}...`);
            const feedback = await new Promise((resolve) => {
              chrome.runtime.sendMessage({
                type: 'EXECUTE_ACTION',
                tabId: boundTabId,
                action: ai
              }, (res) => {
                resolve(res);
              });
            });

            const success = feedback && feedback.success;
            loopData.actions[i].status = success ? 'success' : 'failed';
            loopData.actions[i].error = feedback?.error;

            const execRes = success ? 'SUCCESS' : ('FAILED: ' + (feedback?.error || 'Unknown'));
            actionHistory.push({ action: ai.action, target: ai.target_id, value: ai.value, execution_result: execRes });

            if (ai.action === 'NAVIGATE' && success) {
              showActivityIndicator(`Navigated to ${ai.value}. Extracting fresh page DOM...`);
              await loadBoundTabDOM();
            }

            await cancellableDelay(100);
            if (!isAgentRunning) {
              isDone = true;
              break;
            }
          }
        }
      } else if (result.success && result.ai_response && result.ai_response.action) {
        // Fallback for single action response
        const ai = result.ai_response;
        loopData.thought = ai.reason || 'Executing determined action.';
        loopData.actions = [{ ...ai, status: 'running' }];
        renderAllChatHistory();

        if (ai.action === 'DONE') {
          loopData.actions[0].status = 'success';
          isDone = true;
          loopData.banner = {
            type: 'done',
            html: '<strong>🎯 Objective Successfully Completed.</strong>'
          };
        } else if (ai.action === 'REPLY') {
          loopData.actions[0].status = 'success';
          loopData.reply = ai.value;
          actionHistory.push({ action: ai.action, target: 'USER', value: ai.value, execution_result: 'SUCCESS' });
          isDone = true;
        } else if (ai.action === 'WAIT') {
          await cancellableDelay(2000);
          loopData.actions[0].status = 'success';
          actionHistory.push({ action: ai.action, target: 'N/A', value: '2000ms', execution_result: 'SUCCESS' });
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

          const success = feedback && feedback.success;
          loopData.actions[0].status = success ? 'success' : 'failed';
          loopData.actions[0].error = feedback?.error;

          const execRes = success ? 'SUCCESS' : ('FAILED: ' + (feedback?.error || 'Unknown'));
          actionHistory.push({ action: ai.action, target: ai.target_id, value: ai.value, execution_result: execRes });

          if (ai.action === 'NAVIGATE' && success) {
            showActivityIndicator(`Navigated to ${ai.value}. Extracting fresh page DOM...`);
            await loadBoundTabDOM();
          }
        }
      } else if (result.error === 'RATE_LIMIT_EXCEEDED') {
        if (!isAgentRunning) return;
        loopData.banner = {
          type: 'backoff',
          html: '<strong>⏳ Rate limit reached. Backing off for 6s before retry...</strong>'
        };
        renderAllChatHistory();

        if (autoLoopCb && autoLoopCb.checked) {
          showActivityIndicator('Backing off for 6s...');
          pendingLoopTimer = setTimeout(async () => {
            pendingLoopTimer = null;
            if (!isAgentRunning) return;
            await loadBoundTabDOM();
            if (!isAgentRunning) return;
            executeAgentStep(loopCount, actionHistory);
          }, 6000);
        } else {
          setAgentRunningState(false);
          hideActivityIndicator();
        }
        saveChatHistory();
        return;
      } else {
        loopData.banner = {
          type: 'error',
          html: `<strong>⚠️ Error: ${escapeHtml(result.error || result.message || 'Unknown backend error')}</strong>`
        };
        isDone = true;
      }

      renderAllChatHistory();
      saveChatHistory();

      // Auto-looping for next step
      if (!isDone && autoLoopCb && autoLoopCb.checked && isAgentRunning) {
        showActivityIndicator(`Preparing Autonomous Loop ${loopCount + 1}...`);
        pendingLoopTimer = setTimeout(async () => {
          pendingLoopTimer = null;
          if (!isAgentRunning) return;
          await loadBoundTabDOM();
          if (!isAgentRunning) return;
          executeAgentStep(loopCount + 1, actionHistory);
        }, 2200);
      } else {
        hideActivityIndicator();
        setAgentRunningState(false);
      }

    } catch (err) {
      hideActivityIndicator();
      if (err.name === 'AbortError' || !isAgentRunning) {
        setAgentRunningState(false);
        return;
      }
      console.error('Agent execution error:', err);
      const isFetchErr = err instanceof TypeError || (err.message && err.message.toLowerCase().includes('fetch'));
      const errorMsg = isFetchErr
        ? '⚠️ Connection Failed: Is the local backend server running on port 3000?'
        : `⚠️ Error: ${err.message || 'Execution error'}`;
      loopData.banner = {
        type: 'error',
        html: `<strong>${escapeHtml(errorMsg)}</strong>`
      };
      renderAllChatHistory();
      saveChatHistory();
      setAgentRunningState(false);
    }
  }

  // ==========================================================================
  // Drawer / Settings Open & Tab Switching Controls
  // ==========================================================================
  function openSettingsPane() {
    if (settingsPane) {
      settingsPane.classList.add('open');
      settingsPane.setAttribute('aria-hidden', 'false');
    }
    if (settingsToggleBtn) settingsToggleBtn.classList.add('active');
  }

  function closeSettingsPane() {
    if (settingsPane) {
      settingsPane.classList.remove('open');
      settingsPane.setAttribute('aria-hidden', 'true');
    }
    if (settingsToggleBtn) settingsToggleBtn.classList.remove('active');
  }

  function toggleSettingsPane() {
    if (settingsPane && settingsPane.classList.contains('open')) {
      closeSettingsPane();
    } else {
      openSettingsPane();
    }
  }

  function switchDrawerTab(targetTab) {
    drawerTabs.forEach((tab) => {
      if (tab.dataset.tab === targetTab) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    if (targetTab === 'firewall') {
      if (tabContentFirewall) tabContentFirewall.classList.add('active');
      if (tabContentDom) tabContentDom.classList.remove('active');
    } else if (targetTab === 'dom') {
      if (tabContentFirewall) tabContentFirewall.classList.remove('active');
      if (tabContentDom) tabContentDom.classList.add('active');
      applyDOMSearchOrRaw();
    }
  }

  // ==========================================================================
  // Event Listeners Setup
  // ==========================================================================
  function initEvents() {
    // Drawer open / close
    if (settingsToggleBtn) settingsToggleBtn.addEventListener('click', toggleSettingsPane);
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', closeSettingsPane);
    if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettingsPane);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && settingsPane && settingsPane.classList.contains('open')) {
        closeSettingsPane();
      }
    });

    // Drawer tab switcher
    drawerTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        if (target) switchDrawerTab(target);
      });
    });

    // New Chat / Clear Conversation
    if (newChatBtn) {
      newChatBtn.addEventListener('click', async () => {
        if (isAgentRunning) stopAgentExecution();
        chatHistory = [];
        currentTurn = null;
        const tabId = await getTargetTabId();
        if (tabId) {
          await chrome.storage.local.remove([`drishti_chat_history_${tabId}`]);
        }
        renderAllChatHistory();
      });
    }

    // Refresh DOM button
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => loadBoundTabDOM());
    }
    if (domRefreshBtn) {
      domRefreshBtn.addEventListener('click', () => loadBoundTabDOM());
    }

    // Copy JSON button
    if (domCopyBtn) {
      domCopyBtn.addEventListener('click', async () => {
        if (!currentJsonText) return;
        try {
          await navigator.clipboard.writeText(currentJsonText);
          const origText = domCopyBtn.textContent;
          domCopyBtn.textContent = 'Copied!';
          setTimeout(() => {
            domCopyBtn.textContent = origText;
          }, 1500);
        } catch (err) {
          console.error('Copy JSON failed:', err);
        }
      });
    }

    // Quick Prompt Chips
    quickChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (prompt) {
          if (taskInput) taskInput.value = prompt;
          startAgentRun(prompt);
        }
      });
    });

    // Composer Input & Send
    if (taskInput) {
      taskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          startAgentRun();
        }
      });
    }

    if (runAgentBtn) {
      runAgentBtn.addEventListener('click', () => startAgentRun());
    }

    if (stopAgentBtn) {
      stopAgentBtn.addEventListener('click', stopAgentExecution);
    }

    // DOM Search Controls
    if (domSearchInput) {
      domSearchInput.addEventListener('input', () => applyDOMSearchOrRaw());
      domSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (e.shiftKey) prevSearchMatch();
          else nextSearchMatch();
        }
      });
    }

    if (domSearchPrevBtn) domSearchPrevBtn.addEventListener('click', prevSearchMatch);
    if (domSearchNextBtn) domSearchNextBtn.addEventListener('click', nextSearchMatch);

    // Firewall Preset Buttons
    if (presetProtectAll) {
      presetProtectAll.addEventListener('click', () => {
        Object.keys(currentConfig.rules).forEach((k) => {
          currentConfig.rules[k] = true;
        });
        saveConfigAndSync();
      });
    }

    if (presetAllowAll) {
      presetAllowAll.addEventListener('click', () => {
        Object.keys(currentConfig.rules).forEach((k) => {
          currentConfig.rules[k] = false;
        });
        saveConfigAndSync();
      });
    }

    if (presetReset) {
      presetReset.addEventListener('click', () => {
        currentConfig = JSON.parse(JSON.stringify(DEFAULT_FIREWALL_CONFIG));
        saveConfigAndSync();
      });
    }

    // Rule Toggles
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

    // Blacklist & Whitelist Forms
    if (blacklistForm && blacklistInput) {
      blacklistForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = blacklistInput.value;
        if (val) {
          addBlacklistItem(val);
          blacklistInput.value = '';
        }
      });
    }

    if (whitelistForm && whitelistInput) {
      whitelistForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = whitelistInput.value;
        if (val) {
          addWhitelistItem(val);
          whitelistInput.value = '';
        }
      });
    }

    // Chrome Tabs Lifecycle Listeners
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.onActivated.addListener(async (activeInfo) => {
        boundTabId = activeInfo.tabId;
        loadChatHistory(boundTabId);
        loadBoundTabDOM();
      });

      chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (tabId === boundTabId && changeInfo.status === 'complete') {
          loadBoundTabDOM();
        }
      });

      chrome.tabs.onRemoved.addListener((tabId) => {
        if (tabId === boundTabId) {
          boundTabId = null;
          if (pageTitle) pageTitle.textContent = 'Associated tab was closed';
          if (elementCountBadge) elementCountBadge.textContent = 'Closed';
          currentJsonText = JSON.stringify({ error: 'TAB_CLOSED', message: 'The active tab was closed.' }, null, 2);
          applyDOMSearchOrRaw();
        }
      });
    }

    // Sync if storage changes externally
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

  // ==========================================================================
  // Initialization
  // ==========================================================================
  async function init() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const stored = await chrome.storage.local.get(['firewallConfig', 'piiConfig']);
      currentConfig = normalizeConfig(stored);
    }
    renderConfigUI();
    initEvents();

    const tabId = await getTargetTabId();
    if (tabId) {
      await loadChatHistory(tabId);
    }
    loadBoundTabDOM();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

