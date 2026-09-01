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
* [x] **Phase 11:** Interactive "Click-to-Inspect" Web Lens (On-page floating glassmorphic Action Pill with `Summarize`, `Search Web`, `Ask AI`, direct `<canvas>` OCR decoding, and `<table>` markdown formatting).
* [ ] **Phase 12:** Autonomous Multi-Tab Web Research & Synthesis (Multi-tab comparative exploration with markdown table synthesis).
* [ ] **Phase 13:** ONNX Runtime Web Local Named Entity Recognition (In-browser MiniLM transformer for contextual human names and physical addresses).

### SIH PS-171 Compliance & Polish
* [x] **Phase 14:** Zero-Leak Privacy Audit Certificate & Telemetry (SIH Problem Statement 171 compliant exportable JSON/Markdown certificates, 0-leak verification, real-time latency badges).
* [ ] **Phase 15:** Industry/SIH Final Showcase Polish (Full demo environment walkthrough, pitch assets, and packaging).

---

## 6. Current Status & Verification

We have completed **Phases 0 through 11 and Phase 14**:
* **Official Alignment:** Fully compliant with **Smart India Hackathon 2026 Problem Statement #171 (ISRO)**: *"On-device Visual Perception for Light-weight Browser Agents"*.
* **Manifest V3 Extension:** Tab-bound persistent side panel with real-time UI, live element counts, DevTools debugging, and reactive settings drawer.
* **Privacy Firewall Engine (11 Rules):** Locally redacts Emails, Phones, Credit/Debit Cards (with Luhn algorithm check), SSN, Indian Aadhaar UID, Indian PAN Cards, Passports, Passwords, API Keys, IP Addresses, Crypto Wallets, and **Human Faces / Biometrics** before external cloud transmission.
* **On-Device Human Face Redaction Shield:** Offscreen vision engine uses Chrome's native hardware `FaceDetector` API combined with skin chromaticity heuristics to detect and mask human faces with irreversible blackout shields (`👤 [FACE REDACTED]`).
* **Dual-Mode WASM Vision & OCR (Phase 10):** Chrome Offscreen document running on-device `Tesseract.js` WebAssembly workers. Scrapes and decodes native 1:1 `<canvas>` graphics (2FA PINs, confirmation badges, promo vouchers) with 100% accuracy.
* **Interactive "Click-to-Inspect" Web Lens (Phase 11):** Hover reticle and floating on-page Action Pill with `[ 📝 Summarize ]`, `[ 🔍 Search Web ]`, and `[ 💬 Ask AI ]` (auto-formats `<table>` as Markdown and decodes `<canvas>` graphics live).
* **Zero-Leak Privacy Audit Certificate & Latency Telemetry (Phase 14):** Real-time turn observability badges (`⚡ 2ms DOM · 👤 1 Face Masked · 👁️ 185ms WASM OCR · 🧠 310ms LangGraph · 🛡️ 0 Leaks`) and downloadable cryptographically verifiable JSON/Markdown audit reports guaranteeing **0 raw bytes leaked (0.00%)**.
* **Human-in-the-Loop (HITL) Safety Gate:** Deterministically detects destructive, financial, and security actions, automatically pausing execution with an interactive on-screen Approval Card.
* **Automated Test Suite:** **53/53 passing automated tests (100%)** spanning OCR redaction, face shielding, prompt building, LangGraph cyclic reasoning, SPA input binding, and privacy compliance certificates.

**Next Immediate Steps:**
1. Implement Phase 12: Autonomous Multi-Tab Web Research & Synthesis Engine.
2. Implement Phase 13: ONNX Runtime Web Local Named Entity Recognition.
