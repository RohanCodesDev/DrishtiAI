# 🏛️ DrishtiAI System Architecture

This document details the architectural design, cyclic state machines, data flow diagrams, sequence models, and entity models of **DrishtiAI**.

---

## 1. High-Level Architecture

DrishtiAI decouples **perception & privacy protection** from **planning & cognitive reasoning**:

1. **Client-Side Perception Layer (Chrome Manifest V3 Extension):**  
   Executes 100% locally in the browser. It parses the DOM, applies an 11-rule PII firewall, blackouts human faces in canvas buffers, and decodes graphical text via local WebAssembly OCR. No raw pixels, passwords, or credentials ever leave the device.
2. **Cognitive Orchestration Layer (Node.js + LangGraph.js Backend):**  
   Receives strictly sanitized context. It runs a stateful cyclic state machine (`Observe` $\to$ `Reason` $\to$ `Validate`), slices large DOM trees into actionable candidates, and emits structured JSON action plans.
3. **Execution & Guardrail Layer (Client In-Page Runner):**  
   Receives validated actions, checks against an in-browser **Human-in-the-Loop (HITL)** risk gate, and dispatches native synthetic events using prototype property descriptors.

```mermaid
graph TB
    subgraph Client["1. CLIENT-SIDE EXTENSION (Chrome MV3 - On-Device)"]
        Page[Target Webpage] --> DOM[content.js: Semantic DOM Extractor]
        DOM --> FW[11-Rule Privacy Firewall & Luhn Check]
        Page --> Canvas[offscreen.js: WASM OCR Worker]
        Canvas --> Face[FaceDetector API: Irreversible Blackout]
        Face --> WASM[Tesseract.js WASM OCR Core]
        FW --> CleanData[Sanitized Context: 0 Bytes PII]
        WASM --> CleanData
        UI[Side Panel UI & Settings] --> CleanData
    end

    subgraph Backend["2. BACKEND SERVER (Node.js + LangGraph.js)"]
        CleanData -- "POST /api/analyze" --> Obs[Node 1: OBSERVE - Tree Compression]
        Obs --> Reas[Node 2: REASON - ChatGroq LLM Reasoning]
        Reas --> Val[Node 3: VALIDATE - Non-LLM Safety Validator]
        Val --> Check{Valid Plan?}
        Check -- "Validation Warnings" --> Reas
        Check -- "Approved" --> Actions[Validated Action JSON]
    end

    Actions --> Client
    Client --> HITL{Destructive Action?}
    HITL -- "Yes (Delete/Pay)" --> Amber[Amber Approval Card / Pause]
    Amber -- "User Confirmed" --> Exec[SPA Native Setter & Pointer Dispatch]
    HITL -- "No (Safe Action)" --> Exec
    Exec --> Page
```

---

## 2. Cyclic LangGraph.js State Machine

Traditional linear agent pipelines fail when pages mutate dynamically or when models hallucinate non-existent element IDs. DrishtiAI utilizes **LangGraph.js** to run an iterative cyclic state graph:

```mermaid
graph LR
    Start([User Request]) --> Observe[1. OBSERVE<br/>Compress DOM Tree<br/>Actionable Slicing]
    Observe --> Reason[2. REASON<br/>Fast Structured JSON<br/>via ChatGroq]
    Reason --> Validate[3. VALIDATE<br/>Non-LLM Deterministic Safety<br/>Target ID Check & Caps]
    Validate --> Gate{Valid & Safe?}
    Gate -- "Failed / Hallucinated" --> Reason
    Gate -- "Approved" --> Execute([Emit Action to Browser])
```

### LangGraph Node Responsibilities:
1. **`ObserveNode`**:
   * Ingests sanitized DOM and viewport OCR data.
   * Compresses semantic HTML trees (`compressTree()`).
   * Cuts large pages (> 60 elements) into the top 35 actionable candidates (`sliceActionableElements()`).
   * Unwraps Google redirect telemetry URLs (`cleanHref()`).
2. **`ReasonNode`**:
   * Invokes ChatGroq with a strict system prompt and Zod output schema.
   * Integrates user objective and previous action history.
   * Features automatic rate-limit cool-down backoff and emergency ultra-compaction fallback.
3. **`ValidateNode`**:
   * **Level 1 Check**: Validates Zod conformance against canonical action schemas.
   * **Level 2 Check**: Deterministic safety rules (verifies target element existence in DOM snapshot, blocks `javascript:`/`data:` schemes, enforces 10-step loop cap, and limits batch sizes to $\le 10$).

---

## 3. Data Flow Diagram (DFD Level 1)

```mermaid
graph TD
    A[1. User Submits Goal in Side Panel] --> B[2. Content Script Traverses DOM Tree]
    B --> C[3. 11-Rule Firewall Redacts PII & Cards]
    B --> D[4. Offscreen Worker Detects & Masks Faces]
    D --> E[5. Tesseract WASM Decodes Canvas PINs/Codes]
    C --> F[6. Merge Sanitized DOM + OCR Text]
    E --> F
    F --> G[7. POST /api/analyze to Express Backend]
    G --> H[8. LangGraph Reasons with Model]
    H --> I[9. Deterministic Safety Validator Checks Target IDs]
    I --> J{Destructive Action?}
    J -- Yes --> K[10. Pause Auto-Loop & Show Amber HUD]
    K --> L{User Approved?}
    L -- Yes --> M[11. Dispatch Native SPA Input / Click]
    L -- No --> N[Abort Action Safely]
    J -- No --> M
    M --> O{Task Completed?}
    O -- No --> B
    O -- Yes --> P[12. Generate SHA-256 Privacy Certificate]
```

---

## 4. End-to-End Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Sidebar as Side Panel (sidebar.js)
    participant Content as Content Script (content.js)
    participant Offscreen as Offscreen WASM (offscreen.js)
    participant Backend as LangGraph Backend
    participant LLM as ChatGroq Engine
    participant DOM as Web Page

    User->>Sidebar: Enters task prompt
    Sidebar->>Content: Request Clean DOM (GET_DOM)
    Content->>Content: Run processPII() (Redact Cards/Aadhaar/PAN)
    Content-->>Sidebar: Return Sanitized DOM
    Sidebar->>Offscreen: Request Canvas OCR
    Offscreen->>Offscreen: Mask Faces + Run WASM OCR
    Offscreen-->>Sidebar: Return Sanitized OCR Text
    Sidebar->>Backend: POST /api/analyze { dom, visualContext, history }
    Backend->>Backend: Slicing Engine (Top 35 Candidates, ~1,200 tokens)
    Backend->>LLM: Formatted Prompt
    LLM-->>Backend: Return Action JSON
    Backend->>Backend: Validate Target ID & Action Safety
    Backend-->>Sidebar: 200 OK Validated Actions [TYPE, CLICK]
    Sidebar->>Content: Execute Action Command
    Content->>DOM: setNativeInputValue() & simulateClick()
    DOM-->>Content: DOM Mutated
    Content-->>Sidebar: Success Confirmation
    Sidebar->>User: Display Turn Badge (⚡ 2ms · 🛡️ 0 Leaks)
```

---

## 5. Human-in-the-Loop (HITL) Safety Gate

To prevent unintended irreversible operations, DrishtiAI incorporates an in-browser **Human-in-the-Loop Gate**:

```mermaid
sequenceDiagram
    autonumber
    participant Agent as LangGraph Orchestrator
    participant Content as Content Script Guard
    participant DOM as Target Webpage
    participant Sidebar as Side Panel UI
    actor User

    Agent->>Content: Proposes: CLICK ("Purge Database" / "Pay $500")
    Content->>Content: isHighRiskAction() matches sensitive verb
    Content->>DOM: Highlight element with Amber Glowing Box
    Content-->>Sidebar: Pause Alert (High-Risk Action Detected)
    Sidebar->>User: Render Amber Approval Card in Chat
    alt User clicks [ ✅ Approve ]
        User->>Sidebar: Approve Action
        Sidebar->>Content: Execute Approved Action
        Content->>DOM: Pointer Click Dispatched
    else User clicks [ ❌ Reject ]
        User->>Sidebar: Reject Action
        Sidebar->>Content: Remove Amber Highlight
        Sidebar->>Sidebar: Abort Loop Safely
    end
```

---

## 6. Entity-Relationship Diagram (ERD) & Data Model

```mermaid
erDiagram
    USER_SESSION ||--o{ ACTION_STEP : executes
    USER_SESSION ||--|| FIREWALL_CONFIG : configures
    USER_SESSION ||--|| AUDIT_CERTIFICATE : produces
    PAGE_SNAPSHOT ||--o{ DOM_ELEMENT : contains
    PAGE_SNAPSHOT ||--o{ CANVAS_GRAPHIC : extracts
    ACTION_STEP ||--|| DOM_ELEMENT : targets
    ACTION_STEP ||--o| HITL_APPROVAL_GATE : intercepts
    USER_SESSION ||--o{ PAGE_SNAPSHOT : records_per_turn

    USER_SESSION {
        string session_id PK
        string user_objective
        int current_loop_count
        boolean is_active
    }

    FIREWALL_CONFIG {
        string config_id PK
        string session_id FK
        boolean mask_email
        boolean mask_credit_card
        boolean mask_aadhaar
        boolean mask_pan
        string[] custom_blacklist
        string[] custom_whitelist
    }

    PAGE_SNAPSHOT {
        string snapshot_id PK
        string session_id FK
        string page_url
        string page_title
        int total_nodes
    }

    DOM_ELEMENT {
        string element_id PK
        string snapshot_id FK
        string drishti_id
        string tag_name
        string role
        string sanitized_text
        boolean is_interactive
    }

    CANVAS_GRAPHIC {
        string canvas_id PK
        string snapshot_id FK
        int faces_detected
        boolean face_redacted
        string ocr_sanitized_text
    }

    ACTION_STEP {
        string action_id PK
        string session_id FK
        string action_type
        string target_drishti_id
        string action_value
        boolean is_validated
    }

    HITL_APPROVAL_GATE {
        string approval_id PK
        string action_id FK
        string risk_reason
        string user_decision
    }

    AUDIT_CERTIFICATE {
        string certificate_id PK
        string session_id FK
        int total_sanitized_nodes
        int faces_masked
        int external_leak_bytes
        string sha256_hash
    }
```

---

## 7. Modern SPA Synthetic Event Integration

Modern Single Page Applications built with **React, Vue, and Angular** override default HTML DOM property setters and ignore standard `element.value = "text"` assignments due to virtual DOM diffing.

To ensure reliable form-filling, DrishtiAI interacts with elements through direct **native prototype property descriptors**:

```javascript
// Native setter bypass for React / Angular / Vue virtual DOM state reconciliation
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

  // Dispatch bubbling change & input events to trigger virtual DOM state sync
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
```

For click actions, DrishtiAI simulates a full 5-stage pointer event sequence (`pointerdown` $\to$ `mousedown` $\to$ `focus` $\to$ `pointerup` $\to$ `click`), ensuring compatibility with custom interactive widgets and canvas elements.
