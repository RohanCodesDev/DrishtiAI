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
      corePath: chrome.runtime.getURL('lib/node_modules/tesseract.js-core'),
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

/**
 * Local Face & Biometric Perception Engine
 * Detects human faces on screenshots / canvas graphics locally and masks/redacts them.
 */
async function detectAndRedactFaces(dataUrl, config) {
  // Check if face_biometric rule is enabled (default is true)
  const isRuleActive = !config || !config.rules || config.rules.face_biometric !== false;
  if (!isRuleActive || !dataUrl) {
    return { dataUrl, faceCount: 0, faces: [] };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const canvas = document.getElementById('vision-canvas') || document.createElement('canvas');
        const naturalW = img.naturalWidth || img.width;
        const naturalH = img.naturalHeight || img.height;
        // Cap max width to 1280px to speed up Tesseract OCR by up to 5x without losing text legibility
        const scale = naturalW > 1280 ? (1280 / naturalW) : 1;
        canvas.width = Math.round(naturalW * scale);
        canvas.height = Math.round(naturalH * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        let detectedFaces = [];

        // 1. Native Hardware-Accelerated Chrome FaceDetector API
        if (typeof window.FaceDetector === 'function') {
          try {
            const detector = new FaceDetector({ maxDetectedFaces: 20, fastMode: true });
            const rawFaces = await detector.detect(canvas);
            if (Array.isArray(rawFaces) && rawFaces.length > 0) {
              detectedFaces = rawFaces.map(f => ({
                x: Math.max(0, Math.round(f.boundingBox.x)),
                y: Math.max(0, Math.round(f.boundingBox.y)),
                width: Math.round(f.boundingBox.width),
                height: Math.round(f.boundingBox.height)
              }));
              console.log(`[DrishtiAI Vision] Native FaceDetector identified ${detectedFaces.length} face(s).`);
            }
          } catch (fdErr) {
            console.warn('[DrishtiAI Vision] Native FaceDetector error, falling back to visual heuristics:', fdErr);
          }
        }

        // 2. Visual Biometric & Skin-Tone Region Heuristics Fallback
        if (detectedFaces.length === 0 && canvas.width > 20 && canvas.height > 20) {
          detectedFaces = detectFacialRegionsHeuristic(ctx, canvas.width, canvas.height);
        }

        // 3. Redact detected face regions on the canvas
        if (detectedFaces.length > 0) {
          console.log(`[DrishtiAI Vision] 🛡️ Redacting ${detectedFaces.length} human face region(s)...`);
          for (const box of detectedFaces) {
            // Apply solid blackout mask
            ctx.fillStyle = '#090d16';
            ctx.fillRect(box.x, box.y, box.width, box.height);

            // Draw high-visibility security border
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            // Overlay Privacy Shield Badge
            const badgeW = Math.min(box.width, 160);
            const badgeH = Math.min(box.height * 0.28, 24);
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(box.x, box.y, badgeW, badgeH);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textBaseline = 'middle';
            ctx.fillText('👤 [FACE REDACTED]', box.x + 6, box.y + badgeH / 2);
          }
        }

        const sanitizedUrl = canvas.toDataURL('image/png');
        resolve({
          dataUrl: sanitizedUrl,
          faceCount: detectedFaces.length,
          faces: detectedFaces
        });
      } catch (err) {
        console.warn('[DrishtiAI Vision] Face detection & redaction exception:', err);
        resolve({ dataUrl, faceCount: 0, faces: [] });
      }
    };
    img.onerror = () => resolve({ dataUrl, faceCount: 0, faces: [] });
    img.src = dataUrl;
  });
}

// Lightweight Visual Heuristic Face / Biometric Region Detector
function detectFacialRegionsHeuristic(ctx, width, height) {
  try {
    const sampleScale = Math.max(1, Math.floor(Math.max(width, height) / 320));
    const sw = Math.floor(width / sampleScale);
    const sh = Math.floor(height / sampleScale);
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const skinMap = new Uint8Array(sw * sh);

    for (let sy = 0; sy < sh; sy++) {
      for (let sx = 0; sx < sw; sx++) {
        const px = sx * sampleScale;
        const py = sy * sampleScale;
        const idx = (py * width + px) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const isSkin = (r > 95 && g > 40 && b > 20 &&
                        (Math.max(r, g, b) - Math.min(r, g, b) > 15) &&
                        Math.abs(r - g) > 15 && r > g && r > b);
        if (isSkin) {
          skinMap[sy * sw + sx] = 1;
        }
      }
    }

    const visited = new Uint8Array(sw * sh);
    const boxes = [];

    for (let sy = 0; sy < sh; sy++) {
      for (let sx = 0; sx < sw; sx++) {
        const sidx = sy * sw + sx;
        if (skinMap[sidx] === 1 && !visited[sidx]) {
          let minX = sx, maxX = sx, minY = sy, maxY = sy;
          let count = 0;
          const queue = [[sx, sy]];
          visited[sidx] = 1;

          while (queue.length > 0) {
            const [cx, cy] = queue.pop();
            count++;
            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;

            const neighbors = [
              [cx + 1, cy], [cx - 1, cy],
              [cx, cy + 1], [cx, cy - 1]
            ];
            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
                const nidx = ny * sw + nx;
                if (skinMap[nidx] === 1 && !visited[nidx]) {
                  visited[nidx] = 1;
                  queue.push([nx, ny]);
                }
              }
            }
          }

          const bw = (maxX - minX + 1) * sampleScale;
          const bh = (maxY - minY + 1) * sampleScale;
          const aspect = bw / bh;

          if (count > 35 && bw >= 40 && bh >= 45 && aspect >= 0.5 && aspect <= 1.4) {
            boxes.push({
              x: Math.max(0, minX * sampleScale - Math.round(bw * 0.1)),
              y: Math.max(0, minY * sampleScale - Math.round(bh * 0.1)),
              width: Math.min(width, Math.round(bw * 1.2)),
              height: Math.min(height, Math.round(bh * 1.2))
            });
          }
        }
      }
    }

    return boxes.slice(0, 10);
  } catch (e) {
    return [];
  }
}

/**
 * Visual Redaction Overlay
 * Draws solid #090d16 blackout boxes over every sensitive DOM region on the
 * already-loaded canvas. Must be called AFTER face redaction, BEFORE OCR.
 *
 * @param {HTMLCanvasElement} canvas  - the working canvas
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x,y,width,height,label}>} regions - viewport-space rects from content.js
 * @param {number} scale  - canvas scale factor (canvas.width / viewport.width)
 */
function applyVisualRedactionOverlay(canvas, ctx, regions, scale) {
  if (!regions || regions.length === 0) return;

  const BLACKOUT_FILL  = '#090d16';
  const BADGE_BG       = '#dc2626';
  const BADGE_TEXT_CLR = '#ffffff';
  const BORDER_CLR     = '#ef4444';

  console.log(`[DrishtiAI Redaction] 🛡️ Applying visual overlay: ${regions.length} sensitive region(s)...`);

  for (const region of regions) {
    const rx = Math.round(region.x * scale);
    const ry = Math.round(region.y * scale);
    const rw = Math.round(region.width  * scale);
    const rh = Math.round(region.height * scale);

    // Guard: skip if rect would be off-canvas
    if (rx >= canvas.width || ry >= canvas.height || rw < 1 || rh < 1) continue;

    console.log(`[DrishtiAI Redaction]   Region [${region.label}] @ canvas (${rx}, ${ry}, ${rw}×${rh})`);

    // Solid blackout fill
    ctx.fillStyle = BLACKOUT_FILL;
    ctx.fillRect(rx, ry, rw, rh);

    // Security border
    ctx.strokeStyle = BORDER_CLR;
    ctx.lineWidth   = Math.max(2, Math.round(2 * scale));
    ctx.strokeRect(rx, ry, rw, rh);

    // Label badge (top-left corner)
    const badgeH = Math.max(16, Math.round(20 * scale));
    const badgeW = Math.min(rw, Math.round(140 * scale));
    ctx.fillStyle = BADGE_BG;
    ctx.fillRect(rx, ry, badgeW, badgeH);

    const fontSize = Math.max(9, Math.round(11 * scale));
    ctx.fillStyle    = BADGE_TEXT_CLR;
    ctx.font         = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textBaseline = 'middle';
    const labelMap   = {
      password_input:    '🔒 [PASSWORD]',
      sensitive_input:   '🔒 [SENSITIVE INPUT]',
      biometric_element: '👤 [BIOMETRIC]',
      sensitive_canvas:  '🎨 [REDACTED CANVAS]'
    };
    const badgeLabel = labelMap[region.label] || `🔒 [${(region.label || 'REDACTED').toUpperCase()}]`;
    ctx.fillText(badgeLabel, rx + Math.round(5 * scale), ry + badgeH / 2);
  }
}

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

          // Step 1: Detect and redact human faces from screenshot before OCR/perception
          const faceRedactionResult = await detectAndRedactFaces(message.dataUrl, message.config);
          let totalFacesRedacted = faceRedactionResult.faceCount;

          // Step 2: Apply Visual Redaction Overlay — blackout sensitive DOM regions (passwords,
          // OTP, CVV, biometric badges) on the canvas BEFORE OCR or ViT inference runs.
          let processedDataUrl = faceRedactionResult.dataUrl;
          const sensitiveRegions = Array.isArray(message.sensitiveRegions) ? message.sensitiveRegions : [];
          if (sensitiveRegions.length > 0) {
            processedDataUrl = await new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                try {
                  const oc = document.getElementById('vision-canvas') || document.createElement('canvas');
                  // Reuse same scale logic as detectAndRedactFaces (cap at 1280px wide)
                  const naturalW = img.naturalWidth || img.width;
                  const naturalH = img.naturalHeight || img.height;
                  const scale    = naturalW > 1280 ? (1280 / naturalW) : 1;
                  oc.width  = Math.round(naturalW * scale);
                  oc.height = Math.round(naturalH * scale);
                  const oc_ctx = oc.getContext('2d');
                  oc_ctx.drawImage(img, 0, 0, oc.width, oc.height);
                  applyVisualRedactionOverlay(oc, oc_ctx, sensitiveRegions, scale);
                  resolve(oc.toDataURL('image/png'));
                } catch (overlayErr) {
                  console.warn('[DrishtiAI Redaction] Visual overlay error (non-fatal):', overlayErr);
                  resolve(processedDataUrl); // Fallback to face-redacted image
                }
              };
              img.onerror = () => resolve(processedDataUrl);
              img.src = processedDataUrl;
            });
          }

          const w = await getWorker();
          console.log('DrishtiAI: Running OCR recognition on sanitized viewport screenshot...');
          const { data } = await w.recognize(processedDataUrl);
          
          let rawText = (data && data.text) ? data.text : '';

          // Also run high-resolution direct graphic OCR on any on-screen canvas elements
          if (Array.isArray(message.canvases) && message.canvases.length > 0) {
            console.log(`DrishtiAI: Decoding ${message.canvases.length} on-screen canvas graphic(s)...`);
            for (const c of message.canvases) {
              if (c.dataUrl) {
                try {
                  const cFaceResult = await detectAndRedactFaces(c.dataUrl, message.config);
                  totalFacesRedacted += cFaceResult.faceCount;
                  const canvasRes = await w.recognize(cFaceResult.dataUrl);
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
          } else {
            console.warn('DrishtiAI: Privacy Firewall not available in offscreen document! Text unredacted.');
          }

          if (totalFacesRedacted > 0) {
            if (!piiTypes.includes('face_biometric')) {
              piiTypes.push('face_biometric');
            }
            sanitizedText += `\n\n[BIOMETRIC PRIVACY: ${totalFacesRedacted} Human Face(s) Detected & Redacted Locally]`;
          }

          console.log(`DrishtiAI: OCR & Vision Firewall completed. PII Types: [${piiTypes.join(', ')}], Faces Redacted: ${totalFacesRedacted}`);

          // Step 3: Run ViT Model to get object bounding boxes on redacted image
          let visualBoundingBoxes = [];
          if (typeof window.LocalVisionEngine !== 'undefined') {
            try {
              visualBoundingBoxes = await window.LocalVisionEngine.detectVisualElements(processedDataUrl);
            } catch (vErr) {
              console.warn('DrishtiAI: Local ViT Vision Engine failed:', vErr);
            }
          }

          sendResponse({
            success: true,
            text: sanitizedText,
            confidence: data?.confidence || 0,
            rawLength: rawText.length,
            piiTypes: piiTypes,
            piiCount: piiTypes.length,
            facesRedacted: totalFacesRedacted,
            visualBoundingBoxes: visualBoundingBoxes
          });
        } catch (err) {
          const errorMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown OCR Error';
          console.error('DrishtiAI: OCR processing failed:', errorMsg);
          sendResponse({ success: false, error: errorMsg });
        }
      })();
      return true; // Keep channel open for async response
    }

    // Direct single canvas OCR for Web Lens
    if (message.type === 'RUN_CANVAS_OCR_DIRECT') {
      (async () => {
        try {
          if (!message.dataUrl) {
            sendResponse({ success: false, error: 'NO_DATA_URL' });
            return;
          }
          const w = await getWorker();
          const faceResult = await detectAndRedactFaces(message.dataUrl, message.config);
          const canvasRes = await w.recognize(faceResult.dataUrl);
          let rawText = (canvasRes?.data?.text || '').trim();
          let sanitizedText = rawText;

          if (typeof window.__DrishtiFirewall !== 'undefined' && window.__DrishtiFirewall.processPII) {
            const redacted = window.__DrishtiFirewall.processPII(rawText, message.config);
            sanitizedText = (redacted && redacted.redactedText !== undefined) ? redacted.redactedText : (redacted?.text || rawText);
          }

          sendResponse({
            success: true,
            text: sanitizedText,
            facesRedacted: faceResult.faceCount
          });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }
    
    console.warn('DrishtiAI: Unknown message type received in offscreen document:', message.type);
    sendResponse({ success: false, error: 'UNKNOWN_MESSAGE_TYPE' });
    return false;
  }
});
