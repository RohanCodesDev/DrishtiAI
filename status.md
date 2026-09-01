# DRISHTI Project Status

*This document is a living file. It tracks the current capabilities of our project, explains the purpose of each file, and outlines our immediate next steps.*

## Current Status: 🟢 LangGraph.js + LangChain.js Orchestration Refactor Completed

### What We Can Do Now (Current Capabilities)
* **Manifest V3 Chrome Extension**: Tab-bound persistent side panel with real-time UI, DevTools debugging, and active-tab tracking.
* **10 Built-In Local PII Detectors**: Detect and redact Emails, Phone Numbers (US & International & Indian Mobile), Credit/Debit Cards (with Luhn check), Social Security Numbers (SSN), Indian Aadhaar Numbers, Indian PAN Cards, API Keys & JWT Secrets, IP Addresses (IPv4/IPv6), Crypto Wallets (ETH/BTC), and Passport Numbers on-device before any transmission.
* **Custom Blacklist & Whitelist**: Real-time keyword/regex blacklists (always masked) and whitelist tokens (preserved from redaction).
* **Stateful LangGraph Agent Orchestration**: Refactored backend reasoning loop into a stateful LangGraph (`OBSERVE` -> `REASON` -> `VALIDATE`) execution graph.
* **LangChain + ChatGroq Structured Output**: Type-safe reasoning using Zod schemas (`ActionResponseSchema`, `SingleActionSchema`) without brittle regex JSON extraction.
* **Two-Tier Deterministic Action Validation**: Independent validation layer enforcing allowed actions, required parameters, element existence verification against DOM snapshots, safe URL validation, and 10-step safety limit.
* **Extension Browser Action Executor**: Content script executes physical `CLICK`, `TYPE`, `SCROLL`, `NAVIGATE`, and `WAIT` commands with live visual green highlighting HUD and execution feedback (`SUCCESS` / `FAILED`).
* **Multi-Action Batching & Auto-Loop**: Plans sequential actions in a single step with 100ms micro-delays and autonomous looping up to the 10-loop cap with rate-limit backoff.
* **Instant Stop & Cancellation Control**: Dedicated prompt section Stop button with `AbortController` cancellation for in-flight requests, timer clearing, and loop execution interruption.

### File Directory & Purpose

* `readme.md` 
  * The Master Specification and Roadmap.
* `status.md` 
  * Tracks the current state of the project, file purposes, and next steps.
* `test.html` 
  * Comprehensive interactive test suite for verifying PII detectors, custom blacklists, and autonomous form actions.
* `extension/manifest.json` 
  * Manifest V3 configuration file.
* `extension/background.js` 
  * Background Service Worker managing tab awareness, offscreen OCR, and message routing.
* `extension/content.js` 
  * Content script housing the local Privacy Firewall and browser DOM action executor.
* `extension/sidebar.html`, `sidebar.css`, `sidebar.js` 
  * Side panel UI, dark-mode styling, firewall settings drawer, and autonomous loop controller.
* `backend/server.js` 
  * Express server handling CORS, payload limits, health checks, and `/api/analyze` routing to the LangGraph runner.
* `backend/agent/graph.js` 
  * LangGraph StateGraph builder, `observe`, `reason`, and `validate` nodes, and `runAgentGraph` runner.
* `backend/agent/state.js` 
  * LangGraph State Annotation schema defining agent memory and observations.
* `backend/agent/tools.js` 
  * LangChain capability tool definitions for DRISHTI's 7 browser actions.
* `backend/agent/actions.js` 
  * Zod schemas and 2-tier deterministic safety validation engine.
* `backend/agent/prompts.js` 
  * Battle-tested system prompts, DOM tree compression (`compressTree`), and user prompt builders.
* `backend/test-agent.js` 
  * Automated integration test suite covering compression, schemas, validation, LangGraph execution, and Express endpoints.
