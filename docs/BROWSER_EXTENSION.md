# 🧩 DrishtiAI Chrome Extension (Manifest V3)

This document details the client-side architecture of **DrishtiAI**, implemented as a **Chrome Manifest V3** browser extension. It covers service worker lifecycles, the glassmorphic side panel UI, the Web Lens inspection engine, and the Human-in-the-Loop (HITL) safety gate.

---

## 1. Manifest V3 Architecture & Component Roles

DrishtiAI adheres strictly to the modern **Chrome Manifest V3** specification, avoiding deprecated background pages or insecure `eval()` operations.

```
┌──────────────────────────────────────────────────────────┐
│                    Chrome Browser Tab                    │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Target Webpage (DOM + Canvas)                      │  │
│  │ └─ Injected: content.js (DOM Extractor & Firewall)  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────┬────────────────────────────▲──────────────┘
               │ chrome.runtime.sendMessage │ Dispatches
               ▼                            │ Actions
┌──────────────────────────────────────────────────────────┐
│  Background Service Worker (background.js)               │
│  - Tab Binding & Lifecycle Orchestration                 │
│  - Offscreen Document Manager                            │
└──────────────┬────────────────────────────▲──────────────┘
               │ Routes                     │ Action Loop
               ▼                            │
┌──────────────────────────────┐  ┌─────────────────────────┐
│ Offscreen Document           │  │ Side Panel UI           │
│ (offscreen.html / .js)       │  │ (sidebar.html / .js)    │
│ - Tesseract.js WASM Core     │  │ - Reactive Chat Stream  │
│ - Hardware FaceDetector API  │  │ - Privacy Settings HUD  │
│ - Irreversible Blackout Mask │  │ - Telemetry & Audit Log │
└──────────────────────────────┘  └─────────────────────────┘
```

### Component Roles:
* [`extension/manifest.json`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/extension/manifest.json): Declares permissions (`sidePanel`, `activeTab`, `scripting`, `offscreen`, `storage`), host permissions (`<all_urls>`), and CSP compliance.
* [`extension/background.js`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/extension/background.js): Background service worker managing tab switching, offscreen document lifecycles, and cross-context messaging.
* [`extension/content.js`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/extension/content.js): Content script injected into active web pages. Extracts structured DOM nodes, stamps `data-drishti-id` attributes, runs the 11-rule PII firewall, and dispatches native SPA events.
* [`extension/sidebar.html`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/extension/sidebar.html) & [`sidebar.js`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/extension/sidebar.js): Side panel UI providing conversational interaction, live action telemetry, the settings drawer, and the audit certificate exporter.
* [`extension/offscreen.html`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/extension/offscreen.html) & [`offscreen.js`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/extension/offscreen.js): Isolated offscreen sandbox hosting Tesseract.js WebAssembly workers and the FaceDetector API.

---

## 2. Interactive "Click-to-Inspect" Web Lens

In addition to full autonomous workflows, DrishtiAI includes an interactive on-page inspection tool called **Web Lens**:

1. **Activation:** Toggle the **Web Lens** icon in the side panel header.
2. **Hover Targeting:** As the user hovers over any on-page element, an interactive targeting box tracks the element with smooth cyan borders.
3. **Floating Action Pill:** A floating glassmorphic toolbar appears adjacent to the selected element with three instant options:
   * **`[ 📝 Summarize ]`**: Generates a clean summary of the selected element or section.
   * **`[ 🔍 Search Web ]`**: Searches the web for the entity or concept.
   * **`[ 💬 Ask AI ]`**: Automatically copies the element's sanitized text into the side panel chat composer.
4. **Direct `<canvas>` Decoding:** If the user clicks on a `<canvas>` element (such as a chart, security badge, or PIN), Web Lens extracts the 1:1 image buffer, runs local WASM OCR, and displays the decoded text instantly.
5. **Table-to-Markdown Formatting:** When selecting HTML `<table>` elements, Web Lens automatically converts complex rows and columns into clean GitHub-flavored markdown tables.

---

## 3. Human-in-the-Loop (HITL) Safety Gate

Autonomous browser agents risk executing irreversible actions (such as accidentally deleting a cloud database or submitting unauthorized payments). DrishtiAI intercepts high-risk operations before execution:

### 1. Risk Detection Heuristic
When an action is proposed by the backend, [`extension/content.js`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/extension/content.js) scans the action type and target element for sensitive keywords:
```javascript
const HIGH_RISK_VERBS = [
  'delete', 'remove', 'drop', 'purge', 'pay', 'checkout', 
  'transfer', 'confirm purchase', 'terminate', 'destroy', 'wipe'
];
```

### 2. Visual Warning State
* If a match is detected, the auto-loop is immediately paused.
* The target element on the webpage is highlighted with a **pulsing amber border and glowing backdrop**.

### 3. Interactive User Approval Card
The side panel displays a high-priority Amber Approval Card detailing:
* The exact action proposed (`CLICK`, `TYPE`).
* The targeted element label and text.
* The specific risk reason.
* Two buttons: **`[ ✅ Approve Action ]`** and **`[ ❌ Reject & Abort ]`**.

The action will **never** execute until the user explicitly clicks Approve.

---

## 4. Offscreen Document WASM Sandboxing

Manifest V3 Content Security Policies prohibit executing WebAssembly inside background service workers. To circumvent this without compromising security:

* DrishtiAI spawns a dedicated **Chrome Offscreen Document** (`offscreen.html`).
* The offscreen document runs inside a lightweight, invisible browser context with full DOM access.
* Pre-bundled Tesseract.js WASM and language model data (`eng.traineddata.gz`) are loaded from local extension assets via `chrome.runtime.getURL()`.
* **Zero external network requests are required** for OCR inference.

---

## 5. Modern SPA Event Dispatching

To guarantee compatibility with **React, Vue, and Angular** virtual DOM state listeners, DrishtiAI uses direct prototype property descriptor injection:

```javascript
// Dispatches synthetic input events that bypass React's overridden setter
function setNativeInputValue(element, value) {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  );
  if (descriptor && descriptor.set) {
    descriptor.set.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
```

For click actions, DrishtiAI dispatches a complete 5-stage pointer event chain (`pointerdown`, `mousedown`, `focus`, `pointerup`, `click`), ensuring drag, drop, and custom canvas click listeners trigger reliably.
