const express = require('express');
const cors = require('cors');
const { runAgentGraph } = require('./agent/graph');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Enable CORS so the Chrome extension can communicate with the local server
app.use(cors());

// Increase payload limit because DOM JSON can be quite large
app.use(express.json({ limit: '50mb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'DrishtiAI Backend running with LangGraph.js + LangChain.js',
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    framework: 'LangGraph.js'
  });
});

// Main Endpoint: Receive sanitized DOM context from the extension
app.post('/api/analyze', async (req, res) => {
  try {
    const sanitizedData = req.body;

    if (!sanitizedData || !sanitizedData.root) {
      return res.status(400).json({ error: 'Invalid payload: Missing structured DOM.' });
    }

    const timestamp = new Date().toLocaleTimeString();
    console.log(`\n======================================================`);
    console.log(`[DrishtiAI Backend ${timestamp}] 📥 Received Page Context for Analysis`);
    console.log(`  🌐 URL: ${sanitizedData.url}`);
    console.log(`  📑 Title: ${sanitizedData.title}`);
    console.log(`  🧩 Elements: ${sanitizedData.element_count}`);
    console.log(`  🛡️ Firewall Active Rules: ${sanitizedData.firewall_active_rules}`);
    
    if (sanitizedData.visual_context) {
      const summary = sanitizedData.visual_context.replace(/\n+/g, ' ').trim();
      console.log(`  👁️ Visual OCR Text: "${summary.length > 200 ? summary.slice(0, 200) + '...' : summary}"`);
      if (Array.isArray(sanitizedData.canvases) && sanitizedData.canvases.length > 0) {
        console.log(`  🎨 Canvas Graphics Detected: ${sanitizedData.canvases.length} ([${sanitizedData.canvases.map(c => c.id).join(', ')}])`);
      }
    } else {
      console.log(`  👁️ Visual OCR Text: (No OCR text provided)`);
    }

    if (!process.env.GROQ_API_KEY) {
      console.error('❌ [DrishtiAI Backend] GROQ_API_KEY is missing from backend/.env');
      return res.status(500).json({
        success: false,
        error: 'GROQ_API_KEY is missing from backend/.env'
      });
    }

    // Execute stateful LangGraph reasoning & validation cycle
    const finalState = await runAgentGraph(sanitizedData);

    const aiResponse = {
      actions: finalState.validatedActions || [],
      is_done: finalState.isDone || false,
      reason: finalState.summaryReason || 'Actions determined by LangGraph agent',
      error: finalState.error || undefined
    };

    console.log(`[DrishtiAI Backend] ⚡ Responding with Action(s):`, JSON.stringify(aiResponse.actions, null, 2));
    console.log(`======================================================\n`);

    res.json({
      success: true,
      ai_response: aiResponse,
      state_summary: {
        loop_count: finalState.loopCount,
        actions_count: aiResponse.actions.length,
        is_done: aiResponse.is_done
      }
    });

  } catch (error) {
    console.error('[DRISHTI] Error during LangGraph analysis:', error);

    // Check if it is a Groq Rate Limit Error (Status 429 or 413 Payload Too Large)
    const isRateLimit = error.status === 429 || error.status === 413 ||
      (error?.error?.error?.code === 'rate_limit_exceeded') ||
      (typeof error.message === 'string' && error.message.includes('429'));

    if (isRateLimit) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Groq API rate limit or token payload exceeded.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error during LangGraph execution.',
      details: error.message
    });
  }
});

// Start server when executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🛡️ DrishtiAI LangGraph Backend running on http://localhost:${PORT}`);
    console.log(`Model: ${process.env.GROQ_MODEL || 'openai/gpt-oss-20b'}`);
    console.log(`Ready to receive sanitized page context on POST /api/analyze`);
  });
}

module.exports = app;
