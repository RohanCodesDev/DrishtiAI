// This file is injected into the webpage the user is viewing.

// Helper function to detect PII using Regular Expressions
function detectPII(text) {
  const piiTypes = [];
  
  // Basic Email Regex
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  if (emailRegex.test(text)) {
    piiTypes.push('email');
  }

  // Basic Phone Regex (matches formats like 555-123-4567, 555.123.4567, 555 123 4567)
  const phoneRegex = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;
  if (phoneRegex.test(text)) {
    piiTypes.push('phone');
  }

  return piiTypes;
}

function getStructuredDOM() {
  const elements = [];
  
  // We look for specific elements that an AI agent might want to interact with or read.
  const selectors = 'h1, h2, h3, p, a, button, input, textarea, select';
  const rawElements = document.querySelectorAll(selectors);

  // Loop through every element we found on the page
  rawElements.forEach((el, index) => {
    // getBoundingClientRect() gives us the exact coordinates and size of the element on screen
    const rect = el.getBoundingClientRect();
    
    // An element is visible if it has width and height, and isn't hidden by CSS
    const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';

    // We only care about visible elements right now
    if (isVisible) {
      // Get the most useful text we can find for this element
      const elementText = el.innerText || el.value || el.placeholder || '';
      
      // Clean up the text by removing extra spacing/newlines
      const cleanText = elementText.replace(/\s+/g, ' ').trim();

      // Detect any sensitive information (PII) in the clean text
      const detectedPII = detectPII(cleanText);
      const hasPII = detectedPII.length > 0;

      elements.push({
        id: `element_${index}`,
        type: el.tagName.toLowerCase(),
        text: cleanText,
        has_pii: hasPII,
        pii_types: detectedPII,
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      });
    }
  });

  // Package the final structured representation
  return {
    url: window.location.href,
    title: document.title,
    element_count: elements.length,
    elements: elements
  };
}

// Run the function and return its value to popup.js
getStructuredDOM();
