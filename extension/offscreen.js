// This offscreen document runs Tesseract OCR locally without blocking the main UI thread.

let worker = null;

async function getWorker() {
  if (!worker) {
    console.log('Initializing Tesseract OCR worker...');
    worker = await Tesseract.createWorker('eng', 1, {
      workerPath: chrome.runtime.getURL('lib/node_modules/tesseract.js/dist/worker.min.js'),
      corePath: chrome.runtime.getURL('lib/node_modules/tesseract.js-core/tesseract-core.wasm.js'),
      langPath: chrome.runtime.getURL('lib/'),
      logger: m => console.log('OCR Progress:', m.status, Math.round(m.progress * 100) + '%')
    });
    console.log('Tesseract OCR worker initialized.');
  }
  return worker;
}

// Pre-warm OCR worker immediately
getWorker().catch(e => console.warn('Worker pre-warm error:', e));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.target === 'offscreen') {
    if (message.type === 'PING') {
      sendResponse({ success: true, message: 'Offscreen document is active and ready.' });
      return false; // synchronous response
    }
    
    if (message.type === 'RUN_OCR') {
      (async () => {
        try {
          const w = await getWorker();
          console.log('Running OCR on screenshot...');
          const { data } = await w.recognize(message.dataUrl);
          
          let sanitizedText = data.text;
          
          // Apply Privacy Firewall
          if (typeof window.__DrishtiFirewall !== 'undefined' && window.__DrishtiFirewall.processPII) {
            const redacted = window.__DrishtiFirewall.processPII(data.text);
            sanitizedText = redacted.text;
            console.log('OCR Firewall Redacted Items:', redacted.flaggedCount);
          } else {
            console.warn('Privacy Firewall not found in offscreen document! OCR text not redacted.');
          }

          sendResponse({ success: true, text: sanitizedText, rawLength: data.text.length });
        } catch (err) {
          console.error('OCR failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // async response
    }
    
    console.warn('Unknown message type received in offscreen document:', message.type);
    sendResponse(false);
    return false;
  }
});
