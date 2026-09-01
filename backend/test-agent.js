/**
 * DRISHTI Automated Test Suite for LangGraph.js + LangChain.js Integration
 * 
 * Tests:
 * 1. Tree Compression & Prompts
 * 2. Zod Action Schemas & Tool Definitions
 * 3. Level 2 Deterministic Safety Validator (whitelist, missing fields, target existence, safety limits)
 * 4. Privacy Boundary Integrity
 * 5. Full LangGraph StateGraph Execution & Trace Logging (with live Groq reasoning)
 * 6. Express API Endpoint Integration (Health & Analyze contracts)
 */

const assert = require('assert');
const http = require('http');
const { compressTree, buildUserPrompt, AGENT_SYSTEM_PROMPT } = require('./agent/prompts');
const { SingleActionSchema, ActionResponseSchema, validateActions, collectElementIds } = require('./agent/actions');
const { DRISHTI_TOOLS } = require('./agent/tools');
const { runAgentGraph } = require('./agent/graph');
const app = require('./server');
require('dotenv').config();

// Sample Sanitized DOM Fixture (Simulating output from extension/content.js on test.html)
const sampleSanitizedDom = {
  url: 'http://localhost:8080/test.html',
  title: 'DRISHTI AI — Demo Environment',
  element_count: 8,
  firewall_active_rules: 10,
  custom_blacklist_count: 0,
  custom_whitelist_count: 0,
  root: {
    id: 'element_0',
    tag: 'body',
    children: [
      {
        id: 'element_1',
        tag: 'form',
        attributes: { id: 'agent-test-form' },
        children: [
          {
            id: 'element_2',
            tag: 'input',
            interactive: true,
            attributes: { type: 'text', id: 'fname', placeholder: 'Enter first name' }
          },
          {
            id: 'element_3',
            tag: 'input',
            interactive: true,
            attributes: { type: 'text', id: 'lname', placeholder: 'Enter last name' }
          },
          {
            id: 'element_4',
            tag: 'input',
            interactive: true,
            attributes: { type: 'email', id: 'email-primary', placeholder: 'Enter email' }
          },
          {
            id: 'element_5',
            tag: 'input',
            interactive: true,
            attributes: { type: 'tel', id: 'phone', placeholder: 'Enter phone' }
          },
          {
            id: 'element_6',
            tag: 'input',
            interactive: true,
            attributes: { type: 'checkbox', id: 'agree-terms' }
          },
          {
            id: 'element_7',
            tag: 'button',
            interactive: true,
            text: 'Submit Application',
            attributes: { type: 'submit', id: 'agent-submit-btn' }
          }
        ]
      }
    ]
  }
};

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(testName, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${testName}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING DRISHTI LANGGRAPH INTEGRATION TEST SUITE');
  console.log('======================================================\n');

  // TEST 1: Tree Compression
  console.log('--- TEST GROUP 1: Tree Compression & Prompt Builders ---');
  runTest('Tree compression retains essential semantic tags and IDs', () => {
    const compressed = compressTree(sampleSanitizedDom.root);
    assert.strictEqual(compressed.id, 'element_0');
    assert.strictEqual(compressed.children.length, 1);
    assert.strictEqual(compressed.children[0].id, 'element_1');
    assert.strictEqual(compressed.children[0].children.length, 6);
  });

  runTest('Prompt builder formats objective, DOM, and action history cleanly', () => {
    const prompt = buildUserPrompt(sampleSanitizedDom, 'Fill the form', [
      { action: 'CLICK', target: 'element_2', value: '', execution_result: 'SUCCESS' }
    ]);
    assert.ok(prompt.includes('AGENT OBJECTIVE: Fill the form'));
    assert.ok(prompt.includes('[Step 1] Action: CLICK, Target: element_2'));
    assert.ok(prompt.includes('DOM DATA:'));
  });

  runTest('Agent system prompt contains guidelines for unstructured text & definitions', () => {
    assert.ok(AGENT_SYSTEM_PROMPT.includes('UNSTRUCTURED / RANDOM TEXT / DEFINITIONS'));
    assert.ok(AGENT_SYSTEM_PROMPT.includes('Simply SUMMARIZE, DEFINE, or EXPLAIN that text/topic directly to the user using a "REPLY" action!'));
  });

  // TEST 2: Zod Schemas & Tool Definitions
  console.log('\n--- TEST GROUP 2: Zod Schemas & LangChain Tool Capabilities ---');
  runTest('Zod SingleActionSchema parses valid action objects', () => {
    const parsed = SingleActionSchema.parse({
      action: 'CLICK',
      target_id: 'element_7',
      reason: 'Submit form'
    });
    assert.strictEqual(parsed.action, 'CLICK');
    assert.strictEqual(parsed.target_id, 'element_7');
  });

  runTest('Zod ActionResponseSchema parses batched actions', () => {
    const parsed = ActionResponseSchema.parse({
      actions: [
        { action: 'TYPE', target_id: 'element_2', value: 'John', reason: 'Enter first name' },
        { action: 'CLICK', target_id: 'element_7', reason: 'Submit' }
      ]
    });
    assert.strictEqual(parsed.actions.length, 2);
  });

  runTest('LangChain DRISHTI capability tools are properly registered', () => {
    assert.strictEqual(DRISHTI_TOOLS.length, 9);
    const toolNames = DRISHTI_TOOLS.map(t => t.name);
    assert.ok(toolNames.includes('click_element'));
    assert.ok(toolNames.includes('type_text'));
    assert.ok(toolNames.includes('key_press'));
    assert.ok(toolNames.includes('scroll_page'));
    assert.ok(toolNames.includes('wait'));
    assert.ok(toolNames.includes('navigate'));
    assert.ok(toolNames.includes('new_tab'));
    assert.ok(toolNames.includes('reply_user'));
    assert.ok(toolNames.includes('finish_task'));
  });

  // TEST 3: Deterministic Validator
  console.log('\n--- TEST GROUP 3: Deterministic Safety Validation Layer ---');
  runTest('collectElementIds gathers all IDs from structured DOM', () => {
    const ids = collectElementIds(sampleSanitizedDom.root);
    assert.strictEqual(ids.size, 8);
    assert.ok(ids.has('element_0'));
    assert.ok(ids.has('element_7'));
    assert.ok(!ids.has('element_999'));
  });

  runTest('Validator approves valid actions with matching element IDs', () => {
    const result = validateActions([
      { action: 'TYPE', target_id: 'element_2', value: 'Jane', reason: 'First name' },
      { action: 'CLICK', target_id: 'element_7', reason: 'Submit' }
    ], sampleSanitizedDom, 1);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.actions.length, 2);
    assert.strictEqual(result.errors.length, 0);
  });

  runTest('Validator rejects unsupported action types', () => {
    const result = validateActions([
      { action: 'RUN_ARBITRARY_JS', target_id: 'element_2', value: 'alert(1)' },
      { action: 'CLICK', target_id: 'element_7' }
    ], sampleSanitizedDom, 1);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.actions.length, 1);
    assert.strictEqual(result.actions[0].action, 'CLICK');
    assert.ok(result.errors.some(e => e.includes('UNSUPPORTED_ACTION')));
  });

  runTest('Validator rejects missing required fields (CLICK without target_id)', () => {
    const result = validateActions([
      { action: 'CLICK' }
    ], sampleSanitizedDom, 1);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.actions[0].action, 'WAIT');
    assert.ok(result.errors.some(e => e.includes('missing required target_id')));
  });

  runTest('Validator blocks dangerous javascript: URL schemes in NAVIGATE', () => {
    const result = validateActions([
      { action: 'NAVIGATE', value: 'javascript:alert(document.cookie)' }
    ], sampleSanitizedDom, 1);

    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('SECURITY_VIOLATION')));
  });

  runTest('Validator normalizes raw URLs in NAVIGATE action (e.g. google.com -> https://google.com)', () => {
    const result = validateActions([
      { action: 'NAVIGATE', value: 'google.com', reason: 'Open Google' }
    ], sampleSanitizedDom, 1);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.actions[0].value, 'https://google.com');
  });

  runTest('Validator resolves search queries into Google Search URLs', () => {
    const result = validateActions([
      { action: 'NAVIGATE', value: 'search for best laptops 2026', reason: 'Search query' }
    ], sampleSanitizedDom, 1);

    assert.strictEqual(result.valid, true);
    assert.ok(result.actions[0].value.startsWith('https://www.google.com/search?q='));
    assert.ok(result.actions[0].value.includes('best%20laptops%202026') || result.actions[0].value.includes('best+laptops+2026'));
  });

  runTest('Validator approves NEW_TAB and KEYPRESS actions', () => {
    const result = validateActions([
      { action: 'NEW_TAB', value: 'search AI news', reason: 'Open in new tab' },
      { action: 'KEYPRESS', target_id: 'element_2', value: 'Enter', reason: 'Submit form' }
    ], sampleSanitizedDom, 1);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.actions[0].action, 'NEW_TAB');
    assert.ok(result.actions[0].value.startsWith('https://www.google.com/search?q='));
    assert.strictEqual(result.actions[1].action, 'KEYPRESS');
    assert.strictEqual(result.actions[1].value, 'Enter');
  });

  runTest('Validator warns when target_id does not exist in DOM snapshot', () => {
    const result = validateActions([
      { action: 'CLICK', target_id: 'element_unknown_99', reason: 'Test missing' }
    ], sampleSanitizedDom, 1);

    assert.strictEqual(result.valid, true);
    assert.ok(result.warnings.some(w => w.includes('not found in current DOM snapshot')));
  });

  runTest('Validator halts when safety loop cap is exceeded (> 10)', () => {
    const result = validateActions([
      { action: 'CLICK', target_id: 'element_7' }
    ], sampleSanitizedDom, 11);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.isDone, true);
    assert.strictEqual(result.actions[0].action, 'DONE');
    assert.ok(result.errors.some(e => e.includes('SAFETY_CAP_EXCEEDED')));
  });

  // TEST 4: Privacy Boundary Verification
  console.log('\n--- TEST GROUP 4: Privacy Boundary Verification ---');
  runTest('Sanitized DOM contains redacted tokens and no raw passwords', () => {
    const sanitizedNode = {
      id: 'element_10',
      tag: 'div',
      text: 'Contact: [EMAIL_REDACTED] Phone: [PHONE_REDACTED]',
      has_pii: true,
      pii_types: ['email', 'phone'],
      attributes: {
        'data-token': '[API_KEY_REDACTED]',
        'data-password': '[PASSWORD_PROTECTED]'
      }
    };
    const compressed = compressTree(sanitizedNode);
    assert.strictEqual(compressed.text, 'Contact: [EMAIL_REDACTED] Phone: [PHONE_REDACTED]');
    assert.strictEqual(compressed.has_pii, true);
    assert.strictEqual(compressed.attributes['data-token'], '[API_KEY_REDACTED]');
    assert.strictEqual(compressed.attributes['data-password'], '[PASSWORD_PROTECTED]');
  });

  // TEST 5: Full LangGraph Execution
  console.log('\n--- TEST GROUP 5: Full LangGraph StateGraph Execution ---');
  await runAsyncTest('LangGraph completes OBSERVE -> REASON -> VALIDATE cycle with Groq', async () => {
    if (!process.env.GROQ_API_KEY) {
      console.warn('   ⚠️ GROQ_API_KEY missing, skipping live Groq execution test.');
      return;
    }

    const payload = {
      ...sampleSanitizedDom,
      userTask: 'Fill in the first name with "Alice", last name with "Smith", and click Submit.',
      actionHistory: [],
      loopCount: 1
    };

    const finalState = await runAgentGraph(payload);
    assert.ok(finalState, 'Graph returned final state');
    assert.ok(Array.isArray(finalState.validatedActions), 'finalState has validatedActions array');
    assert.ok(finalState.validatedActions.length >= 1, 'At least 1 action produced');
    
    // Check that every action in the validated result is valid
    finalState.validatedActions.forEach(act => {
      assert.ok(['CLICK', 'TYPE', 'SCROLL', 'WAIT', 'NAVIGATE', 'REPLY', 'DONE'].includes(act.action));
      console.log(`     -> Emitted Valid Action: ${act.action} (target: ${act.target_id || 'N/A'}, value: ${act.value || 'N/A'})`);
    });
  });

  await runAsyncTest('LangGraph handles question answering with REPLY action', async () => {
    if (!process.env.GROQ_API_KEY) return;

    const payload = {
      ...sampleSanitizedDom,
      userTask: 'What is the title of the submit button on this page?',
      actionHistory: [],
      loopCount: 1
    };

    const finalState = await runAgentGraph(payload);
    assert.ok(finalState.validatedActions.length >= 1);
    const action = finalState.validatedActions[0];
    assert.ok(action.action === 'REPLY' || action.action === 'CLICK' || action.action === 'DONE');
    console.log(`     -> Q&A Action: ${action.action} (value: ${action.value || 'N/A'})`);
  });

  // TEST 6: Express HTTP Endpoint Integration
  console.log('\n--- TEST GROUP 6: Express HTTP API Endpoint Integration ---');
  await runAsyncTest('GET /api/health returns framework and model status', async () => {
    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/api/health`);
    const data = await response.json();
    await new Promise(resolve => server.close(resolve));

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.framework, 'LangGraph.js');
  });

  await runAsyncTest('POST /api/analyze handles valid payload and returns structured actions', async () => {
    if (!process.env.GROQ_API_KEY) return;

    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...sampleSanitizedDom,
        userTask: 'Click the submit button',
        actionHistory: []
      })
    });
    const data = await response.json();
    await new Promise(resolve => server.close(resolve));

    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.ai_response);
    assert.ok(Array.isArray(data.ai_response.actions));
    assert.ok(data.ai_response.actions.length >= 1);
    console.log(`     -> HTTP Endpoint Response: ${data.ai_response.actions.length} action(s), status=${data.success}`);
  });

  await runAsyncTest('POST /api/analyze rejects payload missing structured DOM root', async () => {
    const server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://test.com' })
    });
    const data = await response.json();
    await new Promise(resolve => server.close(resolve));

    assert.strictEqual(response.status, 400);
    assert.ok(data.error.includes('Missing structured DOM'));
  });

  // TEST 7: Multimodal Visual OCR & LangGraph Reasoning
  console.log('\n--- TEST GROUP 7: Multimodal Visual OCR & LangGraph Reasoning ---');
  runTest('Prompt builder formats and truncates large visual OCR context', () => {
    const domWithOcr = {
      ...sampleSanitizedDom,
      visual_context: '[CANVAS GRAPHIC #ocr-test-canvas]:\nCONFIRMATION: 9948-AB\nSTATUS: ACTIVE'
    };
    const prompt = buildUserPrompt(domWithOcr, 'Read the confirmation code from the screen');
    assert.ok(prompt.includes('VISUAL OCR DATA'));
    assert.ok(prompt.includes('CONFIRMATION: 9948-AB'));

    const hugeOcr = {
      ...sampleSanitizedDom,
      visual_context: 'X'.repeat(4000)
    };
    const truncatedPrompt = buildUserPrompt(hugeOcr, 'Analyze');
    assert.ok(truncatedPrompt.includes('[truncated]'));
  });

  await runAsyncTest('LangGraph reasons over visual OCR context to answer canvas-only queries', async () => {
    if (!process.env.GROQ_API_KEY) return;

    const payload = {
      url: 'http://localhost:8080/test.html',
      title: 'DRISHTI AI — Demo Environment',
      element_count: 8,
      root: {
        id: 'element_0',
        tag: 'body',
        children: [
          {
            id: 'element_canvas_1',
            tag: 'canvas',
            attributes: { id: 'ocr-test-canvas' }
          }
        ]
      },
      visual_context: '[CANVAS GRAPHIC #ocr-test-canvas]:\nCONFIRMATION: 9948-AB',
      userTask: 'What is the confirmation code displayed in the canvas graphic on this page?',
      actionHistory: [],
      loopCount: 1
    };

    const finalState = await runAgentGraph(payload);
    assert.ok(finalState.validatedActions.length >= 1);
    const action = finalState.validatedActions[0];
    assert.ok(action.action === 'REPLY' || action.action === 'DONE');
    assert.ok(action.value && (action.value.includes('9948-AB') || action.value.includes('9948')));
    console.log(`     -> Visual OCR Reasoning Answer: ${action.value}`);
  });

  console.log('\n======================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('======================================================\n');
  process.exitCode = 0;
}

main().catch(err => {
  console.error('\n❌ Test suite execution failed:\n', err);
  process.exit(1);
});
