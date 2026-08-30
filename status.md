# DRISHTI Project Status

*This document is a living file. It tracks the current capabilities of our project, explains the purpose of each file, and outlines our immediate next steps.*

## Current Status: 🟢 Phase 6 Enhanced (Robust Privacy Firewall & Real-Time Settings Pane)

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

### What We Will Do Next (Phase 7)
Our next major goal is the **Backend Server**. 
With our robust, real-time Privacy Firewall working seamlessly, we are ready to connect to a local Node.js/Express backend API to receive sanitized JSON payloads from our browser extension.
