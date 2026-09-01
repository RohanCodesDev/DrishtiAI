const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const { AGENT_SYSTEM_PROMPT, buildUserPrompt } = require('./prompts');
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
  res.json({ status: 'ok', message: 'DrishtiAI Backend is running.' });
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
    
    // Initialize Groq SDK (requires process.env.GROQ_API_KEY)
    if (!process.env.GROQ_API_KEY) {
      console.error('❌ [DrishtiAI Backend] GROQ_API_KEY is missing from backend/.env');
      return res.status(500).json({ error: 'GROQ_API_KEY is missing from backend/.env' });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    console.log(`\n[DrishtiAI Backend] 🤖 Querying Groq (openai/gpt-oss-20b)...`);
    console.log(`  🎯 User Task: "${sanitizedData.userTask || 'None'}"`);
    const userPrompt = buildUserPrompt(sanitizedData, sanitizedData.userTask, sanitizedData.actionHistory);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: AGENT_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: userPrompt
        }
      ],
      model: 'openai/gpt-oss-20b'
    });

    let responseText = chatCompletion.choices[0]?.message?.content || '{}';

    // Regex extraction to cleanly extract JSON even if LLM hallucinated markdown/text
    const jsonMatch = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      responseText = jsonMatch[0];
    }

    let aiAction = {};
    try {
      aiAction = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('❌ [DrishtiAI Backend] Failed to parse Groq JSON output:', responseText);
      aiAction = { action: 'WAIT', reason: 'Failed to parse AI output', raw: responseText };
    }

    console.log(`[DrishtiAI Backend] ⚡ Responding with Action:`, JSON.stringify(aiAction, null, 2));
    console.log(`======================================================\n`);
    res.json({ success: true, ai_response: aiAction });

  } catch (error) {
    console.error('Error during analysis:', error);
    
    // Check if it is a Groq Rate Limit Error (Status 429 or 413 Payload Too Large)
    const isRateLimit = error.status === 429 || error.status === 413 || 
      (error?.error?.error?.code === 'rate_limit_exceeded');
      
    if (isRateLimit) {
      return res.status(429).json({ 
        success: false, 
        error: 'RATE_LIMIT_EXCEEDED', 
        message: 'Groq API rate limit or token payload exceeded.' 
      });
    }

    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🛡️ DrishtiAI Local Backend running on http://localhost:${PORT}`);
  console.log(`Ready to receive sanitized page context on POST /api/analyze`);
});
