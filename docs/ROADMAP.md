# 🗺️ DrishtiAI Master Roadmap & Phased Implementation

This document outlines the phased development roadmap of **DrishtiAI** (Smart India Hackathon 2026 — Problem Statement #171).

---

## 🧭 Milestone Summary

```
[Phase 0-3: Scaffold & MV3] ───────► ✅ COMPLETED
[Phase 4-6: DOM & PII Firewall] ───► ✅ COMPLETED
[Phase 7-9: Backend & LangGraph] ──► ✅ COMPLETED
[Phase 10-11: WASM OCR & Web Lens] ► ✅ COMPLETED
[Phase 14: 0-Leak Audit Reports] ──► ✅ COMPLETED
[Phase 12: Multi-Tab Research] ────► 🟡 IN PROGRESS
[Phase 13: In-Browser ONNX NER] ───► 🟡 IN PROGRESS
[Phase 15: Grand Finale & WebGPU] ─► 🔵 PLANNED
```

---

## 📋 Detailed Phase Breakdown

### Foundation & Manifest V3 Scaffold
* [x] **Phase 0:** Architecture, threat model, and zero-leak privacy specifications defined.
* [x] **Phase 1:** Development environment configured (Node.js, Chromium Developer Mode, npm).
* [x] **Phase 2:** Project structure created (`extension/`, `backend/`, and documentation).
* [x] **Phase 3:** Working Chrome Manifest V3 extension with basic DOM extraction and side panel registration.

### Local Perception & Privacy Firewall
* [x] **Phase 4:** Structured DOM extraction with top-down sequential `data-drishti-id` assignment.
* [x] **Phase 5:** 11-Rule client-side PII detection engine (Email, Phone, Cards, Aadhaar, PAN, SSN, Passports, API Keys, IPs, Crypto).
* [x] **Phase 6:** Mathematical Luhn Mod-10 checksum validation (eliminating false positives on barcodes and tracking numbers).
* [x] **Phase 6.1:** Whitelist token placeholder protection and custom blacklists.

### Backend Orchestration & LangGraph.js
* [x] **Phase 7:** Express.js HTTP API server with `/api/health` and `/api/analyze` endpoints.
* [x] **Phase 8:** Stateful LangGraph.js cyclic state graph (`Observe` $\to$ `Reason` $\to$ `Validate`).
* [x] **Phase 9:** Non-LLM Level-2 Deterministic Safety Validator (verifying DOM IDs, blocking malicious URL protocols, and enforcing safety caps).
* [x] **Phase 9.1:** Modern SPA synthetic event hooks (`Object.getOwnPropertyDescriptor` prototype setters for React/Vue/Angular).
* [x] **Phase 9.2:** **Actionable Input Slicing Engine** (`sliceActionableElements` & `cleanHref`), compressing 600+ element search result pages from 14,752 tokens to ~1,200 tokens to fit Groq 8,000 TPM limits.

### Advanced Local Vision & Visual Perception
* [x] **Phase 10:** Chrome Manifest V3 Offscreen Document running sandboxed `Tesseract.js` WebAssembly for on-device OCR.
* [x] **Phase 10.1:** Dual-mode Canvas vision (extracting and decoding dynamic 1:1 `<canvas>` 2FA codes and vouchers).
* [x] **Phase 10.2:** Hardware-accelerated `FaceDetector` API with YCbCr skin-chromaticity fallback, permanently overwriting face pixels with solid `#090d16` blackout boxes.
* [x] **Phase 11:** Interactive "Click-to-Inspect" Web Lens (floating glassmorphic Action Pill with instant summarize, web search, table markdown converter, and live canvas OCR).

### Compliance & Telemetry
* [x] **Phase 14:** Cryptographic Zero-Leak Privacy Audit Certificates (downloadable JSON and Markdown compliance reports signed with SHA-256 hashes, certifying 0 bytes of sensitive data leaked).
* [x] **Phase 14.1:** Real-time turn telemetry badges (`⚡ 2ms DOM · 👤 1 Face Masked · 👁️ 185ms WASM OCR · 🧠 310ms LangGraph · 🛡️ 0 Leaks`).

---

## 🚀 Active Development & Next Milestones

### 🟡 Phase 12: Autonomous Multi-Tab Web Research & Synthesis (Current Focus)
* **Goal:** Enable the agent to open and manage multiple browser tabs concurrently to cross-reference facts and synthesize findings into unified markdown comparison tables.
* **Key Tasks:**
  * Implement `tab_id` binding and background tab state pools in `background.js`.
  * Add multi-tab action primitives (`SWITCH_TAB`, `CLOSE_TAB`, `SCRAPE_TAB`).
  * Add synthesis prompt to cross-compile tabular data from 3+ sources.

### 🟡 Phase 13: In-Browser Named Entity Recognition (ONNX Runtime Web)
* **Goal:** Detect context-dependent sensitive entities (such as human names and personal physical home addresses) completely offline without sending text to an external NER API.
* **Key Tasks:**
  * Integrate `onnxruntime-web` into the offscreen document.
  * Load a quantized, lightweight MiniLM / RoBERTa token classification model (~25MB).
  * Tag and redact unstructured contextual PII before LLM dispatch.

### 🔵 Phase 15: Grand Finale Polish & Fully Offline Local LLM (WebGPU)
* **Goal:** Eliminate cloud LLM dependencies entirely for air-gapped defense or space agency workstations.
* **Key Tasks:**
  * Explore integration with Chrome's built-in `window.ai` / Gemini Nano Prompt API.
  * Benchmark WebGPU-accelerated local SLMs (SmolLM-135M / Qwen2-0.5B via Transformers.js).
  * Package final pitch deck, live interactive demo scenarios, and installer packages.
