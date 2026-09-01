// DrishtiAI Offscreen Vision & OCR Engine
// Runs Tesseract.js WebAssembly workers locally without blocking the extension UI or webpage thread.

let worker = null;
let workerInitPromise = null;

async function getWorker() {
  if (worker) return worker;
  if (workerInitPromise) return workerInitPromise;

  workerInitPromise = (async () => {
    console.log('DrishtiAI: Initializing Tesseract OCR worker...');
    const w = await Tesseract.createWorker('eng', 1, {
      workerPath: chrome.runtime.getURL('lib/node_modules/tesseract.js/dist/worker.min.js'),
      corePath: chrome.runtime.getURL('lib/node_modules/tesseract.js/dist'),
      langPath: chrome.runtime.getURL('lib'),
      workerBlobURL: false, // CRITICAL FOR CHROME EXTENSIONS / MV3: prevents blocked blob: worker CSP violations
      gzip: true,
      logger: (m) => {
        const pct = Math.round((m.progress || 0) * 100);
        console.log(`[DrishtiAI Offscreen] ⏳ ${m.status || 'loading'} (${pct}%)`);
      }
    });
    worker = w;
    console.log('DrishtiAI: Tesseract OCR worker initialized successfully.');
    return worker;
  })();

  try {
    return await workerInitPromise;
  } catch (err) {
    workerInitPromise = null;
    console.error('DrishtiAI: Worker initialization error:', err);
    throw err;
  }
}

// Pre-warm OCR worker immediately
getWorker().catch(e => console.warn('DrishtiAI: Worker pre-warm warning:', e));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.target === 'offscreen') {
    if (message.type === 'PING') {
      sendResponse({ success: true, message: 'Offscreen document is active and ready.', workerReady: !!worker });
      return false;
    }
    
    if (message.type === 'RUN_OCR') {
      (async () => {
        try {
          if (!message.dataUrl) {
            sendResponse({ success: false, error: 'NO_IMAGE_DATA_PROVIDED' });
            return;
          }

          const w = await getWorker();
          console.log('DrishtiAI: Running OCR recognition on viewport screenshot...');
          const { data } = await w.recognize(message.dataUrl);
          
          let rawText = (data && data.text) ? data.text : '';

          // Also run high-resolution direct graphic OCR on any on-screen canvas elements
          if (Array.isArray(message.canvases) && message.canvases.length > 0) {
            console.log(`DrishtiAI: Decoding ${message.canvases.length} on-screen canvas graphic(s)...`);
            for (const c of message.canvases) {
              if (c.dataUrl) {
                try {
                  const canvasRes = await w.recognize(c.dataUrl);
                  const cText = (canvasRes?.data?.text || '').trim();
                  if (cText) {
                    console.log(`DrishtiAI: Canvas [${c.id}] decoded text: "${cText}"`);
                    rawText += `\n\n[CANVAS GRAPHIC #${c.id}]:\n${cText}`;
                  }
                } catch (cErr) {
                  console.warn(`DrishtiAI: Canvas [${c.id}] decoding skipped:`, cErr);
                }
              }
            }
          }
          
          // Normalize text: collapse excessive empty newlines while preserving formatting
          rawText = rawText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
          
          let sanitizedText = rawText;
          let piiTypes = [];
          
          // Apply Local Privacy Firewall Redaction
          if (typeof window.__DrishtiFirewall !== 'undefined' && window.__DrishtiFirewall.processPII) {
            const redacted = window.__DrishtiFirewall.processPII(rawText, message.config);
            sanitizedText = (redacted && redacted.redactedText !== undefined) ? redacted.redactedText : (redacted?.text || rawText);
            piiTypes = redacted.piiTypes || [];
            console.log('DrishtiAI: OCR Firewall sanitized text. PII Types detected:', piiTypes);
          } else {
            console.warn('DrishtiAI: Privacy Firewall not available in offscreen document! Text unredacted.');
          }

          sendResponse({
            success: true,
            text: sanitizedText,
            confidence: data?.confidence || 0,
            rawLength: rawText.length,
            piiTypes: piiTypes,
            piiCount: piiTypes.length
          });
        } catch (err) {
          const errorMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown OCR Error';
          console.error('DrishtiAI: OCR processing failed:', errorMsg);
          sendResponse({ success: false, error: errorMsg });
        }
      })();
      return true; // Keep channel open for async response
    }
    
    console.warn('DrishtiAI: Unknown message type received in offscreen document:', message.type);
    sendResponse({ success: false, error: 'UNKNOWN_MESSAGE_TYPE' });
    return false;
  }
});
