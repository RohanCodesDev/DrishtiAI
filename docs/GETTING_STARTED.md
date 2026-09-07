# 🚀 Getting Started with DrishtiAI

Welcome to **DrishtiAI**! This guide walks you through setting up, configuring, and testing the DrishtiAI autonomous browser agent and its local privacy firewall.

---

## 📋 System Prerequisites

Before you begin, ensure you have the following installed on your machine:
* **Node.js**: Version `18.0.0` or higher (Node 20+ recommended).
* **npm**: Version `9.0.0` or higher (comes bundled with Node.js).
* **Chromium-based Browser**: Google Chrome, Brave, Chromium, or Microsoft Edge (with developer mode enabled).
* **Groq Cloud API Key**: Required for fast, low-latency LLM reasoning. You can obtain a free key at [console.groq.com](https://console.groq.com).

---

## 🛠️ Step 1: Backend Setup & Configuration

The backend orchestrates the stateful **LangGraph.js** agent cycle (`Observe` $\to$ `Reason` $\to$ `Validate`).

### 1. Install Backend Dependencies
Open your terminal and navigate to the `backend/` directory:
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Create or edit your `.env` file inside `backend/`:
```bash
cp .env.template .env
```

Open `backend/.env` in your text editor and fill in your Groq API credentials:
```env
# Server Port
PORT=3000

# Primary Groq API Key
GROQ_API_KEY=gsk_your_groq_api_key_here

# (Optional) Fallback Groq API Key for seamless key rotation
GROQ_API_KEY_FALLBACK=gsk_your_secondary_groq_api_key_here

# Reasoning Model
# Available options on Groq: openai/gpt-oss-20b, openai/gpt-oss-120b, qwen/qwen3.6-27b
GROQ_MODEL=openai/gpt-oss-20b
```

> [!TIP]
> **Token Budgeting & Groq Rate Limits:**  
> DrishtiAI includes an intelligent **Actionable Input Slicing Engine** that automatically compresses web pages from 600+ elements down to the top 35 candidates (~1,200 tokens). This ensures the agent runs comfortably within Groq free-tier rate limits (8,000 Tokens Per Minute) without 413 or 429 payload errors.

### 3. Start the Backend Server
Start the Express + LangGraph server:
```bash
npm start
```
You should see:
```
🛡️ DrishtiAI LangGraph Backend running on http://localhost:3000
Model: openai/gpt-oss-20b
Ready to receive sanitized page context on POST /api/analyze
```

Verify the server is healthy by visiting:
[http://localhost:3000/api/health](http://localhost:3000/api/health) in your browser.

---

## 🧩 Step 2: Chrome Extension Installation

The extension handles on-device DOM extraction, the 11-rule PII firewall, biometric face masking, and sandboxed WebAssembly OCR.

1. Open your browser and navigate to the Extensions management page:
   * **Chrome**: `chrome://extensions/`
   * **Brave**: `brave://extensions/`
   * **Edge**: `edge://extensions/`
2. In the top-right corner, enable the **Developer mode** toggle.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `extension/` folder inside your cloned `DrishtiAI` repository:
   ```
   DrishtiAI/extension/
   ```
5. The **DrishtiAI — Privacy-First AI Browser Agent** extension icon will appear in your browser toolbar.
6. Pin the extension icon to your toolbar for easy access.

---

## 🧪 Step 3: Interactive Demo Sandbox & Testing

DrishtiAI includes a pre-built interactive testing sandbox containing mock registration forms, 2FA canvas PINs, human face graphics, and sensitive financial fields.

### 1. Open the Test Page
In Chrome, open the local test sandbox:
```
file:///path/to/DrishtiAI/test.html
```
*(Or simply drag and drop `test.html` into a new Chrome tab).*

### 2. Open the DrishtiAI Side Panel
* Click the DrishtiAI icon in your browser toolbar, or right-click anywhere on the page and select **Open DrishtiAI Side Panel**.
* The dark glassmorphic side panel will dock on the right side of your screen.
* Notice the telemetry bar showing the active domain, title, and the number of sanitized DOM elements.

### 3. Test Privacy Redaction in Real-Time
1. In the side panel, click the **Settings / Shield** icon to open the Privacy Firewall drawer.
2. Observe the **11 Active Protection Rules** (Email, Phone, Credit Card, Aadhaar, PAN, SSN, API Keys, Biometrics).
3. Switch to the **DOM Inspector** tab to view the live JSON representation. Notice how card numbers, emails, and passwords on `test.html` are masked as `[CREDIT_CARD_REDACTED]` or `[EMAIL_REDACTED]`.

### 4. Run an Autonomous Agent Workflow
In the side panel chat composer, type an objective and click **Run Agent**:
* **Autonomous Form Filling:**
  ```
  Fill the registration form with dummy data and agree to terms
  ```
* **Web Search & Navigation:**
  ```
  search about alien movie and open the wikipedia page
  ```
* **Canvas Vision / 2FA OCR:**
  ```
  What is the confirmation code in the security graphic?
  ```
* **Web Lens Click-to-Inspect:**
  * Click the **Web Lens** toggle in the side panel header.
  * Hover over any button, table, or canvas on the page.
  * Click the floating Action Pill to instantly summarize or ask questions about that element.

---

## 🔬 Step 4: Running Automated Tests

DrishtiAI includes a comprehensive 28-test integration suite covering tree compression, Zod schemas, deterministic Level-2 safety validation, privacy leak prevention, and live cyclic reasoning.

In your terminal:
```bash
cd backend
npm test
```

Expected output:
```
======================================================
🧪 RUNNING DRISHTI LANGGRAPH INTEGRATION TEST SUITE
======================================================
--- TEST GROUP 1: Tree Compression & Prompt Builders ---
  ✅ PASS: Tree compression retains essential semantic tags and IDs
  ✅ PASS: Prompt builder formats objective, DOM, and action history cleanly
  ...
======================================================
🎉 ALL 28/28 TESTS PASSED SUCCESSFULLY!
======================================================
```

---

## ❓ Troubleshooting & FAQs

### Q: The backend outputs `413 Request too large (Limit 8000, Requested ...)`
* **Fix**: Ensure you have pulled the latest changes in `backend/agent/prompts.js`. The input slicing engine automatically caps elements to the top 35 actionable candidates (~1,200 tokens).

### Q: The agent says `Connection Failed: Is the local backend server running on port 3000?`
* **Fix**: Ensure `node server.js` is running inside `backend/` and listening on port 3000. If port 3000 is occupied, change `PORT=3001` in `backend/.env` and update the fetch URL in `extension/sidebar.js`.

### Q: Changes to `content.js` or `sidebar.js` are not showing up.
* **Fix**: Chrome caches extension scripts. Go to `chrome://extensions/` and click the **Reload (↻)** icon on the DrishtiAI card, then refresh the active webpage.
