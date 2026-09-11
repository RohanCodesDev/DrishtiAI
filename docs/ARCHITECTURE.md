# 🛡️ DrishtiAI — How It All Works
### A Plain-English Guide to the Full System Architecture

> **Who is this for?** Anyone — judges, professors, teammates, or curious people — who wants to understand what DrishtiAI does and how, without needing to know how to code.

---

## 🤔 The Big Problem We're Solving

Imagine you're using your bank's website. You ask an AI assistant to help you fill out a transfer form. To do that, the AI needs to "see" your screen.

**The problem:** Most AI assistants do this by taking a photo of your screen and sending it — passwords, account numbers, your face, everything — to a server somewhere on the internet. That's a huge privacy risk.

**DrishtiAI's solution:** What if the AI could first act like a security guard, cover up all the sensitive parts of your screen *before* the photo ever leaves your laptop? That's exactly what we built.

---

## 🏠 The Simple Analogy

Think of DrishtiAI like a **secure document courier service**:

1. 📄 You have a classified document (your screen/webpage)
2. 🖊️ A security officer (the extension) reads it, **blacks out all secret parts** (passwords, faces, card numbers)
3. ✉️ Only the **redacted, safe version** is sent to headquarters (the AI server)
4. 🧠 Headquarters figures out what to do next and sends back instructions
5. ✅ The security officer back at your desk follows the instructions and takes action

Your real secrets never left the room.

---

## 🗺️ The Full System — 4 Layers

```
┌─────────────────────────────────────────────────────────┐
│                  YOUR COMPUTER (Browser)                 │
│                                                         │
│  ┌───────────────┐    ┌──────────────────────────────┐  │
│  │  The Webpage  │───▶│   LAYER 1: DOM Scanner       │  │
│  │ (Bank / Gmail │    │   Reads all buttons & text   │  │
│  │ / Any site)   │    └──────────┬───────────────────┘  │
│  └───────────────┘               │                       │
│                                  ▼                       │
│                    ┌─────────────────────────┐           │
│                    │  LAYER 2: Privacy Shield │           │
│                    │  Blacks out sensitive    │           │
│                    │  regions on the image   │           │
│                    └──────────┬──────────────┘           │
│                               │                           │
└───────────────────────────────┼───────────────────────────┘
                                │ Only safe, redacted data
                                ▼
┌─────────────────────────────────────────────────────────┐
│                     THE SERVER                           │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  LAYER 3: AI Brain (LangGraph + Groq LLM)        │   │
│  │  Decides what action to take next                │   │
│  └──────────────────┬──────────────────────────────┘   │
└─────────────────────┼────────────────────────────────────┘
                      │ Action instructions sent back
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  YOUR COMPUTER (Browser)                 │
│                                                         │
│  ┌────────────────────────────────────────────────┐    │
│  │  LAYER 4: Action Executor + Safety Gate        │    │
│  │  Clicks buttons, types text — but asks YOU     │    │
│  │  for permission before anything dangerous       │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 Layer 1 — The DOM Scanner (`content.js`)

### What is the DOM?

When you open a webpage, your browser builds a map of every single element on the page — every button, text box, heading, and link. This map is called the **DOM** (Document Object Model). Think of it like a building's floor plan.

### What does the scanner do?

The **content script** reads this floor plan. It finds every clickable button, every text input box, every link — and gives each one a unique ID number (like `drishti-42`). This lets the AI say "click button #42" instead of trying to describe it.

**Example:**
```
Webpage has: [Login Button] [Username Box] [Password Box]
Scanner maps: button#drishti-1, input#drishti-2, input#drishti-3
```

The scanner also collects which elements on screen are **sensitive** right now — specifically:
- Any `password` input boxes
- OTP / PIN / CVV fields  
- Biometric badge areas

It records their exact position on screen (in pixels) so the next layer can black them out.

---

## 🛡️ Layer 2 — The Privacy Shield (3 sub-systems)

This is DrishtiAI's most important innovation. It runs **100% on your device** — no data goes anywhere yet. Think of it as a team of specialists working together.

---

### 🛡️ Sub-system 2A — The PII Firewall (`content.js`)

**PII = Personally Identifiable Information** (your private data)

This is an 11-rule filter that scans all the text on the page and replaces sensitive patterns with safe placeholder text before it's sent anywhere.

| What it finds | What gets replaced with |
|:---|:---|
| Email address (`rohan@gmail.com`) | `[EMAIL_REDACTED]` |
| Phone number (`+91 9876543210`) | `[PHONE_REDACTED]` |
| Credit card (`4111-2222-3333-4444`) | `[CREDIT_CARD_REDACTED]` |
| Aadhaar number (`2345-6789-0123`) | `[AADHAAR_REDACTED]` |
| PAN card (`ABCDE1234F`) | `[PAN_REDACTED]` |
| US Social Security Number | `[SSN_REDACTED]` |
| API/Secret keys (`sk-proj-abc123`) | `[API_KEY_REDACTED]` |
| Internal IP address | `[IP_REDACTED]` |
| Crypto wallet address | `[WALLET_REDACTED]` |
| Passport number | `[PASSPORT_REDACTED]` |
| Face biometric data | Pixels destroyed on canvas |

**Smart Credit Card Check (Luhn Algorithm):** 
Before flagging a number as a credit card, the system runs a mathematical formula (Luhn's Mod-10 check) to verify it's actually a real card number — not a product barcode or shipping tracking number that just happens to be 16 digits long. This prevents false alarms.

**Custom Rules:** Users can add their own blacklist words ("Project Aegis", "Internal Salary Data") or whitelist words ("support@drishti.ai" should NOT be redacted even though it looks like an email).

---

### 👁️ Sub-system 2B — The Visual Redaction Overlay (`offscreen.js`)

This is new and unique. The DOM scanner told us *where* the password boxes are on screen. Now, before we take the screenshot, we paint over those locations with solid **`#090d16` black boxes** directly on the image canvas.

**Why?** Because even if the text in a password box is hidden by the browser's `●●●●●●` dots, a raw screenshot might reveal the box's visual context. We don't take any chances.

**What gets blacked out:**
- `🔒 [PASSWORD]` — every password input field
- `🔒 [SENSITIVE INPUT]` — OTP, CVV, PIN, card number fields
- `👤 [BIOMETRIC]` — face ID badge elements
- `🎨 [REDACTED CANVAS]` — any canvas marked as sensitive

Each blackout box gets a tiny red label badge so you can audit exactly what was covered.

---

### 👤 Sub-system 2C — Face Redaction (`offscreen.js`)

After the domain-sensitive regions are blacked out, the system runs face detection on the screenshot using **two methods:**

1. **Chrome's Hardware FaceDetector API** — uses your device's camera acceleration chip to find human faces in milliseconds (≈18ms)
2. **Skin-tone Heuristic Fallback** — if the hardware API isn't available, a custom pixel-scanning algorithm checks for skin-tone colored regions in the right proportions for a human face

Any detected face is permanently destroyed with a solid blackout fill + a `👤 [FACE REDACTED]` badge.

---

### 🔤 Sub-system 2D — Canvas OCR (`offscreen.js` with Tesseract.js)

Here's an interesting challenge: some webpages show important information as *images*, not as text. For example:
- A 2FA security code drawn on a `<canvas>` element
- A promotional voucher image with a discount code
- A face biometric ID badge

The DOM scanner can't read these because they're pixels, not text. So we run a local **OCR (Optical Character Recognition)** engine — Tesseract.js, compiled to run entirely in your browser using WebAssembly. It reads the image and converts it to text, then the PII Firewall cleans that text too.

**This runs inside an isolated "Offscreen Document"** — a special sandbox that MV3 Chrome extensions use for heavy computation that would slow down the webpage if run directly.

---

### 🤖 Sub-system 2E — Local Vision Transformer (`vision/vit-detector.js`)

**NEW.** After faces are blacked out, we optionally run a local AI vision model (`Xenova/yolos-tiny`) using WebAssembly directly in your browser. This model looks at the redacted screenshot and identifies UI elements — "there's a button here, an input field there, an avatar image in the top left."

This produces a **Visual Perception Tree** — a structured list of bounding boxes alongside the DOM tree — giving the AI brain a much richer understanding of the screen layout.

**Privacy guarantee:** The model runs 100% locally, no image ever leaves the browser for this step.

---

## 🧠 Layer 3 — The AI Brain (Backend Server)

Once the fully sanitized, redacted context is ready, it's sent over the network to the backend server. At this point, **it contains zero bytes of raw sensitive data.**

The backend runs a **stateful reasoning loop** using LangGraph.js — think of it like a three-person committee that must agree before any decision is made:

```
┌──────────────────────────────────────────────────────┐
│                  THE COMMITTEE                        │
│                                                       │
│  1. OBSERVE        2. REASON         3. VALIDATE      │
│  "What's on       "What should      "Is this plan     │
│   the screen?"     we do next?"      actually safe?"  │
│                                                       │
│   Compress DOM  →  Ask Groq LLM  →  Safety Check     │
│   (14k→1.2k)       for a plan       (non-AI rules)   │
└──────────────────────────────────────────────────────┘
```

### 🔎 Node 1: OBSERVE — The Compressor

**Problem:** A typical webpage might have 600+ elements. Sending all of them to an AI model would be expensive and slow.

**Solution:** The Observe node compresses and scores every element. It figures out which 35 elements are most likely relevant to the user's goal and only sends those. This reduces the prompt from ~14,000 tokens down to ~1,200 tokens — an **85% reduction** that fits within Groq's API limits.

Example of scoring priority (higher = more likely to be included):
- `button[type="submit"]` with text "Pay Now" → very high priority
- `<div>` with decorative lorem ipsum → very low priority

### 💡 Node 2: REASON — The LLM Decision Maker

This node sends the compressed context + user's goal to **Groq's LLM** (fast cloud AI). The model returns a structured JSON action plan — not free-form text, but a precise, machine-readable list of actions.

Example response:
```json
{
  "actions": [
    { "action": "TYPE", "target_id": "drishti-42", "value": "John Doe" },
    { "action": "CLICK", "target_id": "drishti-87" }
  ]
}
```

If the API is busy or the payload is too large, the system automatically waits and retries with the next API key.

### ✅ Node 3: VALIDATE — The Safety Inspector

This is a **non-AI, purely rule-based** checker. It doesn't use any language model — it just checks facts:

- Does `drishti-42` actually exist in the DOM snapshot we have? (Prevents hallucinations — AI making up element IDs that don't exist)
- Is the URL being navigated to safe? (Blocks `javascript:` and `data:` schemes)
- Has the agent been looping for too long? (Enforces a 10-step cap to prevent infinite loops)
- Is the batch size reasonable? (Maximum 10 actions at once)

If something fails, the action is blocked or sent back to Reason for correction.

---

## 🚦 Layer 4 — The Executor + Safety Gate (`content.js`)

### The Human-in-the-Loop (HITL) Gate

When the validated action plan comes back to the browser, not all actions are executed immediately. First, they pass through a **risk detector**:

```
Action: "CLICK the 'Delete All Records' button"
         ↓
Does it match dangerous keywords?
("delete", "purge", "pay", "transfer", "reset", "remove", "destroy")
         ↓ Yes
⚠️  PAUSE! Show Amber Approval Card to user
"The AI wants to click 'Delete All Records'. Do you approve?"
   [✅ Yes, proceed]  [❌ Cancel]
```

If the action is safe (like typing a name into a form), it runs automatically. If it's risky, you get to decide.

### Smart Clicking — React/Vue/Angular Support

Modern websites (like Gmail, Facebook, or any banking app) are built with JavaScript frameworks that use a **virtual DOM**. These frameworks won't respond to simple `element.click()` commands — they need proper browser events.

DrishtiAI simulates the full sequence of events a real human would trigger:

```
User physically clicks a button:  
pointerdown → mousedown → focus → pointerup → mouseup → click

DrishtiAI does exactly the same, programmatically,
so any React/Vue/Angular widget thinks a real human clicked it.
```

For typing text into inputs, DrishtiAI uses a technique called **native prototype descriptor bypass** — which tricks the framework into thinking the user manually typed the text, triggering all the state update logic that the app is expecting.

---

## 📊 The Interaction Loop — A Full Example

Let's trace exactly what happens when you say: **"Fill out the contact form"**

```
1. You type "Fill out the contact form" in the DrishtiAI side panel

2. CONTENT SCRIPT scans the page → finds fname, lname, email, phone, submit button
   Marks any password fields, OTP boxes (none here, it's a contact form)

3. OFFSCREEN WORKER takes a screenshot
   → Blacks out any sensitive regions (none found)
   → Face detection runs → no faces found
   → OCR runs on any canvas images → none here
   → ViT model maps layout → finds 6 form elements

4. Clean, sanitized payload is sent to backend:
   { url: "test.html", elements: [...6 form fields...], userTask: "Fill out form" }

5. OBSERVE NODE compresses → all 6 elements are kept (they're all relevant)

6. REASON NODE asks Groq:
   "Page has: first name input (drishti-1), last name input (drishti-2)...
    Task: Fill out the contact form"
   Groq returns: TYPE "John" into drishti-1, TYPE "Doe" into drishti-2...

7. VALIDATE NODE: All target IDs exist ✅, no dangerous keywords ✅

8. Action plan returned to extension: [TYPE, TYPE, TYPE, CLICK]

9. HITL CHECK: Is "submit" dangerous? No → proceed automatically

10. EXECUTOR: Types "John" → "Doe" → "john@demo.com" → clicks Submit
    (Using native prototype bypass for full framework compatibility)

11. Side panel shows: "✅ Form filled and submitted · 🛡️ 0 Leaks · ⚡ 2.1s"
```

---

## 🔐 The Privacy Certificate

After each session, DrishtiAI generates a downloadable **Zero-Leak Audit Certificate** — a JSON + Markdown report signed with a SHA-256 cryptographic hash, certifying:

- How many DOM elements were scanned
- How many PII tokens were redacted (emails, cards, etc.)
- How many faces were blacked out
- How many bytes of raw sensitive data reached the server: **0**

This certificate can be shown to regulators, auditors, or clients as proof of privacy compliance with India's **DPDP Act 2023** and **GDPR**.

---

## 📁 Where Does Each Part Live in the Code?

```
ps-171/
├── extension/                   ← Everything that runs in your browser
│   ├── content.js               ← DOM Scanner + PII Firewall + collectSensitiveRegions()
│   ├── offscreen.js             ← Visual Redaction Overlay + Face Redaction + OCR
│   ├── background.js            ← Coordinator: captures screenshots, routes messages
│   ├── sidebar.js               ← The side panel chat UI you interact with
│   ├── sidebar.html             ← Side panel layout
│   ├── offscreen.html           ← Isolated sandbox for heavy computation
│   ├── manifest.json            ← Extension configuration (Chrome MV3)
│   └── vision/
│       └── vit-detector.js      ← Local AI Vision Transformer (yolos-tiny)
│
├── backend/                     ← The server (runs on your laptop, not cloud)
│   ├── server.js                ← Express HTTP server, receives sanitized data
│   └── agent/
│       ├── graph.js             ← LangGraph: Observe → Reason → Validate cycle
│       ├── prompts.js           ← AI prompt templates + DOM compression logic
│       ├── actions.js           ← Action schemas (TYPE, CLICK, NAVIGATE, etc.)
│       └── state.js             ← LangGraph state definition
│
├── test.html                    ← Interactive demo sandbox to test everything
└── docs/                        ← All documentation files
```

---

## 🌐 Complete Feature Map

| Feature | Where it runs | Sends data to server? |
|:---|:---|:---|
| DOM reading & element scanning | Browser (content.js) | ❌ No |
| 11-rule PII text redaction | Browser (content.js) | ❌ No |
| Password box blackout overlay | Browser (offscreen.js) | ❌ No |
| Face detection & blackout | Browser (offscreen.js) | ❌ No |
| Canvas OCR (Tesseract WASM) | Browser (offscreen.js) | ❌ No |
| Local Vision Transformer (ViT) | Browser (vit-detector.js) | ❌ No |
| AI reasoning (Groq LLM) | Backend server | ✅ Yes (sanitized only) |
| Action validation (safety check) | Backend server | ✅ Yes (no PII) |
| HITL approval gate | Browser (content.js) | ❌ No |
| Native click & type events | Browser (content.js) | ❌ No |
| Audit certificate generation | Browser (sidebar.js) | ❌ No |
| Web Lens click-to-inspect | Browser (content.js) | ❌ No |

---

## ⚡ Performance Numbers

| Operation | Time | Location |
|:---|:---|:---|
| PII Firewall (11 rules) | < 2 ms | Browser |
| Face Detection (hardware API) | ~18 ms | Browser |
| Visual Redaction Overlay | < 5 ms | Browser |
| Canvas OCR (Tesseract WASM) | ~180 ms | Browser |
| ViT layout perception | ~800–1500 ms (first run, model loads) | Browser |
| Groq LLM reasoning | ~600–1200 ms | Server |
| Total end-to-end (typical) | ~1–2 seconds | Both |

---

## 🎯 Why This Matters for SIH PS-171

The Smart India Hackathon problem asked for: *"On-device Visual Perception for Lightweight Browser Agents"*

DrishtiAI directly addresses every requirement:

1. ✅ **On-device perception** — All visual processing (OCR, face detection, ViT, redaction) runs locally in the browser
2. ✅ **Lightweight** — Quantized ONNX models, 85% token compression, < 2ms firewall
3. ✅ **Browser agent** — Full autonomous agent loop with real click/type/navigate actions
4. ✅ **Privacy** — Zero raw sensitive data transmitted to server, cryptographic audit trail
5. ✅ **Human-in-the-loop** — Mandatory approval gate for destructive/irreversible actions
6. ✅ **Legal compliance** — DPDP Act 2023, GDPR, and enterprise data governance ready
