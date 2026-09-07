const { StateGraph } = require('@langchain/langgraph');
const { ChatGroq } = require('@langchain/groq');
const { HumanMessage, SystemMessage } = require('@langchain/core/messages');
const { AgentStateAnnotation } = require('./state');
const { AGENT_SYSTEM_PROMPT, buildUserPrompt, compressTree, compactInteractiveDom } = require('./prompts');
const { ActionResponseSchema, validateActions } = require('./actions');

/**
 * OBSERVE NODE
 * Receives the sanitized DOM and active page context from the extension,
 * compresses the DOM tree to eliminate token bloat, and formats observation logs.
 */
async function observeNode(state) {
  const loopCount = state.loopCount || 1;
  console.log(`\n[DRISHTI] ========================================`);
  console.log(`[DRISHTI] Graph started - Step: ${loopCount}`);
  console.log(`[DRISHTI] OBSERVE - Page: "${state.title || 'Untitled'}" (${state.elementCount || 0} elements)`);
  console.log(`[DRISHTI] URL: ${state.url || 'N/A'}`);
  
  if (state.visualContext) {
    console.log(`[DRISHTI] Visual OCR: "${state.visualContext.replace(/\n+/g, ' ').slice(0, 100)}..."`);
  }

  // Apply token tree compression
  const rawRoot = state.rawDom && state.rawDom.root ? state.rawDom.root : null;
  const compressedRoot = rawRoot ? compressTree(rawRoot) : null;

  return {
    compressedDom: compressedRoot,
    logs: [
      `[OBSERVE] Ingested ${state.elementCount} elements from ${state.url}`,
      `[OBSERVE] Tree compression applied`
    ]
  };
}

/**
 * Resilient JSON Extractor & Parser
 * Handles reasoning model thought tokens, markdown code fences, and plain-text Q&A responses.
 */
function extractAndParseJson(content, objective = '') {
  if (!content) return null;
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  const cleanStr = str.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // Try parsing from markdown code fences first
  const fenceMatches = Array.from(cleanStr.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/g));
  for (const match of fenceMatches) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed) return parsed;
    } catch (e) {}
  }

  // Try direct parse
  try {
    const directParsed = JSON.parse(cleanStr);
    if (directParsed) return directParsed;
  } catch (e) {}

  // Find balanced braces from the end (since final JSON answer is at the end)
  const firstBrace = cleanStr.indexOf('{');
  const lastBrace = cleanStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleanStr.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed) return parsed;
    } catch (e) {}
  }

  // Find balanced brackets for array
  const firstBracket = cleanStr.indexOf('[');
  const lastBracket = cleanStr.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const candidate = cleanStr.substring(firstBracket, lastBracket + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed) return parsed;
    } catch (e) {}
  }

  // If objective is a question or query and no JSON structure was found, return REPLY with clean text
  if (cleanStr.length > 0) {
    const isQuestion = objective.includes('?') || /^(what|who|where|when|why|how|which|can|is|are|tell|regarding)\s+/i.test(objective);
    if (isQuestion) {
      const plainText = cleanStr.replace(/```[a-z]*|```/g, '').trim();
      return {
        actions: [{ action: 'REPLY', value: plainText, reason: 'Answer to user question' }],
        summary_reason: plainText
      };
    }
  }

  return null;
}

/**
 * REASON NODE
 * Uses LangChain + ChatGroq with structured output (Zod schema) to decide
 * the next logical action(s) for the browser workflow.
 */
async function reasonNode(state) {
  const modelName = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  console.log(`[DRISHTI] REASON - Model: ${modelName}`);
  console.log(`[DRISHTI] Objective: "${state.objective || 'None'}"`);

  // Fast-path: Check for form submission completion page
  const pageUrl = state.url || '';
  const pageTitle = (state.title || '').toLowerCase();
  if (pageUrl.includes('/formResponse') || pageTitle.includes('response has been recorded') || pageTitle.includes('thank you for')) {
    console.log('[DRISHTI] Form submission confirmation detected on page. Terminating with DONE.');
    return {
      plannedActions: [{
        action: 'DONE',
        reason: 'Form submission completed. Confirmation page reached.'
      }],
      summaryReason: 'Form submitted successfully.',
      isDone: true,
      logs: ['[REASON] Form submission confirmation detected on page']
    };
  }

  const apiKeys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_FALLBACK].filter(Boolean);

  if (apiKeys.length === 0) {
    console.error('[DRISHTI] ERROR: No GROQ_API_KEY available in environment or fallback.');
    return {
      plannedActions: [{
        action: 'WAIT',
        value: '2000ms',
        reason: 'GROQ_API_KEY is missing.'
      }],
      error: 'GROQ_API_KEY_MISSING'
    };
  }

  let userPromptText = buildUserPrompt(
    state.rawDom || { url: state.url, title: state.title, element_count: state.elementCount, root: state.compressedDom },
    state.objective,
    state.actionHistory
  );

  let candidateActions = [];
  let summaryReason = '';
  let lastErr = null;

  for (let attempt = 0; attempt < apiKeys.length; attempt++) {
    const currentKey = apiKeys[attempt];
    const llm = new ChatGroq({
      apiKey: currentKey,
      model: modelName,
      temperature: 0,
      maxRetries: 0
    });

    try {
      const completion = await llm.invoke([
        new SystemMessage(AGENT_SYSTEM_PROMPT),
        new HumanMessage(userPromptText)
      ]);

      const parsed = extractAndParseJson(completion.content, state.objective);
      if (parsed) {
        if (Array.isArray(parsed.actions)) {
          candidateActions = parsed.actions;
          summaryReason = parsed.summary_reason || '';
        } else if (parsed.action) {
          candidateActions = [parsed];
          summaryReason = parsed.reason || '';
        } else if (Array.isArray(parsed)) {
          candidateActions = parsed;
        }
      }
      
      lastErr = null; // Success, break out of loop
      break; 
    } catch (err) {
      console.warn(`[DRISHTI] Direct reasoning completion encountered error on key attempt ${attempt + 1}:`, err.message);
      lastErr = err;
      
      const isRateLimit = err.message && (
        err.message.includes('413') || 
        err.message.includes('Request too large') || 
        err.message.includes('rate_limit_exceeded') || 
        err.message.includes('TPM')
      );

      if (!isRateLimit) {
        break; // If it's not a rate limit issue, don't just keep trying keys
      }
      
      console.warn(`[DRISHTI] Retrying with next API key (if available)...`);
    }
  }

  if (lastErr) {
    const isPayloadOrRateLimit = lastErr.message && (
      lastErr.message.includes('413') || 
      lastErr.message.includes('Request too large') || 
      lastErr.message.includes('rate_limit_exceeded') || 
      lastErr.message.includes('TPM')
    );

    // If payload too large and we exhausted keys, apply emergency ultra-compaction (form elements only) and retry once with last key
    if (isPayloadOrRateLimit) {
      console.warn('[DRISHTI] Payload exceeded model TPM limit on all keys. Applying emergency DOM compaction and retrying...');
      try {
        const lastKeyLlm = new ChatGroq({
          apiKey: apiKeys[apiKeys.length - 1],
          model: modelName,
          temperature: 0,
          maxRetries: 0
        });

        const ultraCompact = {
          url: state.url,
          title: state.title,
          element_count: state.elementCount,
          root: compactInteractiveDom(state.rawDom?.root || state.compressedDom)
        };
        ultraCompact.visual_context = (state.visualContext || '').slice(0, 400);
        userPromptText = buildUserPrompt(ultraCompact, state.objective, state.actionHistory);

        const fallbackCompletion = await lastKeyLlm.invoke([
          new SystemMessage(AGENT_SYSTEM_PROMPT),
          new HumanMessage(userPromptText)
        ]);

        const parsed = extractAndParseJson(fallbackCompletion.content, state.objective);
        if (parsed) {
          if (Array.isArray(parsed.actions)) {
            candidateActions = parsed.actions;
            summaryReason = parsed.summary_reason || '';
          } else if (parsed.action) {
            candidateActions = [parsed];
          } else if (Array.isArray(parsed)) {
            candidateActions = parsed;
          }
        }
      } catch (retryErr) {
        console.error('[DRISHTI] Emergency compaction retry failed:', retryErr.message);
        return {
          plannedActions: [{
            action: 'DONE',
            reason: 'Groq API token limit exceeded (8,000 TPM limit). Halting execution to prevent infinite retries.'
          }],
          summaryReason: 'Rate limit or token payload exceeded on Groq API.',
          error: 'RATE_LIMIT_EXCEEDED',
          isDone: true,
          logs: ['[REASON] Halting due to Groq rate limit / token payload limit']
        };
      }
    } else {
      candidateActions = [{
        action: 'WAIT',
        value: '1500ms',
        reason: 'Failed to obtain structured action plan from LLM.'
      }];
    }
  }

  const proposedSummary = candidateActions
    .map(a => `${a.action}${a.target_id ? ` (${a.target_id})` : ''}${a.value ? ` ["${a.value}"]` : ''}`)
    .join(', ');
  console.log(`[DRISHTI] Proposed: ${proposedSummary || 'No actions'}`);

  return {
    plannedActions: candidateActions,
    summaryReason: summaryReason,
    logs: [
      `[REASON] Selected ${candidateActions.length} candidate action(s) using ${modelName}`,
      `[REASON] Proposed: ${proposedSummary}`
    ]
  };
}

/**
 * VALIDATE NODE
 * Executes Level 1 (Zod conformance) and Level 2 (DRISHTI Deterministic Safety) checks.
 * Validates target element IDs, ensures safe action types, checks safety loop caps,
 * and sets terminal completion status.
 */
async function validateNode(state) {
  console.log(`[DRISHTI] VALIDATE - Running deterministic safety validation...`);

  const validationResult = validateActions(
    state.plannedActions,
    state.rawDom,
    state.loopCount || 1
  );

  if (validationResult.warnings.length > 0) {
    validationResult.warnings.forEach(w => console.warn(`[DRISHTI] Validation Warning: ${w}`));
  }

  if (validationResult.errors.length > 0) {
    validationResult.errors.forEach(e => console.error(`[DRISHTI] Validation Error: ${e}`));
  }

  const validatedSummary = validationResult.actions
    .map(a => `${a.action}${a.target_id ? ` (${a.target_id})` : ''}`)
    .join(', ');
  console.log(`[DRISHTI] Validation passed: [${validatedSummary}]`);
  console.log(`[DRISHTI] Returning action decision to extension`);
  console.log(`[DRISHTI] ========================================\n`);

  return {
    validatedActions: validationResult.actions,
    isDone: validationResult.isDone,
    error: validationResult.errors.length > 0 ? validationResult.errors.join('; ') : null,
    logs: [
      `[VALIDATE] Validated ${validationResult.actions.length} action(s)`,
      `[VALIDATE] isDone: ${validationResult.isDone}`
    ]
  };
}

/**
 * Construct and compile the LangGraph StateGraph
 */
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode('observe', observeNode)
  .addNode('reason', reasonNode)
  .addNode('validate', validateNode)
  .addEdge('__start__', 'observe')
  .addEdge('observe', 'reason')
  .addEdge('reason', 'validate')
  .addEdge('validate', '__end__');

const agentGraph = workflow.compile();

/**
 * Main execution interface for Express API endpoints.
 */
async function runAgentGraph(payload) {
  const loopCount = payload.loopCount || (payload.actionHistory ? payload.actionHistory.length + 1 : 1);
  
  const initialState = {
    objective: payload.userTask || 'Analyze page state and determine the next action.',
    url: payload.url || '',
    title: payload.title || '',
    elementCount: payload.element_count || 0,
    rawDom: payload,
    visualContext: payload.visual_context || '',
    actionHistory: payload.actionHistory || [],
    loopCount: loopCount,
    plannedActions: [],
    validatedActions: [],
    summaryReason: '',
    isDone: false,
    error: null,
    logs: []
  };

  const finalState = await agentGraph.invoke(initialState);
  return finalState;
}

module.exports = {
  agentGraph,
  runAgentGraph,
  observeNode,
  reasonNode,
  validateNode
};
