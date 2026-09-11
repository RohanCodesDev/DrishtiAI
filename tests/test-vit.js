const fs = require('fs');
const path = require('path');
const assert = require('assert');

// A basic syntax and initialization test for the ViT script
async function runTests() {
    console.log("Running basic validation for vit-detector.js");
    
    const vitFilePath = path.join(__dirname, '../extension/vision/vit-detector.js');
    assert.ok(fs.existsSync(vitFilePath), "vit-detector.js should exist");
    
    const code = fs.readFileSync(vitFilePath, 'utf8');
    assert.ok(code.includes('import { pipeline, env }'), "Should import Transformers.js pipeline");
    assert.ok(code.includes('LocalVisionEngine'), "Should declare LocalVisionEngine class");
    assert.ok(code.includes('window.LocalVisionEngine'), "Should expose to window for offscreen.js");
    assert.ok(code.includes('yolos-tiny'), "Should use yolos-tiny model");

    console.log("✅ ViT detector syntax and basic structure looks valid.");
}

runTests().catch(console.error);
