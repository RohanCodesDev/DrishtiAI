import { pipeline, env } from '../lib/node_modules/@xenova/transformers/dist/transformers.min.js';

// Configure environment
env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = '../lib/node_modules/@xenova/transformers/dist/'; 

class LocalVisionEngine {
    static instance = null;
    static initialized = false;

    static async init() {
        if (this.initialized) return;
        try {
            console.log("[DrishtiAI Vision] Initializing Local ViT / CV Model (yolos-tiny)...");
            // Object detection pipeline using yolos-tiny
            this.detector = await pipeline('object-detection', 'Xenova/yolos-tiny', {
                quantized: true
            });
            this.initialized = true;
            console.log("[DrishtiAI Vision] Local ViT Model initialized successfully.");
        } catch (err) {
            console.error("[DrishtiAI Vision] Failed to initialize ViT Model:", err);
        }
    }

    static async detectVisualElements(dataUrl) {
        if (!this.initialized) {
            await this.init();
        }
        if (!this.detector) return [];

        try {
            console.log("[DrishtiAI Vision] Running visual perception inference...");
            const results = await this.detector(dataUrl, { threshold: 0.2 });
            
            // Format boxes
            const boxes = results.map(r => ({
                label: r.label,
                score: r.score,
                box: {
                    x: Math.round(r.box.xmin),
                    y: Math.round(r.box.ymin),
                    width: Math.round(r.box.xmax - r.box.xmin),
                    height: Math.round(r.box.ymax - r.box.ymin)
                }
            }));
            
            console.log(`[DrishtiAI Vision] Detected ${boxes.length} visual UI element(s).`);
            return boxes;
        } catch (e) {
            console.error("[DrishtiAI Vision] Inference error:", e);
            return [];
        }
    }
}

// Expose globally for offscreen.js
window.LocalVisionEngine = LocalVisionEngine;

// Pre-warm the model
LocalVisionEngine.init().catch(console.warn);
