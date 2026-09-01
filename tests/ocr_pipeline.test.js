/**
 * DrishtiAI Phase 10 — OCR & Vision Synchronization Test Suite
 * Validates on-device OCR text sanitization, firewall rule compliance,
 * placeholder restoration, and visual context prompt formatting.
 */

const assert = require('assert');
const path = require('path');

// Import privacy firewall from content.js
const { processPII, normalizeFirewallConfig, DEFAULT_FIREWALL_CONFIG } = require('../extension/content.js');

// Import prompt builder from backend/prompts.js
const { buildUserPrompt, AGENT_SYSTEM_PROMPT } = require('../backend/prompts.js');

console.log('🧪 Running DrishtiAI Phase 10 OCR & Vision Pipeline Tests...\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}\n`);
  }
}

// TEST GROUP 1: OCR Text PII Redaction
console.log('--- Group 1: OCR Text Privacy Firewall Redaction ---');

test('Redacts Email addresses from OCR text', () => {
  const ocrText = 'Customer service contact: alice.smith@example.org and bob@company.co.in';
  const res = processPII(ocrText, DEFAULT_FIREWALL_CONFIG);
  assert.ok(res.redactedText.includes('[EMAIL_REDACTED]'));
  assert.ok(!res.redactedText.includes('alice.smith@example.org'));
  assert.ok(res.piiTypes.includes('email'));
});

test('Redacts US and Indian phone numbers from OCR text', () => {
  const ocrText = 'Call US office at 800-555-1234 or India center at +91 9876543210 immediately.';
  const res = processPII(ocrText, DEFAULT_FIREWALL_CONFIG);
  assert.ok(!res.redactedText.includes('800-555-1234'));
  assert.ok(!res.redactedText.includes('+91 9876543210'));
  assert.ok(res.redactedText.includes('[PHONE_REDACTED]'));
  assert.ok(res.piiTypes.includes('phone'));
});

test('Redacts Credit Cards with Luhn check from OCR text', () => {
  const ocrText = 'Payment processed for Visa Card: 4111-2222-3333-4444 on file.';
  const res = processPII(ocrText, DEFAULT_FIREWALL_CONFIG);
  assert.ok(!res.redactedText.includes('4111-2222-3333-4444'));
  assert.ok(res.redactedText.includes('[CREDIT_CARD_REDACTED]'));
  assert.ok(res.piiTypes.includes('credit_card'));
});

test('Redacts SSN, Aadhaar UID, and PAN Cards from OCR text', () => {
  const ocrText = 'ID Record - SSN: 123-45-6789, Aadhaar: 2345 6789 0123, PAN: ABCDE1234F';
  const res = processPII(ocrText, DEFAULT_FIREWALL_CONFIG);
  assert.ok(!res.redactedText.includes('123-45-6789'));
  assert.ok(!res.redactedText.includes('2345 6789 0123'));
  assert.ok(!res.redactedText.includes('ABCDE1234F'));
  assert.ok(res.piiTypes.includes('ssn'));
  assert.ok(res.piiTypes.includes('aadhaar'));
  assert.ok(res.piiTypes.includes('pan_card'));
});

test('Redacts API Keys and Ethereum Crypto Wallets from OCR text', () => {
  const ocrText = 'API Secret: sk-proj-1234567890abcdef1234567890 and Wallet: 0x71C66332e333D34991234567890abcdef1234567';
  const res = processPII(ocrText, DEFAULT_FIREWALL_CONFIG);
  assert.ok(!res.redactedText.includes('sk-proj-1234567890abcdef1234567890'));
  assert.ok(!res.redactedText.includes('0x71C66332e333D34991234567890abcdef1234567'));
  assert.ok(res.piiTypes.includes('api_key'));
  assert.ok(res.piiTypes.includes('crypto_wallet'));
});

// TEST GROUP 2: Whitelist & Blacklist on OCR Text
console.log('\n--- Group 2: Whitelist & Blacklist on Visual OCR Text ---');

test('Preserves Whitelisted email while redacting non-whitelisted email from OCR text', () => {
  const config = {
    rules: { email: true },
    custom_blacklist: [],
    custom_whitelist: ['support@drishti.ai']
  };
  const ocrText = 'Contact public support at support@drishti.ai or personal dev@hidden.com';
  const res = processPII(ocrText, config);
  assert.ok(res.redactedText.includes('support@drishti.ai'), 'Whitelisted email must be preserved');
  assert.ok(!res.redactedText.includes('dev@hidden.com'), 'Non-whitelisted email must be redacted');
  assert.ok(res.redactedText.includes('[EMAIL_REDACTED]'));
});

test('Applies Custom Blacklist redaction to proprietary terms detected by OCR', () => {
  const config = {
    rules: DEFAULT_FIREWALL_CONFIG.rules,
    custom_blacklist: ['Project Drishti Aegis', 'Confidential Blueprint'],
    custom_whitelist: []
  };
  const ocrText = 'Visual Header: Project Drishti Aegis internal design draft - Confidential Blueprint.';
  const res = processPII(ocrText, config);
  assert.ok(!res.redactedText.includes('Project Drishti Aegis'));
  assert.ok(!res.redactedText.includes('Confidential Blueprint'));
  assert.ok(res.redactedText.includes('[BLACKLIST_REDACTED]'));
  assert.ok(res.piiTypes.includes('custom_blacklist'));
});

// TEST GROUP 3: Canvas / Obfuscated Text Verification & Agent Prompts
console.log('\n--- Group 3: Canvas Visual OCR & Agent Prompt Integration ---');

test('Formats visual OCR context from Canvas element into AI Agent User Prompt', () => {
  const domData = {
    url: 'http://localhost/test.html',
    title: 'DRISHTI AI — Demo Environment',
    element_count: 42,
    root: { id: 'element_0', tag: 'body', children: [] },
    visual_context: 'CONFIRMATION: 9948-AB\nStatus: Verified\nTimestamp: 2026-09-01'
  };
  
  const prompt = buildUserPrompt(domData, 'Read the confirmation code from the screen.');
  assert.ok(prompt.includes('AGENT OBJECTIVE: Read the confirmation code from the screen.'));
  assert.ok(prompt.includes('VISUAL OCR DATA (Text extracted locally from screenshot of visible viewport):'));
  assert.ok(prompt.includes('CONFIRMATION: 9948-AB'));
  assert.ok(prompt.includes('NOTE: The OCR data contains text visually visible on screen'));
});

test('Agent System Prompt contains Canvas / OCR rules', () => {
  assert.ok(AGENT_SYSTEM_PROMPT.includes('VISUAL OCR DATA'));
  assert.ok(AGENT_SYSTEM_PROMPT.includes('confirmation codes'));
});

test('Gracefully handles empty or fallback visual context strings', () => {
  const domData = {
    url: 'http://localhost/test.html',
    title: 'DRISHTI AI — Demo Environment',
    element_count: 5,
    root: { id: 'element_0', tag: 'body' },
    visual_context: '(No visual text detected on screen)'
  };
  const prompt = buildUserPrompt(domData, 'Analyze page');
  assert.ok(prompt.includes('(No visual text detected on screen)'));
});

test('Integrates multiple canvas graphics into visual context (PIN & Voucher)', () => {
  const domData = {
    url: 'http://localhost/test.html',
    title: 'DRISHTI AI — Demo Environment',
    element_count: 45,
    root: { id: 'element_0', tag: 'body' },
    visual_context: '[CANVAS GRAPHIC #ocr-test-canvas]:\nCONFIRMATION: 9948-AB\n\n[CANVAS GRAPHIC #security-pin-canvas]:\nSECURITY PIN: 849201\nSTATUS: VERIFIED & ACTIVE\n\n[CANVAS GRAPHIC #voucher-canvas]:\nVOUCHER: DRISHTI-VIP-2026\nSPECIAL OFFER: 50% INSTANT DISCOUNT'
  };
  const prompt = buildUserPrompt(domData, 'What is the security PIN and voucher code?');
  assert.ok(prompt.includes('SECURITY PIN: 849201'));
  assert.ok(prompt.includes('VOUCHER: DRISHTI-VIP-2026'));
  assert.ok(prompt.includes('50% INSTANT DISCOUNT'));
});

// TEST GROUP 4: Advanced Privacy & Multimodal Agent Edge Cases
console.log('\n--- Group 4: Advanced Privacy & Multimodal Agent Edge Cases ---');

test('Applies Privacy Firewall to PII drawn on Canvas graphics', () => {
  const rawCanvasText = '[CANVAS GRAPHIC #secret-badge]:\nEmployee ID: EMP-1092\nEmail: ceo-private@confidential.com\nCard: 4111-2222-3333-4444';
  const res = processPII(rawCanvasText, DEFAULT_FIREWALL_CONFIG);
  assert.ok(!res.redactedText.includes('ceo-private@confidential.com'));
  assert.ok(!res.redactedText.includes('4111-2222-3333-4444'));
  assert.ok(res.redactedText.includes('[EMAIL_REDACTED]'));
  assert.ok(res.redactedText.includes('[CREDIT_CARD_REDACTED]'));
  assert.ok(res.redactedText.includes('Employee ID: EMP-1092'));
});

test('Combines multi-step action history with live visual context', () => {
  const domData = {
    url: 'http://localhost/test.html',
    title: 'DRISHTI AI — Demo Environment',
    element_count: 50,
    root: { id: 'element_0', tag: 'body' },
    visual_context: '[CANVAS GRAPHIC #security-pin-canvas]:\nSECURITY PIN: 849201'
  };
  const history = [
    { action: 'SCROLL', target: 'element_90', value: 'bottom', execution_result: 'SUCCESS' }
  ];
  const prompt = buildUserPrompt(domData, 'What is the security PIN?', history);
  assert.ok(prompt.includes('RECENT ACTIONS TAKEN:'));
  assert.ok(prompt.includes('Action: SCROLL'));
  assert.ok(prompt.includes('SECURITY PIN: 849201'));
});

test('Truncates overly large visual context to prevent token overflows', () => {
  const hugeText = 'A'.repeat(5000);
  const domData = {
    url: 'http://localhost/test.html',
    title: 'DRISHTI AI — Demo Environment',
    element_count: 10,
    root: { id: 'element_0', tag: 'body' },
    visual_context: hugeText
  };
  const prompt = buildUserPrompt(domData, 'Analyze state');
  assert.ok(prompt.includes('[truncated]'));
  assert.ok(prompt.length < 6000);
});

// SUMMARY
console.log(`\n========================================`);
console.log(`Tests Completed: ${passedTests} / ${totalTests} Passed`);
console.log(`========================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  console.log('🎉 All Phase 10 OCR & Vision synchronization tests passed successfully!');
}
