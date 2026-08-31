# DRISHTI Project Status

*This document is a living file. It tracks the current capabilities of our project, explains the purpose of each file, and outlines our immediate next steps.*

## Current Status: 🟢 Phase 9 Completed (Intelligent Agent & Safe Actions)

### What We Can Do Now (Current Capabilities)
* Load a custom, local Manifest V3 extension into Google Chrome.
* Open a persistent browser Side Panel (DrishtiAI) directly by clicking the extension action icon.
* Maintain a persistent assistant interface that stays open alongside the active webpage while browsing.
* Track the active browser tab dynamically across tab switches, navigation, and reloads.
* Gracefully detect and handle restricted browser pages (`chrome://`, Chrome Web Store) where page script access is disallowed.
* Request and extract a clean, AI-friendly nested DOM hierarchy (preserving parent-child container relationships, interactive flags, coordinates, and semantic attributes while safeguarding sensitive fields like passwords).
* View the page's hierarchical DOM structure via formatted real-time JSON with live element count badges.
* **10 Built-In PII Detectors**: Detect and redact Emails, Phone Numbers (US & International & Indian Mobile), Credit/Debit Cards (with Luhn check), Social Security Numbers (SSN), Indian Aadhaar Numbers, Indian PAN Cards, API Keys & JWT Secrets, IP Addresses (IPv4/IPv6), Crypto Wallets (ETH/BTC), and Passport Numbers.
* **Custom Blacklist (Always Redact)**: Users can define custom sensitive keywords, phrases, or regex patterns to always be masked as `[BLACKLIST_REDACTED]`.
* **Custom Whitelist (Always Allow)**: Users can define public emails, domains, or tokens to safeguard from redaction, protected with non-destructive token placeholders.
* **Real-Time Reactive Settings Pane**: Dedicated slide-over settings drawer in the sidebar allowing instant rule toggling, blacklist/whitelist additions/removals, preset controls, and instantaneous JSON DOM updates without page reloads.
* Explicitly flag elements that contain PII in the structured JSON representation.
* **Express Backend Integration**: Communicates efficiently with the Groq API for LLM inference.
* **Robust JSON Parsing**: Uses custom RegEx extraction to perfectly parse AI actions even if the LLM hallucinates conversational filler or markdown.
* **Agent Memory (Action History)**: The AI is fed a rolling history of its past actions (and their execution success/failure) to allow it to logically progress through workflows without repeating itself.
* **Execution Feedback**: The agent receives real-time boolean feedback on whether its `TYPE` or `CLICK` actions actually succeeded, allowing it to self-correct on the next loop if an element was hidden or disabled.
* **Multi-Action Batching**: The AI is capable of planning arrays of sequential actions in a single inference loop, rapidly executing them with 100ms micro-delays to flawlessly emulate human typing speed.
* **Auto-Scrolling**: The LLM can issue physical `SCROLL` commands to navigate long, lazy-loaded pages.
* **Visual Highlights**: A glowing green bounding box dynamically appears over elements as the Agent interacts with them for peak observability.
* **Rate-Limit Resilience**: The agent intelligently catches `429 Too Many Requests` API limits, automatically backing off for 6 seconds, and seamlessly retrying the loop without crashing.

### File Directory & Purpose

* `readme.md` 
  * The Master Specification and Roadmap. Contains the overall architecture, rules, and phase-by-phase goals.
* `status.md` 
  * This file! Tracks the current state of the project, file purposes, and next steps.
* `test.html` 
  * Comprehensive interactive test suite for verifying PII detectors, custom blacklists, and whitelist overrides.
* `extension/manifest.json` 
  * The Manifest V3 configuration file. Declares the extension metadata, `side_panel`, `background.service_worker`, permissions (`sidePanel`, `tabs`, `scripting`, `storage`), and `host_permissions`.
* `extension/background.js` 
  * The Background Service Worker. Configures side panel behavior (`openPanelOnActionClick`), manages active tab awareness, and coordinates message routing and config propagation between the sidebar and content scripts.
* `extension/content.js` 
  * The script injected into the active webpage. Houses the robust `PrivacyFirewallEngine` (with whitelist isolation, blacklist redaction, 10 PII detectors, and attribute sanitization), extracts structured DOM trees, and responds in real-time to runtime configuration updates.
* `extension/sidebar.html` 
  * The visual structure of the persistent browser side panel, including the header, active firewall summary strip, slide-over Settings Pane with toggle switches and tag lists, and JSON DOM container.
* `extension/sidebar.css` 
  * Responsive dark-mode styling optimized for side panels (300–500px), featuring smooth slide-over transitions, custom toggle switches, chip badges, and input groups.
* `extension/sidebar.js` 
  * The controller for the sidebar interface. Manages firewall configuration state, synchronizes with `chrome.storage.local`, dispatches real-time re-sanitization requests to content scripts, handles tag additions/removals, and renders formatted JSON.

### What We Will Do Next (Phase 10)
Our next major goal is **Advanced Local Vision & OCR**.
While DOM extraction is incredibly powerful, some modern web apps use Canvas or obfuscated SVGs. We will look into incorporating lightweight on-device OCR (e.g., Tesseract.js) to allow the agent to literally "read" the screen visually without sending images to the cloud.
