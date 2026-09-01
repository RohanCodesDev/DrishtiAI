# DRISHTI: Privacy-First AI Browser Agent

**Smart India Hackathon (SIH) 2026 Project**  
*Role: Developer Roadmap & Master Specification*

---

## 1. Project Vision

**DRISHTI** is a privacy-first browser agent implemented primarily as a Chrome browser extension. 

The core mission is:
> **To create an AI browser agent that can understand and interact with webpages while ensuring sensitive visual/user information is detected and protected locally before anything is sent to cloud AI.**

### The Problem
Traditional AI browser agents send raw screenshots and complete HTML (DOM) context to a cloud server (like OpenAI, Anthropic). This poses a massive privacy risk if the user is looking at sensitive data (banking, emails, passwords, personal chats, enterprise dashboards).

### The Solution: Local Perception & Privacy Firewall
DRISHTI intercepts data *before* it leaves the browser. It uses lightweight, local on-device perception (DOM analysis, OCR, lightweight computer vision) to detect Personally Identifiable Information (PII) and redact it. Only the **sanitized context** is sent to the LLM/VLM for reasoning.

---

## 2. Eventual Architecture (High-Level)

The system will work progressively as a pipeline:

```text
USER → BROWSER
       ↓
LOCAL PAGE UNDERSTANDING (DOM, Screenshot, Local Vision, OCR)
       ↓
PRIVACY / PII DETECTION
       ↓
PRIVACY FIREWALL (Redaction & Tokenization)
       ↓
SANITIZED CONTEXT ONLY
       ↓
AI REASONING (LLM/VLM)
       ↓
STRUCTURED ACTION (JSON)
       ↓
ACTION VALIDATOR (Risk Check)
       ↓
BROWSER ACTION EXECUTED
```

**Central Principle:** Sensitive visual information must be processed locally whenever possible. Raw sensitive information should never unnecessarily leave the user's device.

---

## 3. Technology Stack Roadmap

We will introduce technologies progressively. Do not jump ahead.

* **Phase 1-3 (Foundation):** HTML, CSS, JavaScript, Chrome Manifest V3, Node.js, npm.
* **Phase 4-6 (Local Privacy):** DOM analysis, Regex, Tokenization, basic PII classifiers.
* **Phase 7 (Backend):** Node.js, Express.js, REST API.
* **Phase 8-9 (AI & Actions):** LLM APIs (processing JSON actions), Action schema validation.
* **Phase 10-12 (Advanced Local Vision):** Tesseract.js (OCR), ONNX Runtime Web, lightweight models, WebGPU.
* **Phase 13-15 (Polish):** Jest/Playwright (Testing), React/Tailwind (if UI scale demands it), Benchmarking tools.

---

## 4. Development Rules (Mentor & Mentee Agreement)

As this is a learning journey from absolute beginner to industry-level, the following rules apply to all AI mentorship interactions:

1. **Progressive Learning:** Do not dump large amounts of code. Do not introduce advanced tech (React, WebGPU, LLMs) before their fundamentals are understood and required by the specific phase.
2. **Step-by-Step Execution:** For every step: Explain *what* we are building, *why* it's needed, provide the code, explain the code simply, test it, and confirm it works before moving on.
3. **Architecture Adherence:** Always adhere to the Privacy-First principle. The AI model must never directly execute arbitrary code on the browser.
4. **Measurability:** Do not make false performance claims. We will benchmark latency, CPU/Memory usage, and redaction accuracy in later phases.
5. **No Skipping Phases:** Every phase must have a working milestone before proceeding to the next.

---

## 5. Master Roadmap (Phase 0 → Phase 15)

### Foundational Extension
* [x] **Phase 0:** Understand the architecture and vision of DRISHTI.
* [x] **Phase 1:** Development Environment Setup (VS Code, Chrome, Node.js).
* [x] **Phase 2:** Project Structure (Extension, Backend, Vision, Tests).
* [x] **Phase 3:** First Working Chrome Extension (Basic DOM reading popup).

### Local Perception & Privacy (Current Focus)
* [x] **Phase 4:** DOM / Page Understanding (Structured extraction of elements).
* [x] **Phase 5:** PII / Sensitive Information Detection (Finding emails, passwords, phones).
* [x] **Phase 6:** Privacy Firewall & Redaction (Masking PII before it can leave the extension).

### Backend & Intelligence (Completed)
* [x] **Phase 7:** Backend Server (Express API integration).
* [x] **Phase 8:** AI / LLM Reasoning (Sending sanitized data to Groq to get structured JSON actions).
* [x] **Phase 9:** Safe Browser Actions & Auto-Loop (Executing multi-action clicks/scrolls with execution feedback and memory).

### Advanced Vision & Optimization (Active Development)
* [x] **Phase 10:** Dual-Mode OCR & Canvas Vision (Reading text from screenshots & native 1:1 Canvas graphics locally via Tesseract.js WASM & Offscreen Document with live synchronization).
* [ ] **Phase 11:** Local Computer Vision & Web Lens ("Click-to-Inspect" & visual region bounding boxes).
* [ ] **Phase 12:** Conversational Agent & Web Search (Multi-turn chat, page Q&A, and autonomous Google/DuckDuckGo web research).
* [ ] **Phase 13:** ONNX + WebGPU & System Optimization (Caching, debouncing, lazy local inference).

### SIH Final Polish
* [ ] **Phase 14:** Benchmarking & Evaluation (Privacy Audit Certificate, 0-leak verification, latency charts).
* [ ] **Phase 15:** Industry/SIH Presentation Polish (Modern glassmorphic UI, Demo Environments, Security Hardening).

---

## 6. Current Status & Verification

We have completed **Phases 0 through 10**:
* **Manifest V3 Extension:** Tab-bound persistent side panel with real-time UI, live element counts, and DevTools debugging.
* **Privacy Firewall Engine:** Locally redacts 10+ PII categories (SSN, Aadhaar, PAN, Emails, API Keys, Cards, Crypto, IP, Passport, Phone) plus custom Regex Whitelist/Blacklist.
* **Dual-Mode Vision & OCR (Phase 10 Production Ready):** Chrome Offscreen document architecture running on-device `Tesseract.js` WebAssembly workers. Captures full viewport screenshots and directly extracts native 1:1 `<canvas>` graphics to decode confirmation codes, 2FA security PINs, and promotional vouchers with zero binarization loss.
* **Autonomous Reasoning Loop:** Multi-Action batching, action history memory, precision element scroll-into-view, visual green overlays, rate-limit backoff, and direct `REPLY` capability.
* **Automated Test Suite:** 14 unit tests validating privacy firewall rules, OCR redaction, whitelist overrides, and multimodal prompt integration (`node tests/ocr_pipeline.test.js`).

**Next Immediate Steps:**
1. Implement Phase 11: Local Computer Vision & "Click-to-Inspect" Web Lens.
2. Implement Phase 12: Conversational Agent Mode & Autonomous Web Search.
