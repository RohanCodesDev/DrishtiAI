// DrishtiAI Content Script — Robust Privacy Firewall & Structured DOM Extraction Engine
// Injected into webpages to analyze DOM structure and locally redact sensitive data.

// Default Firewall Configuration (All PII protections enabled by default)
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

// In-memory cache of firewall configuration for fast real-time DOM processing
let currentFirewallConfig = null;

// Normalize configuration from storage or message payload
function normalizeFirewallConfig(raw) {
  const config = {
    rules: { ...DEFAULT_FIREWALL_CONFIG.rules },
    custom_blacklist: [],
    custom_whitelist: []
  };

  if (!raw) return config;

  // Handle new format { rules: {...}, custom_blacklist: [...], custom_whitelist: [...] }
  if (raw.rules && typeof raw.rules === 'object') {
    Object.keys(DEFAULT_FIREWALL_CONFIG.rules).forEach((key) => {
      if (typeof raw.rules[key] === 'boolean') {
        config.rules[key] = raw.rules[key];
      }
    });
  } else if (raw.piiConfig && typeof raw.piiConfig === 'object') {
    // Legacy backward compatibility format where piiConfig was { email: false } (meaning allowed if true)
    Object.keys(DEFAULT_FIREWALL_CONFIG.rules).forEach((key) => {
      if (typeof raw.piiConfig[key] === 'boolean') {
        config.rules[key] = !raw.piiConfig[key];
      }
    });
  }

  if (Array.isArray(raw.custom_blacklist)) {
    config.custom_blacklist = raw.custom_blacklist
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
  }

  if (Array.isArray(raw.custom_whitelist)) {
    config.custom_whitelist = raw.custom_whitelist
      .filter((item) => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
  }

  return config;
}

// Retrieve current firewall config from storage
async function getStoredFirewallConfig() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    try {
      const stored = await chrome.storage.local.get(['firewallConfig', 'piiConfig']);
      currentFirewallConfig = normalizeFirewallConfig(stored.firewallConfig || stored);
      return currentFirewallConfig;
    } catch (err) {
      console.warn('DrishtiAI: Failed to read firewallConfig from storage:', err);
    }
  }
  if (!currentFirewallConfig) {
    currentFirewallConfig = normalizeFirewallConfig(null);
  }
  return currentFirewallConfig;
}

// Automatically sync when storage changes
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.firewallConfig || changes.piiConfig)) {
      const newStored = changes.firewallConfig ? changes.firewallConfig.newValue : changes.piiConfig.newValue;
      currentFirewallConfig = normalizeFirewallConfig(newStored);
    }
  });
}

// Luhn algorithm check for validating credit card numbers
function isLuhnValid(numberStr) {
  const digits = numberStr.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

// Escape special regex characters in user-provided strings
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Robust Privacy Firewall Engine
 * 1. Whitelist Protection: Safeguards whitelisted patterns with unique token placeholders.
 * 2. Custom Blacklist: Scans and masks user-defined sensitive keywords and regexes.
 * 3. Built-in PII Detectors: Masks Email, Phone, Credit Cards, SSN, Aadhaar, PAN, API Keys, IPs, Crypto, Passport.
 * 4. Whitelist Restoration: Replaces placeholders back to original whitelisted text.
 */
function processPII(text, config = currentFirewallConfig || DEFAULT_FIREWALL_CONFIG) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return { redactedText: text, piiTypes: [] };
  }

  const rules = config.rules || DEFAULT_FIREWALL_CONFIG.rules;
  const blacklist = config.custom_blacklist || [];
  const whitelist = config.custom_whitelist || [];

  let processed = text;
  const piiTypes = new Set();
  const whitelistTokens = new Map();
  let tokenCounter = 0;

  // STEP 1: Whitelist Extraction & Placeholder Tokenization
  whitelist.forEach((wlItem) => {
    if (!wlItem) return;
    try {
      let wlRegex;
      if (wlItem.startsWith('/') && wlItem.lastIndexOf('/') > 0) {
        const lastSlash = wlItem.lastIndexOf('/');
        const pattern = wlItem.slice(1, lastSlash);
        const flags = wlItem.slice(lastSlash + 1) || 'g';
        wlRegex = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
      } else {
        wlRegex = new RegExp(escapeRegex(wlItem), 'gi');
      }

      processed = processed.replace(wlRegex, (match) => {
        const placeholder = `\uFFF0__DRISHTI_WL_${tokenCounter++}__\uFFF1`;
        whitelistTokens.set(placeholder, match);
        return placeholder;
      });
    } catch (err) {
      console.warn(`DrishtiAI: Invalid whitelist entry "${wlItem}":`, err);
    }
  });

  // STEP 2: Custom Blacklist Matching & Redaction
  blacklist.forEach((blItem) => {
    if (!blItem) return;
    try {
      let blRegex;
      if (blItem.startsWith('/') && blItem.lastIndexOf('/') > 0) {
        const lastSlash = blItem.lastIndexOf('/');
        const pattern = blItem.slice(1, lastSlash);
        const flags = blItem.slice(lastSlash + 1) || 'g';
        blRegex = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
      } else {
        blRegex = new RegExp(`\\b${escapeRegex(blItem)}\\b|${escapeRegex(blItem)}`, 'gi');
      }

      if (blRegex.test(processed)) {
        piiTypes.add('custom_blacklist');
        processed = processed.replace(blRegex, '[BLACKLIST_REDACTED]');
      }
    } catch (err) {
      console.warn(`DrishtiAI: Invalid blacklist entry "${blItem}":`, err);
    }
  });

  // STEP 3: Built-in PII Rule Detectors

  // 1. Email Detection
  if (rules.email) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    if (emailRegex.test(processed)) {
      piiTypes.add('email');
      processed = processed.replace(emailRegex, '[EMAIL_REDACTED]');
    }
  }

  // 2. API Keys, JWT & Auth Secrets
  if (rules.api_key) {
    // JWT tokens (eyJ...)
    const jwtRegex = /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_.+/=-]{10,}\b/g;
    if (jwtRegex.test(processed)) {
      piiTypes.add('api_key');
      processed = processed.replace(jwtRegex, '[API_KEY_REDACTED]');
    }

    // Popular API keys (OpenAI, Stripe, GitHub, AWS, Google AI, generic Bearer)
    const apiKeyRegex = /\b(?:sk-[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9_-]{20,}|sk_live_[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|AIza[0-9A-Za-z-_]{35}|AKIA[0-9A-Z]{16}|bearer\s+[a-zA-Z0-9_\-\.]{25,})\b/gi;
    if (apiKeyRegex.test(processed)) {
      piiTypes.add('api_key');
      processed = processed.replace(apiKeyRegex, '[API_KEY_REDACTED]');
    }
  }

  // 3. Credit Card Detection (formatted 16-digit cards or Luhn-validated continuous numbers)
  if (rules.credit_card) {
    // Formatted 16-digit (or Amex 15-digit) card numbers
    const formattedCcRegex = /\b(?:\d{4}[ -]){3}\d{4}\b|\b\d{4}[ -]\d{6}[ -]\d{5}\b/g;
    if (formattedCcRegex.test(processed)) {
      piiTypes.add('credit_card');
      processed = processed.replace(formattedCcRegex, '[CREDIT_CARD_REDACTED]');
    }

    // Continuous 13-19 digit card numbers (validated via Luhn algorithm)
    const rawCcRegex = /\b\d{13,19}\b/g;
    const ccMatches = processed.match(rawCcRegex);
    if (ccMatches) {
      ccMatches.forEach((match) => {
        if (isLuhnValid(match)) {
          piiTypes.add('credit_card');
          processed = processed.replace(new RegExp(`\\b${match}\\b`, 'g'), '[CREDIT_CARD_REDACTED]');
        }
      });
    }
  }

  // 4. US Social Security Number (SSN)
  if (rules.ssn) {
    const ssnRegex = /\b(?!000|666|9\d{2})\d{3}[-.\s](?!00)\d{2}[-.\s](?!0000)\d{4}\b/g;
    if (ssnRegex.test(processed)) {
      piiTypes.add('ssn');
      processed = processed.replace(ssnRegex, '[SSN_REDACTED]');
    }
  }

  // 5. Indian Aadhaar Card (12 digits, cannot start with 0 or 1)
  if (rules.aadhaar) {
    const aadhaarRegex = /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g;
    if (aadhaarRegex.test(processed)) {
      piiTypes.add('aadhaar');
      processed = processed.replace(aadhaarRegex, '[AADHAAR_REDACTED]');
    }
  }

  // 6. Indian PAN Card (5 letters, 4 numbers, 1 letter)
  if (rules.pan_card) {
    const panRegex = /\b[A-Z]{5}\d{4}[A-Z]{1}\b/gi;
    if (panRegex.test(processed)) {
      piiTypes.add('pan_card');
      processed = processed.replace(panRegex, '[PAN_REDACTED]');
    }
  }

  // 7. Phone Numbers (US, Indian mobile, and International formatted)
  if (rules.phone) {
    // Handles +1 (555) 000-0000, 800-555-1234, +91 9876543210, 9876543210
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|(?:\+?91[\s-]?)?[6-9]\d{9}\b/g;
    if (phoneRegex.test(processed)) {
      piiTypes.add('phone');
      processed = processed.replace(phoneRegex, '[PHONE_REDACTED]');
    }
  }

  // 8. IP Addresses (IPv4 and IPv6)
  if (rules.ip_address) {
    const ipv4Regex = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
    if (ipv4Regex.test(processed)) {
      piiTypes.add('ip_address');
      processed = processed.replace(ipv4Regex, '[IP_ADDRESS_REDACTED]');
    }

    const ipv6Regex = /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g;
    if (ipv6Regex.test(processed)) {
      piiTypes.add('ip_address');
      processed = processed.replace(ipv6Regex, '[IP_ADDRESS_REDACTED]');
    }
  }

  // 9. Crypto Wallet Addresses (Ethereum 0x..., Bitcoin Legacy/SegWit)
  if (rules.crypto_wallet) {
    const ethRegex = /\b0x[a-fA-F0-9]{40}\b/g;
    if (ethRegex.test(processed)) {
      piiTypes.add('crypto_wallet');
      processed = processed.replace(ethRegex, '[CRYPTO_WALLET_REDACTED]');
    }

    const btcRegex = /\b(?:1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,59}\b/g;
    if (btcRegex.test(processed)) {
      piiTypes.add('crypto_wallet');
      processed = processed.replace(btcRegex, '[CRYPTO_WALLET_REDACTED]');
    }
  }

  // 10. Passport Numbers
  if (rules.passport) {
    const passportRegex = /\b[A-PR-WYa-pr-wy][1-9]\d{7}\b/g;
    if (passportRegex.test(processed)) {
      piiTypes.add('passport');
      processed = processed.replace(passportRegex, '[PASSPORT_REDACTED]');
    }
  }

  // STEP 4: Restore Whitelisted Placeholders back to their pristine originals
  whitelistTokens.forEach((originalValue, placeholder) => {
    processed = processed.split(placeholder).join(originalValue);
  });

  return {
    redactedText: processed,
    piiTypes: Array.from(piiTypes)
  };
}

const IGNORED_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'HEAD'
]);

const SEMANTIC_TAGS = new Set([
  'BODY', 'HEADER', 'NAV', 'MAIN', 'SECTION', 'ARTICLE', 'ASIDE', 'FOOTER',
  'FORM', 'FIELDSET', 'LEGEND', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD',
  'UL', 'OL', 'LI', 'DL', 'DT', 'DD', 'DIALOG', 'DETAILS', 'SUMMARY',
  'FIGURE', 'FIGCAPTION', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'P', 'PRE', 'CODE', 'LABEL', 'IMG', 'CANVAS', 'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION'
]);

const INTERACTIVE_TAGS = new Set([
  'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'DETAILS', 'SUMMARY'
]);

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem',
  'menuitemcheckbox', 'menuitemradio', 'textbox', 'combobox', 'searchbox',
  'slider', 'spinbutton', 'option', 'treeitem'
]);

const SENSITIVE_INPUT_NAMES = new Set([
  'password', 'pass', 'pwd', 'secret', 'token', 'cvv', 'cvc', 'pin', 'ssn', 'auth', 'cardnumber'
]);

// Check whether an element is visible in layout
function isElementVisible(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.hasAttribute('hidden')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;

  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
      if (style.opacity === '0') return false;
    } catch (e) {
      // Fallback gracefully
    }
  }
  return true;
}

// Get rounded bounding box coordinates for visible elements
function getCoordinates(el) {
  if (typeof el.getBoundingClientRect === 'function') {
    try {
      const rect = el.getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0 || rect.x !== 0 || rect.y !== 0)) {
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        };
      }
    } catch (e) {}
  }
  return null;
}

// Identify whether an element is interactive for agent actions
function isInteractive(el, tag, role) {
  if (INTERACTIVE_TAGS.has(tag)) {
    if (tag === 'INPUT' && (el.type === 'hidden' || el.getAttribute('type') === 'hidden')) return false;
    if (tag === 'A' && !el.hasAttribute('href') && !el.hasAttribute('role') && !el.hasAttribute('tabindex')) return false;
    return true;
  }
  if (role && INTERACTIVE_ROLES.has(role.toLowerCase())) return true;
  if (el.isContentEditable) return true;
  if (el.hasAttribute('onclick')) return true;
  if (el.hasAttribute('tabindex')) {
    const tabIndex = parseInt(el.getAttribute('tabindex'), 10);
    if (tabIndex >= 0 && (role || el.hasAttribute('aria-label') || (el.style && el.style.cursor === 'pointer'))) {
      return true;
    }
  }
  return false;
}

// Extract key AI-friendly attributes while strictly upholding privacy
function extractAttributes(el, tag, config) {
  const attrs = {};

  const role = el.getAttribute('role');
  if (role) attrs.role = role.trim();

  const title = el.getAttribute('title');
  if (title) attrs.title = title.trim();

  // ARIA attributes
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) attrs['aria-label'] = ariaLabel.trim();

  const ariaLabelledby = el.getAttribute('aria-labelledby');
  if (ariaLabelledby) attrs['aria-labelledby'] = ariaLabelledby.trim();

  const ariaDescribedby = el.getAttribute('aria-describedby');
  if (ariaDescribedby) attrs['aria-describedby'] = ariaDescribedby.trim();

  if (el.hasAttribute('aria-expanded')) {
    attrs['aria-expanded'] = el.getAttribute('aria-expanded') === 'true';
  }
  if (el.hasAttribute('aria-checked')) {
    attrs['aria-checked'] = el.getAttribute('aria-checked') === 'true';
  }
  if (el.hasAttribute('aria-selected')) {
    attrs['aria-selected'] = el.getAttribute('aria-selected') === 'true';
  }
  if (el.hasAttribute('aria-disabled')) {
    attrs['aria-disabled'] = el.getAttribute('aria-disabled') === 'true';
  }

  // State attributes
  if (el.disabled || el.hasAttribute('disabled')) attrs.disabled = true;
  if (el.checked || el.hasAttribute('checked')) attrs.checked = true;
  if (el.selected || el.hasAttribute('selected')) attrs.selected = true;
  if (el.required || el.hasAttribute('required')) attrs.required = true;
  if (el.readOnly || el.hasAttribute('readonly')) attrs.readonly = true;

  // Tag-specific attributes
  if (tag === 'INPUT') {
    const type = (el.type || el.getAttribute('type') || 'text').toLowerCase();
    attrs.type = type;

    const name = el.getAttribute('name');
    if (name) attrs.name = name;

    const placeholder = el.getAttribute('placeholder');
    if (placeholder) attrs.placeholder = placeholder;

    // PRIVACY SAFEGUARD: NEVER expose password or highly sensitive input values
    const isSensitiveField = type === 'password' || (name && SENSITIVE_INPUT_NAMES.has(name.toLowerCase()));
    if (!isSensitiveField) {
      const val = el.value !== undefined ? el.value : el.getAttribute('value');
      if (typeof val === 'string' && val.trim().length > 0) {
        attrs.value = val.trim();
      }
    } else {
      attrs.value = '[PASSWORD_PROTECTED]';
    }
  } else if (tag === 'TEXTAREA') {
    const name = el.getAttribute('name');
    if (name) attrs.name = name;
    const placeholder = el.getAttribute('placeholder');
    if (placeholder) attrs.placeholder = placeholder;
    const val = el.value !== undefined ? el.value : el.getAttribute('value');
    if (typeof val === 'string' && val.trim().length > 0) {
      attrs.value = val.trim();
    }
  } else if (tag === 'BUTTON') {
    const type = el.getAttribute('type') || 'button';
    attrs.type = type;
    const name = el.getAttribute('name');
    if (name) attrs.name = name;
  } else if (tag === 'A') {
    const href = el.getAttribute('href');
    if (href) attrs.href = href;
    const target = el.getAttribute('target');
    if (target) attrs.target = target;
  } else if (tag === 'IMG') {
    const alt = el.getAttribute('alt');
    if (alt) attrs.alt = alt.trim();
    const src = el.getAttribute('src');
    if (src) attrs.src = src.trim();
  } else if (tag === 'CANVAS') {
    if (el.id) attrs.id = el.id;
    const width = el.width || el.getAttribute('width');
    if (width) attrs.width = width;
    const height = el.height || el.getAttribute('height');
    if (height) attrs.height = height;
    const ariaLabel = el.getAttribute('aria-label') || el.getAttribute('title');
    if (ariaLabel) attrs.label = ariaLabel;
  } else if (tag === 'FORM') {
    const name = el.getAttribute('name');
    if (name) attrs.name = name;
    const action = el.getAttribute('action');
    if (action) attrs.action = action;
    const method = el.getAttribute('method');
    if (method) attrs.method = method.toUpperCase();
  } else if (tag === 'LABEL') {
    const htmlFor = el.getAttribute('for');
    if (htmlFor) attrs.for = htmlFor;
  } else if (tag === 'SELECT') {
    const name = el.getAttribute('name');
    if (name) attrs.name = name;
    if (el.multiple) attrs.multiple = true;
  } else if (tag === 'OPTION') {
    const val = el.getAttribute('value');
    if (val !== null) attrs.value = val;
  }

  return Object.keys(attrs).length > 0 ? attrs : null;
}

// Extract direct text of node without duplicating children text
function getDirectText(el) {
  const hasElementChildren = el.children && el.children.length > 0;
  if (!hasElementChildren) {
    const text = el.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  let directText = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      directText += node.textContent + ' ';
    }
  }
  return directText.replace(/\s+/g, ' ').trim();
}

// Recursively build sanitized DOM tree
function buildTree(el, config) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;

  const tag = el.tagName.toUpperCase();
  if (IGNORED_TAGS.has(tag)) return null;
  if (!isElementVisible(el)) return null;

  const tagLower = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  const interactive = isInteractive(el, tag, role);
  const attributes = extractAttributes(el, tag, config);
  const directText = getDirectText(el);
  const coordinates = getCoordinates(el);

  const children = [];
  if (tag !== 'SVG' && el.children) {
    for (let i = 0; i < el.children.length; i++) {
      const childResult = buildTree(el.children[i], config);
      if (childResult) {
        children.push(childResult);
      }
    }
  }

  const hasChildren = children.length > 0;
  const hasText = directText.length > 0;
  const hasAttributes = attributes !== null;
  const isSemantic = SEMANTIC_TAGS.has(tag);

  if (!hasChildren && !hasText && !hasAttributes && !interactive && !isSemantic) {
    return null;
  }

  const nodeObj = {
    tag: tagLower,
    __el: el
  };

  if (role) {
    nodeObj.role = role;
  }

  let nodeHasPII = false;
  const nodePIITypes = new Set();

  if (hasText) {
    const { redactedText, piiTypes } = processPII(directText, config);
    nodeObj.text = redactedText;
    if (piiTypes.length > 0) {
      nodeHasPII = true;
      piiTypes.forEach((t) => nodePIITypes.add(t));
    }
  }

  if (hasAttributes) {
    for (const [key, val] of Object.entries(attributes)) {
      if (typeof val === 'string') {
        const { redactedText, piiTypes } = processPII(val, config);
        if (piiTypes.length > 0) {
          attributes[key] = redactedText;
          nodeHasPII = true;
          piiTypes.forEach((t) => nodePIITypes.add(t));
        }
      }
    }
    nodeObj.attributes = attributes;
  }

  if (nodeHasPII) {
    nodeObj.has_pii = true;
    nodeObj.pii_types = Array.from(nodePIITypes);
  }

  if (interactive) {
    nodeObj.interactive = true;
  }

  if (coordinates) {
    nodeObj.coordinates = coordinates;
  }

  if (hasChildren) {
    nodeObj.children = children;
  }

  return nodeObj;
}

// Assign snapshot-local sequential IDs in top-down pre-order
function assignIds(rawTree) {
  let elementCount = 0;
  function walk(node) {
    if (!node) return null;
    const id = `element_${elementCount++}`;
    
    // Tag the actual DOM element so the agent can interact with it later
    if (node.__el) {
      node.__el.dataset.drishtiId = id;
    }

    const ordered = {
      id: id,
      tag: node.tag
    };
    if (node.role) ordered.role = node.role;
    if (node.text) ordered.text = node.text;
    if (node.has_pii) ordered.has_pii = node.has_pii;
    if (node.pii_types) ordered.pii_types = node.pii_types;
    if (node.attributes) ordered.attributes = node.attributes;
    if (node.interactive) ordered.interactive = node.interactive;
    if (node.coordinates) ordered.coordinates = node.coordinates;
    if (node.children) {
      ordered.children = node.children.map((child) => walk(child));
    }
    return ordered;
  }
  const root = walk(rawTree);
  return { root, elementCount };
}

// Generate complete structured DOM with active privacy protections
async function getStructuredDOM(overrideConfig = null) {
  const config = overrideConfig ? normalizeFirewallConfig(overrideConfig) : await getStoredFirewallConfig();
  currentFirewallConfig = config;

  const rawTree = document.body ? buildTree(document.body, config) : null;
  const { root, elementCount } = rawTree ? assignIds(rawTree) : { root: null, elementCount: 0 };

  // Extract visible canvas graphic elements for direct high-resolution vision decoding
  const canvases = [];
  if (typeof document !== 'undefined') {
    const canvasElements = Array.from(document.querySelectorAll('canvas')).filter(isElementVisible);
    for (const c of canvasElements) {
      try {
        const dataUrl = c.toDataURL('image/png');
        if (dataUrl && dataUrl.length > 50) {
          canvases.push({
            id: c.id || c.dataset?.drishtiId || 'canvas',
            dataUrl: dataUrl,
            width: c.width,
            height: c.height
          });
        }
      } catch (e) {
        // Tainted canvas gracefully skipped
      }
    }
  }

  return {
    url: window.location.href,
    title: document.title,
    element_count: elementCount,
    firewall_active_rules: Object.keys(config.rules).filter((k) => config.rules[k]).length,
    custom_blacklist_count: config.custom_blacklist.length,
    custom_whitelist_count: config.custom_whitelist.length,
    canvases: canvases,
    root: root
  };
}

// Listen for messages from background service worker and sidebar (Only if NOT in offscreen doc)
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage && !window.location.href.includes('offscreen.html')) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && (message.type === 'GET_DOM' || message.type === 'GET_PAGE_CONTEXT')) {
      (async () => {
        try {
          const domData = await getStructuredDOM(message.config);
          sendResponse({ success: true, data: domData });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    // Real-time update message dispatched directly when user changes settings in sidebar
    if (message && message.type === 'FIREWALL_CONFIG_UPDATED') {
      (async () => {
        try {
          currentFirewallConfig = normalizeFirewallConfig(message.config);
          const domData = await getStructuredDOM(currentFirewallConfig);
          sendResponse({ success: true, data: domData });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message && message.type === 'PING') {
      sendResponse({ success: true, status: 'ready', version: 2 });
      return true;
    }

    if (message && message.type === 'EXECUTE_ACTION') {
      const ai = message.action;
      console.log('DrishtiAI executing action:', ai);
      
      let targetElement = null;
      if (ai.target_id) {
        targetElement = document.querySelector(`[data-drishti-id="${ai.target_id}"]`);
      }

      if (!targetElement && ai.action !== 'DONE' && ai.action !== 'WAIT' && ai.action !== 'SCROLL') {
        sendResponse({ success: false, error: 'Target element not found' });
        return true;
      }

      try {
        switch (ai.action) {
          case 'CLICK':
            if (targetElement) {
              targetElement.focus();
              targetElement.click();
              highlightElement(targetElement, ai.action);
            }
            break;
          case 'TYPE':
            if (targetElement) {
              targetElement.focus();
              targetElement.value = ai.value || '';
              targetElement.dispatchEvent(new Event('input', { bubbles: true }));
              targetElement.dispatchEvent(new Event('change', { bubbles: true }));
              highlightElement(targetElement, ai.action);
            }
            break;
          case 'NAVIGATE':
            if (ai.value) window.location.href = ai.value;
            break;
          case 'SCROLL': {
            const val = (ai.value || '').toString().toLowerCase().trim();
            const scrollAmount = Math.max(window.innerHeight * 0.85, 750);
            
            // Resolve semantic container card if targetElement is inside one
            const isBodyOrHtml = targetElement === document.body || targetElement === document.documentElement;
            const container = (targetElement && !isBodyOrHtml) 
              ? (targetElement.closest('.card, section, form, article, fieldset, main, table') || targetElement)
              : null;

            if (val === 'top') {
              window.scrollTo({ top: 0, behavior: 'instant' });
              if (document.documentElement) document.documentElement.scrollTop = 0;
            } else if (val === 'bottom') {
              window.scrollTo({ top: 999999, behavior: 'instant' });
              if (document.documentElement) document.documentElement.scrollTop = 999999;
              if (document.body) document.body.scrollTop = 999999;
            } else if (val === 'down') {
              if (container && container !== document.body) {
                container.scrollIntoView({ behavior: 'instant', block: 'end', inline: 'nearest' });
                window.scrollBy({ top: 250, behavior: 'instant' });
              } else {
                window.scrollBy({ top: scrollAmount, behavior: 'instant' });
              }
            } else if (val === 'up') {
              if (container && container !== document.body) {
                container.scrollIntoView({ behavior: 'instant', block: 'start', inline: 'nearest' });
                window.scrollBy({ top: -100, behavior: 'instant' });
              } else {
                window.scrollBy({ top: -scrollAmount, behavior: 'instant' });
              }
            } else if (!isNaN(Number(val)) && val !== '') {
              window.scrollBy({ top: Number(val), behavior: 'instant' });
            } else if (container && container !== document.body) {
              container.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
              window.scrollBy({ top: 200, behavior: 'instant' });
            } else {
              window.scrollBy({ top: scrollAmount, behavior: 'instant' });
            }

            if (targetElement) {
              setTimeout(() => highlightElement(targetElement, ai.action), 50);
            }
            break;
          }
          default:
            if (targetElement) highlightElement(targetElement, ai.action);
            break;
        }
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }
  });
}

// Global hook for script execution
if (typeof window !== 'undefined') {
  window.__DRISHTI_VERSION = 2;
  window.__DrishtiFirewall = {
    getStructuredDOM,
    processPII,
    normalizeFirewallConfig
  };
}

// Return the structured DOM when evaluated directly via executeScript
if (typeof document !== 'undefined') {
  getStructuredDOM();
}

// Visual Highlighting for Agent Actions
function highlightElement(el, actionType) {
  if (!el) return;
  
  const rect = el.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.top = `${window.scrollY + rect.top}px`;
  overlay.style.left = `${window.scrollX + rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.boxSizing = 'border-box';
  overlay.style.border = '3px solid #22c55e'; // Green
  overlay.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
  overlay.style.borderRadius = getComputedStyle(el).borderRadius || '4px';
  overlay.style.boxShadow = '0 0 15px rgba(34, 197, 94, 0.6)';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '999999';
  overlay.style.transition = 'all 0.6s ease-out';
  
  const label = document.createElement('div');
  label.textContent = `🤖 Agent: ${actionType}`;
  label.style.position = 'absolute';
  label.style.top = '-26px';
  label.style.right = '0';
  label.style.background = '#22c55e';
  label.style.color = '#fff';
  label.style.fontSize = '12px';
  label.style.fontWeight = 'bold';
  label.style.padding = '2px 6px';
  label.style.borderRadius = '4px';
  label.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
  overlay.appendChild(label);
  
  document.body.appendChild(overlay);
  
  setTimeout(() => {
    overlay.style.transform = 'scale(1.03)';
    overlay.style.opacity = '0';
  }, 700);
  
  setTimeout(() => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }, 1400);
}

// Node.js environment export for automated testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processPII,
    normalizeFirewallConfig,
    DEFAULT_FIREWALL_CONFIG,
    isLuhnValid,
    escapeRegex
  };
}

