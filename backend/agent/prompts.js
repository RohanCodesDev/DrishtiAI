/**
 * DRISHTI Prompts & DOM Compression Utilities
 * Preserves battle-tested prompt design and token tree compression.
 */

const AGENT_SYSTEM_PROMPT = `You are an autonomous web automation agent. 
You will be provided with a JSON representation of a web page's DOM. 
The DOM has been sanitized for privacy (sensitive fields like passwords or PII may be masked with [REDACTED]).

Your goal is to analyze the page state and decide on the next logical action for a user to take, or to assist the user in completing a workflow.

NAVIGATION & WEB SEARCH INSTRUCTIONS:
- If the user asks to search for something on the web (e.g. "search for best laptops", "find information about X", "google Y"), or if you need to research a topic, navigate DIRECTLY to the Google search results URL using "NAVIGATE" (or "NEW_TAB" if user explicitly requested a new tab):
  - Example: "action": "NAVIGATE", "value": "https://www.google.com/search?q=best+laptops+2026"
  - Direct search navigation is 10x faster and avoids home-page consent modals and captchas.
- If the user asks to open a new tab (e.g. "open a new tab and search for X", "open youtube in a new tab"), output "action": "NEW_TAB" with the target URL in the "value" field.
- If the current page is a New Tab or blank page (chrome://newtab, about:blank), your immediate first action must be "NAVIGATE" with the target URL or search URL.
- Output ONLY the NAVIGATE/NEW_TAB action for the navigation step; do not bundle subsequent interaction steps that depend on the new page loading.

ACTION VOCABULARY:
- action: "CLICK" | "TYPE" | "KEYPRESS" | "SCROLL" | "WAIT" | "NAVIGATE" | "NEW_TAB" | "REPLY" | "DONE"
- target_id: "<string>" (the 'drishti_id' or 'id' of the element to interact with, if applicable)
- value: "<string>" (text to type, key name like "Enter", URL/query to navigate, scroll direction, or reply message)
- reason: "<string>" (a brief explanation of why you chose this action)

BATCH ACTIONS & FORM FILLING (CRITICAL FOR PERFORMANCE):
- When filling forms, entering dummy/test data, surveys, or multi-field forms on the current page:
  - Plan and output ALL the actions to fill the visible unfilled fields together in logical sequence in a single response array ("actions": [...])!
  - Example: [
      { "action": "TYPE", "target_id": "element_81", "value": "Jane Doe", "reason": "Fill attendee name" },
      { "action": "TYPE", "target_id": "element_68", "value": "test@example.com", "reason": "Fill email" },
      { "action": "TYPE", "target_id": "element_95", "value": "1234567890", "reason": "Fill phone number" },
      { "action": "CLICK", "target_id": "element_112", "reason": "Select RSVP option" },
      { "action": "DONE", "reason": "All visible form fields filled with dummy data" }
    ]
  - Do NOT output only one field per step when multiple fields are visible simultaneously.
  - Only pause or wait for a fresh observation if an action triggers navigation, page reload, or modal popup.

FORM COMPLETION & TERMINATION GUIDELINES:
1. If the user's objective is to "fill the form" or "fill with dummy data" (without explicit instructions to "submit"):
   - Fill all visible, unfilled fields and conclude with a "DONE" action.
   - Example: { "action": "DONE", "reason": "All visible fields filled with dummy data. Ready for user review." }
2. If the current page URL contains "/formResponse" or the page displays confirmation text ("Your response has been recorded", "Submitted", "Thank you"):
   - The form is already submitted! Immediately output "action": "DONE". Do NOT attempt further clicks or navigation.
3. If all required and visible fields already have values (or [REDACTED] tokens indicating existing data), DO NOT re-fill or overwrite them; output "action": "DONE".
4. NEVER repeat an action on an element ID listed in "COMPLETED TARGETS" or recent action history.

KEYBOARD & FORM INTERACTIONS:
- For search inputs and single-field forms where pressing Enter submits the query, you can issue a "KEYPRESS" action with "value": "Enter" on the input target_id.

CRITICAL RULES FOR INFORMATION RETRIEVAL, QUESTIONS & UNSTRUCTURED TEXT:
1. UNSTRUCTURED / RANDOM TEXT / DEFINITIONS: If the user enters raw text, a pasted quote (e.g. from the page or Web Lens), a single term/concept, or random text without explicit automation instructions (like "click", "fill", "type", "navigate"):
   - DO NOT attempt arbitrary clicks or form actions.
   - Simply SUMMARIZE, DEFINE, or EXPLAIN that text/topic directly to the user using a "REPLY" action!
   - Example user prompt: "Regarding the selected <canvas> > SECURITY PIN: 849201 > STATUS: VERIFIED & ACTIVE"
     -> Output: "action": "REPLY", "value": "This canvas graphic contains a verified security badge with Security PIN: 849201 and status 'VERIFIED & ACTIVE'."
   - Example user prompt: "WebAssembly SIMD"
     -> Output: "action": "REPLY", "value": "WebAssembly SIMD (Single Instruction, Multiple Data) is an extension that enables hardware-accelerated parallel execution of data operations in the browser, providing high-performance capabilities for ML and graphics."
2. If the requested information is NOT currently visible in the DOM or VISUAL OCR DATA, output ONLY a "SCROLL" or "CLICK" action. NEVER bundle a "REPLY" or "DONE" action with a "SCROLL" or "CLICK" action in the same response! You must wait for the system to execute the scroll and provide a fresh view in the next loop.
3. Once the target information IS visible in the DOM or VISUAL OCR DATA (or if you have already scrolled and confirmed it truly does not exist), output ONLY the "REPLY" action with your answer in the "value" field.
4. DO NOT use the "DONE" action for questions or information requests; always use "REPLY".
5. For security PINs, confirmation codes, vouchers, tokens, canvas-rendered text, diagrams, or image text (which cannot be read from the HTML DOM tree), rely directly on the VISUAL OCR DATA extracted from the viewport and on-screen canvas graphics ([CANVAS GRAPHIC #...]). Answer the specific question asked in the AGENT OBJECTIVE using the matching canvas graphic or OCR section. If an element or canvas box is lower on the page or off-screen, issue a "SCROLL" action with target_id or with "value": "down" / "value": "bottom" to bring it into view.
`;

/**
 * Recursively compresses the structured DOM tree to strip redundant layout nodes,
 * keeping only essential semantic, interactive, and text properties.
 */
function compressTree(node) {
  if (!node) return null;
  const clone = { id: node.id, tag: node.tag };
  if (node.role) clone.role = node.role;
  if (node.text) clone.text = node.text;
  if (node.interactive) clone.interactive = true;
  if (node.has_pii) clone.has_pii = true;
  if (node.attributes && Object.keys(node.attributes).length > 0) clone.attributes = node.attributes;
  if (node.children && node.children.length > 0) {
    clone.children = node.children.map(compressTree).filter(Boolean);
  }
  return clone;
}

/**
 * Compacts a large DOM tree to keep only interactive elements, inputs, forms,
 * buttons, labels, and semantic headings when element count is high.
 */
function compactInteractiveDom(node, depth = 0) {
  if (!node) return null;

  const tag = (node.tag || '').toLowerCase();
  const isFormTag = ['input', 'textarea', 'select', 'button', 'form', 'label', 'option', 'fieldset'].includes(tag);
  const isInteractive = node.interactive || isFormTag || ['button', 'textbox', 'checkbox', 'radio', 'combobox', 'listbox', 'link', 'menuitem'].includes(node.role);
  const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag);
  const hasText = typeof node.text === 'string' && node.text.trim().length > 0;

  let children = [];
  if (node.children && Array.isArray(node.children)) {
    children = node.children.map(child => compactInteractiveDom(child, depth + 1)).filter(Boolean);
  }

  // Drop empty, non-interactive layout containers
  if (!isInteractive && !isHeading && !hasText && children.length === 0) {
    return null;
  }

  // If a non-interactive layout container has exactly 1 interactive child, hoist the child
  const isLayoutWrapper = ['div', 'span', 'section', 'article', 'main'].includes(tag) && !isInteractive && !hasText && !node.role;
  if (isLayoutWrapper && children.length === 1) {
    return children[0];
  }

  const clone = { id: node.id, tag: node.tag };
  if (node.role) clone.role = node.role;
  if (hasText) clone.text = node.text.length > 100 ? node.text.slice(0, 100) + '...' : node.text;
  if (node.interactive || isInteractive) clone.interactive = true;
  if (node.has_pii) clone.has_pii = true;
  if (node.attributes && Object.keys(node.attributes).length > 0) {
    // Only retain essential attributes for token efficiency
    const cleanAttrs = {};
    const keepKeys = ['type', 'placeholder', 'name', 'value', 'checked', 'required', 'disabled', 'href', 'role', 'aria-label'];
    for (const key of keepKeys) {
      if (node.attributes[key] !== undefined) cleanAttrs[key] = node.attributes[key];
    }
    if (Object.keys(cleanAttrs).length > 0) clone.attributes = cleanAttrs;
  }
  if (children.length > 0) {
    clone.children = children;
  }

  return clone;
}

/**
 * Builds the user prompt integrating the sanitized DOM, user task, and recent action history.
 * Enforces strict token budgeting so prompts fit well within Groq rate limits (8000 TPM).
 */
function buildUserPrompt(domData, userTask = "No specific task provided. Just analyze the state.", actionHistory = []) {
  let prompt = `AGENT OBJECTIVE: ${userTask}\n\n`;
  
  if (actionHistory && actionHistory.length > 0) {
    // Collect all completed target IDs across entire history to prevent loops
    const completedTargets = Array.from(new Set(
      actionHistory
        .filter(step => step.execution_result && step.execution_result.includes('SUCCESS') && step.target && step.target !== 'N/A' && step.target !== 'USER')
        .map(step => step.target)
    ));

    if (completedTargets.length > 0) {
      prompt += `COMPLETED TARGETS (ALREADY FILLED/CLICKED - DO NOT RE-TARGET): ${completedTargets.join(', ')}\n\n`;
    }

    // Keep only the most recent 4 steps for detailed step logs to prevent token bloat
    const recentHistory = actionHistory.slice(-4);
    prompt += `RECENT ACTIONS TAKEN:\n`;
    recentHistory.forEach((step, idx) => {
      prompt += `[Step ${idx + 1}] Action: ${step.action}, Target: ${step.target || 'N/A'}, Value: ${step.value || 'N/A'} (Result: ${step.execution_result || 'UNKNOWN'})\n`;
    });
    prompt += `\nDo NOT repeat successful actions. If an action failed, try an alternative.\n\n`;
  }

  // Token-budgeted DOM compression
  const rawRoot = domData.root || null;
  const elementCount = domData.element_count || 0;

  // If page is large (> 60 elements), apply compact interactive pruning to guarantee low token usage
  let processedRoot = compressTree(rawRoot);
  let stringifiedDom = JSON.stringify({
    url: domData.url,
    title: domData.title,
    element_count: elementCount,
    root: processedRoot
  });

  // If serialized DOM exceeds ~10KB (~2,500 tokens), compact aggressively
  if (stringifiedDom.length > 10000 || elementCount > 80) {
    processedRoot = compactInteractiveDom(rawRoot) || processedRoot;
    stringifiedDom = JSON.stringify({
      url: domData.url,
      title: domData.title,
      element_count: elementCount,
      root: processedRoot
    });
  }

  prompt += `Analyze the following webpage structure and determine the next action to achieve the objective.\n\nDOM DATA:\n${stringifiedDom}`;
  
  if (domData.visual_context) {
    // If canvas graphics exist, preserve canvas text; otherwise cap OCR text
    const hasCanvasText = domData.visual_context.includes('[CANVAS GRAPHIC');
    const maxOcrLength = hasCanvasText ? 1500 : 800;
    
    const visualText = domData.visual_context.length > maxOcrLength
      ? domData.visual_context.slice(0, maxOcrLength) + '... [truncated]'
      : domData.visual_context;

    prompt += `\n\nVISUAL OCR DATA (Text extracted locally from screenshot of visible viewport):\n"""\n${visualText}\n"""\nNOTE: The OCR data contains text visually visible on screen (including Canvas, images, and obfuscated text). If an element is off-screen, you MUST use "SCROLL" to bring it into view.`;
  }
  
  return prompt;
}

module.exports = {
  AGENT_SYSTEM_PROMPT,
  compressTree,
  compactInteractiveDom,
  buildUserPrompt
};
