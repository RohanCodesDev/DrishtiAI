/**
 * DRISHTI Prompts & DOM Compression Utilities
 * Preserves battle-tested prompt design and token tree compression.
 */

const AGENT_SYSTEM_PROMPT = `You are an autonomous web automation agent. 
You will be provided with a JSON representation of a web page's DOM. 
The DOM has been sanitized for privacy (sensitive fields like passwords or PII may be masked with [REDACTED]).

Your goal is to analyze the page state and decide on the next logical action for a user to take, or to assist the user in completing a workflow.

NAVIGATION INSTRUCTIONS:
- If the current page is a New Tab, blank page, or restricted page (e.g. chrome://newtab, about:blank), or if the user objective requires navigating to or searching on a specific website (e.g., "go to google.com and search for...", "open github.com", "navigate to amazon.com"), your immediate first action must be "NAVIGATE" with the target URL in the "value" field (e.g. "https://www.google.com" or "https://www.google.com/search?q=...").
- When performing a search from a new tab or empty page, you may navigate directly to the search engine (e.g. "https://www.google.com" or "https://www.google.com/search?q=agentic+browser+UI").
- Do NOT attempt to click or type elements on a new tab/restricted page before navigating to the target website.
- Output ONLY the NAVIGATE action for the navigation step; do not bundle subsequent interaction steps that depend on the new page loading.

CRITICAL INSTRUCTION FOR MULTI-STEP OBJECTIVES: 
If the objective contains multiple steps, you must look at the current DOM state to determine which steps have already been completed, and output ONLY the action for the NEXT uncompleted step. Do not repeat completed actions.

Return your response as structured actions matching the required schema:
- action: "CLICK" | "TYPE" | "WAIT" | "NAVIGATE" | "DONE" | "SCROLL" | "REPLY"
- target_id: "<string>" (the 'drishti_id' or 'id' of the element to interact with, if applicable)
- value: "<string>" (the text to type, URL to navigate to, or the message to REPLY to the user)
- reason: "<string>" (a brief explanation of why you chose this action)

If multiple actions can be performed deterministically without needing to wait for a page load or DOM change (e.g., filling out multiple fields in a form), include them all in the \`actions\` array in the exact order they should be executed.

CRITICAL RULES FOR INFORMATION RETRIEVAL & QUESTIONS:
1. If the requested information is NOT currently visible in the DOM or VISUAL OCR DATA, output ONLY a "SCROLL" or "CLICK" action. NEVER bundle a "REPLY" or "DONE" action with a "SCROLL" or "CLICK" action in the same response! You must wait for the system to execute the scroll and provide a fresh view in the next loop.
2. Once the target information IS visible in the DOM or VISUAL OCR DATA (or if you have already scrolled and confirmed it truly does not exist), output ONLY the "REPLY" action with your answer in the "value" field.
3. DO NOT use the "DONE" action for questions or information requests; always use "REPLY".
4. For security PINs, confirmation codes, vouchers, tokens, canvas-rendered text, diagrams, or image text (which cannot be read from the HTML DOM tree), rely directly on the VISUAL OCR DATA extracted from the viewport and on-screen canvas graphics ([CANVAS GRAPHIC #...]). Answer the specific question asked in the AGENT OBJECTIVE using the matching canvas graphic or OCR section. If an element or canvas box is lower on the page or off-screen, issue a "SCROLL" action with target_id or with "value": "down" / "value": "bottom" to bring it into view.
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
 * Builds the user prompt integrating the sanitized DOM, user task, and recent action history.
 */
function buildUserPrompt(domData, userTask = "No specific task provided. Just analyze the state.", actionHistory = []) {
  let prompt = `AGENT OBJECTIVE: ${userTask}\n\n`;
  
  if (actionHistory && actionHistory.length > 0) {
    // Keep only the most recent 4 steps to prevent token bloat
    const recentHistory = actionHistory.slice(-4);
    prompt += `RECENT ACTIONS TAKEN:\n`;
    recentHistory.forEach((step, idx) => {
      prompt += `[Step ${idx + 1}] Action: ${step.action}, Target: ${step.target || 'N/A'}, Value: ${step.value || 'N/A'} (Result: ${step.execution_result || 'UNKNOWN'})\n`;
    });
    prompt += `\nDo NOT repeat successful actions. If an action failed, try an alternative.\n\n`;
  }

  // Compress DOM tree to stay well under token rate limits
  const cleanDom = {
    url: domData.url,
    title: domData.title,
    element_count: domData.element_count,
    root: compressTree(domData.root)
  };

  prompt += `Analyze the following webpage structure and determine the next action to achieve the objective.\n\nDOM DATA:\n${JSON.stringify(cleanDom)}`;
  
  if (domData.visual_context) {
    // Cap visual context to prevent token overflows while preserving key text
    const visualText = domData.visual_context.length > 3000
      ? domData.visual_context.slice(0, 3000) + '... [truncated]'
      : domData.visual_context;

    prompt += `\n\nVISUAL OCR DATA (Text extracted locally from screenshot of visible viewport):\n"""\n${visualText}\n"""\nNOTE: The OCR data contains text visually visible on screen (including Canvas, images, and obfuscated text). If an element is off-screen, you MUST use "SCROLL" to bring it into view.`;
  }
  
  return prompt;
}

module.exports = {
  AGENT_SYSTEM_PROMPT,
  compressTree,
  buildUserPrompt
};
