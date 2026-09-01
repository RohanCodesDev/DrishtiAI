const { z } = require('zod');

/**
 * Canonical DRISHTI Action Vocabulary
 */
const ALLOWED_ACTIONS = ['CLICK', 'TYPE', 'KEYPRESS', 'SCROLL', 'WAIT', 'NAVIGATE', 'NEW_TAB', 'REPLY', 'DONE'];

/**
 * Level 1: Zod Schema Definition for Structured Output
 */
const SingleActionSchema = z.object({
  action: z.enum(['CLICK', 'TYPE', 'KEYPRESS', 'SCROLL', 'WAIT', 'NAVIGATE', 'NEW_TAB', 'REPLY', 'DONE'])
    .describe('The action type to perform'),
  target_id: z.string().optional()
    .describe('The drishti_id (e.g. element_5) of the element to interact with'),
  value: z.string().optional()
    .describe('Text to type, URL/search query to navigate or open, key name (e.g. Enter), scroll direction, or reply message'),
  reason: z.string().optional()
    .describe('Brief explanation of why this action was selected')
});

const ActionResponseSchema = z.object({
  actions: z.array(SingleActionSchema)
    .min(1)
    .describe('Ordered list of deterministic browser actions to execute')
});

/**
 * Helper: Recursively collects all element IDs from the structured DOM tree.
 */
function collectElementIds(node, idSet = new Set()) {
  if (!node) return idSet;
  if (node.id) idSet.add(node.id);
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      collectElementIds(child, idSet);
    }
  }
  return idSet;
}

/**
 * Level 2: Deterministic DRISHTI Safety Validation Layer
 * 
 * Performs strict, non-LLM security & validity checks on candidate actions:
 * 1. Validates action type against ALLOWED_ACTIONS.
 * 2. Enforces required fields per action type.
 * 3. Verifies target_id existence against current DOM snapshot.
 * 4. Blocks malicious URL schemes (javascript:, data:) for NAVIGATE.
 * 5. Enforces safety loop cap (<= 10 steps).
 * 6. Limits max batched actions (<= 10 actions per step).
 */
function validateActions(actions, domData = null, loopCount = 1) {
  const result = {
    valid: false,
    actions: [],
    errors: [],
    warnings: [],
    isDone: false
  };

  // 1. Safety Loop Cap Check
  if (loopCount > 10) {
    result.errors.push('SAFETY_CAP_EXCEEDED: Loop count exceeds maximum allowed steps (10).');
    result.actions = [{
      action: 'DONE',
      reason: 'Safety loop cap of 10 iterations reached.'
    }];
    result.valid = true;
    result.isDone = true;
    return result;
  }

  // 2. Input Array Normalization
  let actionList = [];
  if (Array.isArray(actions)) {
    actionList = actions;
  } else if (actions && typeof actions === 'object' && Array.isArray(actions.actions)) {
    actionList = actions.actions;
  } else if (actions && typeof actions === 'object' && actions.action) {
    actionList = [actions];
  }

  if (actionList.length === 0) {
    result.errors.push('NO_ACTIONS_PROPOSED: Agent produced an empty actions list.');
    result.actions = [{
      action: 'WAIT',
      value: '2000ms',
      reason: 'Fallback wait due to empty action plan.'
    }];
    result.valid = true;
    return result;
  }

  // 3. Batch Size Limit
  if (actionList.length > 10) {
    result.warnings.push(`Truncated action batch from ${actionList.length} to 10 actions.`);
    actionList = actionList.slice(0, 10);
  }

  // 4. Collect valid element IDs from DOM snapshot if available
  const existingIds = domData && domData.root ? collectElementIds(domData.root) : new Set();
  const hasDomTree = existingIds.size > 0;

  const validatedList = [];

  for (let i = 0; i < actionList.length; i++) {
    const raw = actionList[i];
    if (!raw || typeof raw !== 'object') {
      result.errors.push(`Action at index ${i} is not a valid object.`);
      continue;
    }

    const actionType = String(raw.action || '').toUpperCase().trim();

    // Check allowed action type
    if (!ALLOWED_ACTIONS.includes(actionType)) {
      result.errors.push(`UNSUPPORTED_ACTION: "${raw.action}" is not an allowed DRISHTI action.`);
      continue;
    }

    const targetId = typeof raw.target_id === 'string' ? raw.target_id.trim() : undefined;
    const value = typeof raw.value === 'string' ? raw.value.trim() : (raw.value !== undefined ? String(raw.value) : undefined);
    const reason = typeof raw.reason === 'string' ? raw.reason.trim() : 'Action chosen by agent';

    const cleanAction = {
      action: actionType,
      reason
    };
    if (targetId) cleanAction.target_id = targetId;
    if (value !== undefined) cleanAction.value = value;

    // Per-Action Deterministic Rules
    switch (actionType) {
      case 'CLICK': {
        if (!targetId) {
          result.errors.push(`CLICK action at index ${i} is missing required target_id.`);
          continue;
        }
        if (hasDomTree && !existingIds.has(targetId)) {
          result.warnings.push(`Target "${targetId}" not found in current DOM snapshot. Passing with caution.`);
        }
        break;
      }

      case 'TYPE': {
        if (!targetId) {
          result.errors.push(`TYPE action at index ${i} is missing required target_id.`);
          continue;
        }
        if (value === undefined) {
          result.errors.push(`TYPE action at index ${i} is missing required value.`);
          continue;
        }
        if (hasDomTree && !existingIds.has(targetId)) {
          result.warnings.push(`Target "${targetId}" not found in current DOM snapshot for TYPE action.`);
        }
        break;
      }

      case 'SCROLL': {
        if (targetId && hasDomTree && !existingIds.has(targetId)) {
          result.warnings.push(`Scroll target "${targetId}" not found in DOM; defaulting to viewport scroll.`);
          delete cleanAction.target_id;
        }
        if (!cleanAction.target_id && cleanAction.value !== 'up') {
          cleanAction.value = 'down';
        }
        break;
      }

      case 'KEYPRESS': {
        if (!cleanAction.value) cleanAction.value = 'Enter';
        break;
      }

      case 'NAVIGATE':
      case 'NEW_TAB': {
        let val = value ? String(value).trim() : (actionType === 'NEW_TAB' ? 'https://www.google.com' : '');
        if (!val) {
          result.errors.push(`${actionType} action at index ${i} is missing target URL or search query.`);
          continue;
        }
        // Security check: Block javascript: and data: schemes
        const lowerUrl = val.toLowerCase();
        if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:') || lowerUrl.startsWith('vbscript:')) {
          result.errors.push(`SECURITY_VIOLATION: Unsafe URL scheme in ${actionType} action: "${val}"`);
          continue;
        }

        // Intelligently transform raw search queries into Google Search URLs
        if (!/^https?:\/\//i.test(val) && !val.startsWith('chrome://') && !val.startsWith('about:')) {
          const isSearchQuery = val.includes(' ') || !val.includes('.') || /^(search\s+for|search|google)\s+/i.test(val);
          if (isSearchQuery) {
            const cleanQuery = val.replace(/^(search\s+for|search|google)\s+/i, '').trim();
            cleanAction.value = 'https://www.google.com/search?q=' + encodeURIComponent(cleanQuery || val);
          } else {
            cleanAction.value = 'https://' + val;
          }
        } else {
          cleanAction.value = val;
        }
        break;
      }

      case 'REPLY': {
        if (!value || typeof value !== 'string' || value.length === 0) {
          result.errors.push(`REPLY action at index ${i} is missing message value.`);
          continue;
        }
        result.isDone = true;
        break;
      }

      case 'DONE': {
        result.isDone = true;
        break;
      }

      case 'WAIT': {
        if (!cleanAction.value) cleanAction.value = '2000ms';
        break;
      }
    }

    validatedList.push(cleanAction);

    // If DONE or REPLY is encountered, stop processing further actions in this batch
    if (actionType === 'DONE' || actionType === 'REPLY') {
      break;
    }
  }

  if (validatedList.length > 0) {
    result.valid = true;
    result.actions = validatedList;
  } else {
    // If all proposed actions failed validation, fallback safely to WAIT
    result.valid = false;
    result.actions = [{
      action: 'WAIT',
      value: '2000ms',
      reason: 'Validation rejected all proposed actions; pausing.'
    }];
  }

  return result;
}

module.exports = {
  ALLOWED_ACTIONS,
  SingleActionSchema,
  ActionResponseSchema,
  validateActions,
  collectElementIds
};
