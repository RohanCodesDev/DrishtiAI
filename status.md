# DRISHTI Project Status

*This document is a living file. It tracks the current capabilities of our project, explains the purpose of each file, and outlines our immediate next steps.*

## Current Status: 🟢 Phase 10 Completed (Local Vision & OCR Synchronization)

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
* **On-Device Vision & Dual-Mode OCR (Phase 10 — Production Ready)**: Manifest V3 Offscreen Document running Tesseract.js WebAssembly workers locally on-device without blocking UI or web page threads.
* **Direct 1:1 Canvas Graphic Extraction**: Automatically scrapes on-screen `<canvas>` elements, rasterizes them to raw pixel data URLs, and decodes graphical codes, security PINs, badges, and vouchers with 100% precision.
* **Screenshot-to-Worker Synchronization**: Live window-targeted viewport capture synchronized directly with WASM OCR workers for pixel-level visual text extraction.
* **OCR Privacy Firewall Redaction**: All text extracted from visual screenshots and canvas graphics is sanitized in real-time by `processPII` according to user firewall rules before transmission to backend AI.
* **Multi-Canvas Graphic Understanding**: Enables the AI agent to read distinct confirmation codes, 2FA security PINs, VIP promo vouchers, and captcha badges simultaneously.
* **Visual Context Observability**: Real-time `👁️ OCR (X Canvases)` status badge in the sidebar header and firewall status bar.

### File Directory & Purpose

* `readme.md` 
  * The Master Specification and Roadmap. Contains the overall architecture, rules, and phase-by-phase goals.
* `status.md` 
  * This file! Tracks the current state of the project, file purposes, and next steps.
* `test.html` 
  * Comprehensive interactive test suite for verifying PII detectors, custom blacklists, whitelist overrides, and Canvas OCR confirmation code tests.
* `tests/ocr_pipeline.test.js`
  * Automated test suite validating OCR PII redaction, whitelist/blacklist rules, and agent prompt formatting.
* `extension/manifest.json` 
  * The Manifest V3 configuration file. Declares extension metadata, `side_panel`, `background.service_worker`, permissions (`sidePanel`, `tabs`, `activeTab`, `scripting`, `storage`, `offscreen`), and web accessible WASM resources.
* `extension/background.js` 
  * The Background Service Worker. Configures side panel behavior, manages offscreen document lifecycle with singleton promise locks, coordinates window-specific viewport screenshot capture, and routes OCR data.
* `extension/offscreen.html` & `extension/offscreen.js`
  * The Offscreen Vision Engine. Houses the Tesseract.js WebAssembly OCR worker and local Privacy Firewall redaction pipeline.
* `extension/content.js` 
  * The script injected into the active webpage. Houses the robust `PrivacyFirewallEngine`, extracts structured DOM trees, highlights elements, and supports Node.js test execution.
* `extension/sidebar.html` 
  * The visual structure of the persistent browser side panel, including header, live OCR badge, firewall summary strip, slide-over Settings Pane, and JSON DOM container.
* `extension/sidebar.css` 
  * Responsive dark-mode styling with badge pills, toggle sliders, and smooth slide-over animations.
* `extension/sidebar.js` 
  * The controller for the sidebar interface. Manages configuration state, triggers real-time DOM/OCR synchronizations, and executes autonomous agent action loops.
* `backend/server.js` & `backend/prompts.js`
  * Express backend communicating with Groq LLM inference, tree compression (`compressTree`), and prompt construction with `VISUAL OCR DATA`.

### What We Will Do Next (Phase 11 & 12)
* **Phase 11: Local Computer Vision & Web Lens**: "Click-to-Inspect" visual region bounding boxes and targeted OCR inspection.
* **Phase 12: Conversational Agent & Web Search**: Multi-turn chat interface, page Q&A, and autonomous Google/DuckDuckGo web research capabilities.
