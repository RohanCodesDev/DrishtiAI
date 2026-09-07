# 🧠 DrishtiAI Agent Orchestration & Token Optimization

This document details the cognitive planning layer of **DrishtiAI**, explaining how the **LangGraph.js** cyclic state machine operates, how it enforces non-LLM safety guardrails, and how **Actionable Input Slicing** solves the token bloat problem on modern web pages.

---

## 1. The Cyclic LangGraph.js State Machine

Traditional linear agents invoke an LLM once and execute a sequence of actions blindly. However, modern dynamic web pages change constantly after clicks or typing.

DrishtiAI implements a stateful cyclic architecture defined in [`backend/agent/graph.js`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/backend/agent/graph.js) using **`@langchain/langgraph`**:

```
           ┌──────────────────────┐
           │     ObserveNode      │  ← Ingests clean DOM & OCR, applies tree compression
           └──────────┬───────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │      ReasonNode      │  ← Emits candidate actions JSON via ChatGroq
           └──────────┬───────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │     ValidateNode     │  ← Level 1 (Zod) + Level 2 (Deterministic Safety)
           └──────────┬───────────┘
                      │
       ┌──────────────┴──────────────┐
       ▼                             ▼
[Action Verified]            [Safety Breach / Hallucination]
  → Dispatch to Browser        → Request Self-Correction / Loop Halt
```

### State Annotation Schema ([`backend/agent/state.js`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/backend/agent/state.js))
The state passed between graph nodes tracks:
* `objective`: User's task instruction.
* `url` / `title` / `elementCount`: Page metadata.
* `rawDom` & `compressedDom`: Sanitized DOM snapshots.
* `visualContext`: Offscreen WASM OCR text extracted from visible `<canvas>` graphics.
* `actionHistory`: Log of previously executed actions with execution results (`SUCCESS` / `FAILED`).
* `loopCount`: Monotonically increasing turn counter (capped at 10).
* `plannedActions` & `validatedActions`: Candidate and verified action lists.

---

## 2. The Token Bloat Problem & Actionable Input Slicing

### The Challenge with Modern Web Pages
Modern websites contain massive DOM trees. For example, a single Google Search results page contains **over 600 DOM elements**. 

If the entire recursive DOM hierarchy is converted to JSON, the serialized prompt exceeds **14,500 tokens**. When using high-speed models on Groq's on-demand tier (which have an **8,000 Tokens Per Minute (TPM)** rate limit), the API immediately rejects the payload with:
```
413 Request too large on tokens per minute (TPM): Limit 8000, Requested 14752
```

### The Solution: `sliceActionableElements()`
In [`backend/agent/prompts.js`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/backend/agent/prompts.js), DrishtiAI applies **Actionable Input Slicing** whenever a page exceeds 60 elements:

1. **Noise Elimination:** Discards empty layout containers (`<div>`, `<span>`, `section`) that contain no semantic significance.
2. **Intent-Driven Scoring:** Scores elements by keyword relevance to the user's objective:
   ```javascript
   // Boost candidates matching keywords in the user's goal
   for (const word of objectiveWords) {
     if (lowerText.includes(word)) score += 10;
     if (lowerHref.includes(word)) score += 8;
   }
   ```
3. **Interactive Prioritization:** High priority is given to form inputs (`<input>`, `<textarea>`, `<select>`), buttons, and external search result links. Utility navigation links ("Privacy", "Terms", "Settings") are down-ranked.
4. **Hard Budget Cap:** Retains only the **top 35 candidates**, cutting prompt size from **14,752 tokens down to ~1,200 tokens (an 85%+ reduction)**.

---

## 3. Google Search & Tracking URL Unwrapping

Search engines wrap organic links inside bloated redirect and telemetry URLs (often 300–500 characters each):
```
https://www.google.com/url?sa=t&source=web&rct=j&url=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FAlien_(film)&ved=2ahUKEwj...
```

DrishtiAI includes [`cleanHref()`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/backend/agent/prompts.js#L102-L125) which unwraps destination parameters:
```javascript
// Automatically extracts true destination URL
cleanHref(urlStr); 
// Returns: "https://en.wikipedia.org/wiki/Alien_(film)"
```
This saves thousands of characters and allows the LLM to immediately identify the target domain.

---

## 4. Level-2 Deterministic Safety Validation Layer

LLMs frequently hallucinate element IDs or generate unsafe action types. DrishtiAI enforces a **non-LLM deterministic validation layer** in [`backend/agent/actions.js`](file:///Users/raunakmanna/Documents/Programming/SIH/DrishtiAI/backend/agent/actions.js):

1. **Action Vocabulary Whitelist:** Restricts actions to:
   `CLICK` | `TYPE` | `KEYPRESS` | `SCROLL` | `WAIT` | `NAVIGATE` | `NEW_TAB` | `REPLY` | `DONE`
2. **DOM Target Existence Verification:**  
   Every `target_id` (e.g. `element_45`) is verified against the original DOM snapshot before approval.
3. **Malicious Protocol Blocking:**  
   `NAVIGATE` actions containing `javascript:`, `data:`, or `vbscript:` schemes are blocked immediately.
4. **Automatic Search Query Resolution:**  
   If the agent emits `NAVIGATE` with a plain text query (e.g., `alien movie`), the validator automatically transforms it into a safe, direct Google Search URL (`https://www.google.com/search?q=alien+movie`).
5. **Safety Loop & Batch Caps:**  
   Enforces a strict cap of **10 maximum loops** and **10 actions per batch** to prevent infinite execution loops.

---

## 5. Intelligent Rate-Limit Cool-Down & Emergency Compaction

To ensure robust operation when interacting with cloud inference providers:

* **Automatic Cool-Down Parser:** When Groq returns a rate-limit message such as `"Please try again in 3.5s"`, DrishtiAI parses the exact wait time and pauses execution before retrying:
  ```javascript
  const waitMatch = err.message && err.message.match(/try again in ([\d\.]+)s/i);
  if (waitMatch) {
    const waitMs = Math.ceil(parseFloat(waitMatch[1]) * 1000);
    await new Promise(r => setTimeout(r, waitMs));
  }
  ```
* **Emergency Compaction Fallback:** If all available API keys encounter rate limits, DrishtiAI triggers an emergency ultra-compaction pass (30 elements, 300 characters of OCR context, 2-second cooldown), guaranteeing the prompt stays under 1,000 tokens.
