// This offscreen document is intended for DOM-heavy or Canvas operations (like ONNX vision inference)
// that cannot be run inside a Manifest V3 Service Worker.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.target === 'offscreen') {
    if (message.type === 'PING') {
      sendResponse({ success: true, message: 'Offscreen document is active and ready.' });
      return false; // synchronous response
    }
    
    // Future handlers for drawing to canvas, running ONNX models, etc. will go here
    
    console.warn('Unknown message type received in offscreen document:', message.type);
    sendResponse(false);
    return false;
  }
});
