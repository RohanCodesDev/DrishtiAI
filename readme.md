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
* [ ] **Phase 6:** Privacy Firewall & Redaction (Masking PII before it can leave the extension).

### Backend & Intelligence
* [ ] **Phase 7:** Backend Server (Express API integration).
* [ ] **Phase 8:** AI / LLM Reasoning (Sending sanitized data to get structured actions).
* [ ] **Phase 9:** Safe Browser Actions (Executing clicks/scrolls with risk validation).

### Advanced Vision & Optimization
* [ ] **Phase 10:** OCR Integration (Reading text from screenshots locally).
* [ ] **Phase 11:** Local Computer Vision (Lightweight models for visual region analysis).
* [ ] **Phase 12:** ONNX + WebGPU (Optimizing inference speed in the browser).
* [ ] **Phase 13:** System Optimization (Caching, Debouncing, Lazy processing).

### SIH Final Polish
* [ ] **Phase 14:** Benchmarking & Evaluation (Proving privacy claims and performance metrics).
* [ ] **Phase 15:** Industry/SIH Polish (Professional UI, Demo Environments, Security Hardening).

---

## 6. Current Status 

We have successfully completed up through **Phase 5**.
* The Git repository is initialized.
* The folder structure is established.
* A working Manifest V3 extension exists in `extension/`, complete with a popup UI and a content script that successfully counts basic DOM elements and flags PII (emails/phones).

**Next step:** Initiate **Phase 6** when ready.
