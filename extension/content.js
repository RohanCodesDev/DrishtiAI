// This file is injected into the webpage the user is viewing.

function getStructuredDOM() {
  const IGNORED_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'HEAD'
  ]);

  const SEMANTIC_TAGS = new Set([
    'BODY', 'HEADER', 'NAV', 'MAIN', 'SECTION', 'ARTICLE', 'ASIDE', 'FOOTER',
    'FORM', 'FIELDSET', 'LEGEND', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD',
    'UL', 'OL', 'LI', 'DL', 'DT', 'DD', 'DIALOG', 'DETAILS', 'SUMMARY',
    'FIGURE', 'FIGCAPTION', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'P', 'PRE', 'CODE', 'LABEL', 'IMG', 'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION'
  ]);

  const INTERACTIVE_TAGS = new Set([
    'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'DETAILS', 'SUMMARY'
  ]);

  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'checkbox', 'radio', 'switch', 'tab', 'menuitem',
    'menuitemcheckbox', 'menuitemradio', 'textbox', 'combobox', 'searchbox',
    'slider', 'spinbutton', 'option', 'treeitem'
  ]);

  // Check whether an element is visible in the viewport / layout
  function isElementVisible(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

    // Filter out explicit hidden attributes and ARIA hidden markers
    if (el.hasAttribute('hidden')) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;

    // Check computed styles if available (conservative: display none / visibility hidden)
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      try {
        const style = window.getComputedStyle(el);
        if (style.display === 'none') return false;
        if (style.visibility === 'hidden') return false;
      } catch (e) {
        // Fallback gracefully if computed style fails
      }
    }
    return true;
  }

  // Get rounded bounding box coordinates for meaningful on-screen elements
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
      } catch (e) {
        // Ignore bounding box errors
      }
    }
    return null;
  }

  // Identify whether an element is interactive for an agent action
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
  function extractAttributes(el, tag) {
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

      // PRIVACY SAFEGUARD: NEVER expose password values!
      if (type !== 'password') {
        const val = el.value !== undefined ? el.value : el.getAttribute('value');
        if (typeof val === 'string' && val.trim().length > 0) {
          attrs.value = val.trim();
        }
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

  // Extract direct/immediate text to avoid duplicating child text on ancestor nodes
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

  // Recursively build the hierarchical DOM node representation
  function buildTree(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;

    const tag = el.tagName.toUpperCase();
    if (IGNORED_TAGS.has(tag)) return null;
    if (!isElementVisible(el)) return null;

    const tagLower = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    const interactive = isInteractive(el, tag, role);
    const attributes = extractAttributes(el, tag);
    const directText = getDirectText(el);
    const coordinates = getCoordinates(el);

    // Recursively process children (omit internal geometry nodes for SVG icons)
    const children = [];
    if (tag !== 'SVG' && el.children) {
      for (let i = 0; i < el.children.length; i++) {
        const childResult = buildTree(el.children[i]);
        if (childResult) {
          children.push(childResult);
        }
      }
    }

    const hasChildren = children.length > 0;
    const hasText = directText.length > 0;
    const hasAttributes = attributes !== null;
    const isSemantic = SEMANTIC_TAGS.has(tag);

    // Filter out useless empty nodes without semantic value, text, attributes, or children
    if (!hasChildren && !hasText && !hasAttributes && !interactive && !isSemantic) {
      return null;
    }

    const nodeObj = {
      tag: tagLower
    };

    if (role) {
      nodeObj.role = role;
    }

    if (hasText) {
      nodeObj.text = directText;
    }

    if (hasAttributes) {
      nodeObj.attributes = attributes;
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
  let elementCount = 0;
  function assignIds(node) {
    if (!node) return null;
    const id = `element_${elementCount++}`;

    const orderedNode = {
      id: id,
      tag: node.tag
    };
    if (node.role) orderedNode.role = node.role;
    if (node.text) orderedNode.text = node.text;
    if (node.attributes) orderedNode.attributes = node.attributes;
    if (node.interactive) orderedNode.interactive = node.interactive;
    if (node.coordinates) orderedNode.coordinates = node.coordinates;
    if (node.children) {
      orderedNode.children = node.children.map(child => assignIds(child));
    }
    return orderedNode;
  }

  const rawTree = document.body ? buildTree(document.body) : null;
  const root = rawTree ? assignIds(rawTree) : null;

  // Package the final structured representation
  return {
    url: window.location.href,
    title: document.title,
    element_count: elementCount,
    root: root
  };
}

// Listen for messages from background/sidebar
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && (message.type === 'GET_DOM' || message.type === 'GET_PAGE_CONTEXT')) {
      try {
        const domData = getStructuredDOM();
        sendResponse({ success: true, data: domData });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }
    if (message && message.type === 'PING') {
      sendResponse({ success: true, status: 'ready' });
      return true;
    }
  });
}

// Return the structured DOM when evaluated directly via executeScript
getStructuredDOM();
