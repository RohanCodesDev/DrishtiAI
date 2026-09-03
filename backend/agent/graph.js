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

  if (!process.env.GROQ_API_KEY) {
    console.error('[DRISHTI] ERROR: GROQ_API_KEY is not configured in backend/.env');
    return {
      plannedActions: [{
        action: 'WAIT',
        value: '2000ms',
        reason: 'GROQ_API_KEY is missing in backend environment.'
      }],
      error: 'GROQ_API_KEY_MISSING'
    };
  }

  const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: modelName,
    temperature: 0
  });

  let userPromptText = buildUserPrompt(
    state.rawDom || { url: state.url, title: state.title, element_count: state.elementCount, root: state.compressedDom },
    state.objective,
    state.actionHistory
  );

  let candidateActions = [];
  let summaryReason = '';

  try {
    // Primary mechanism: LangChain Structured Output backed by Zod
    const structuredLlm = llm.withStructuredOutput(ActionResponseSchema);
    const response = await structuredLlm.invoke([
      new SystemMessage(AGENT_SYSTEM_PROMPT),
      new HumanMessage(userPromptText)
    ]);

    if (response && Array.isArray(response.actions)) {
      candidateActions = response.actions;
      summaryReason = response.summary_reason || '';
    }
  } catch (structuredErr) {
    console.warn('[DRISHTI] withStructuredOutput error, evaluating fallback:', structuredErr.message);

    const isPayloadOrRateLimit = structuredErr.message && (
      structuredErr.message.includes('413') || 
      structuredErr.message.includes('Request too large') || 
      structuredErr.message.includes('rate_limit_exceeded') || 
      structuredErr.message.includes('TPM')
    );

    // If payload too large, apply emergency ultra-compaction (form elements only) and retry once
    if (isPayloadOrRateLimit) {
      console.warn('[DRISHTI] Payload exceeded model TPM limit. Applying emergency DOM compaction and retrying...');
      try {
        const ultraCompact = {
          url: state.url,
          title: state.title,
          element_count: state.elementCount,
          root: compactInteractiveDom(state.rawDom?.root || state.compressedDom)
        };
        // Omit visual context to strictly save tokens
        ultraCompact.visual_context = '';
        userPromptText = buildUserPrompt(ultraCompact, state.objective, state.actionHistory);

        const fallbackCompletion = await llm.invoke([
          new SystemMessage(AGENT_SYSTEM_PROMPT),
          new HumanMessage(userPromptText)
        ]);

        const content = typeof fallbackCompletion.content === 'string' ? fallbackCompletion.content : JSON.stringify(fallbackCompletion.content);
        const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.actions)) {
            candidateActions = parsed.actions;
          } else if (parsed.action) {
            candidateActions = [parsed];
          } else if (Array.isArray(parsed)) {
            candidateActions = parsed;
          }
        }
      } catch (retryErr) {
        console.error('[DRISHTI] Emergency compaction retry failed:', retryErr.message);
        // Do NOT loop WAIT 2000ms on rate limits; finish cleanly to avoid infinite spinning
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
      // Fallback: Direct invocation with strict schema prompting and Zod validation
      try {
        const completion = await llm.invoke([
          new SystemMessage(AGENT_SYSTEM_PROMPT),
          new HumanMessage(userPromptText)
        ]);

        const content = typeof completion.content === 'string' ? completion.content : JSON.stringify(completion.content);
        const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.actions)) {
            candidateActions = parsed.actions;
          } else if (parsed.action) {
            candidateActions = [parsed];
          } else if (Array.isArray(parsed)) {
            candidateActions = parsed;
          }
        }
      } catch (fallbackErr) {
        console.error('[DRISHTI] Direct fallback parsing also failed:', fallbackErr.message);
        candidateActions = [{
          action: 'WAIT',
          value: '2000ms',
          reason: 'Failed to obtain structured action plan from LLM.'
        }];
      }
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
