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

    console.log(`\n--- Received New Page Context for Analysis ---`);
    console.log(`URL: ${sanitizedData.url}`);
    console.log(`Title: ${sanitizedData.title}`);
    console.log(`Elements: ${sanitizedData.element_count}`);
    console.log(`Firewall Active Rules: ${sanitizedData.firewall_active_rules}`);
    
    // Initialize Groq SDK (requires process.env.GROQ_API_KEY)
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'GROQ_API_KEY is missing from backend/.env' });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    console.log('--- Querying Groq... ---');
    console.log(`User Task: ${sanitizedData.userTask || 'None'}`);
    const userPrompt = buildUserPrompt(sanitizedData, sanitizedData.userTask);

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
      model: 'qwen/qwen3.8-27b',
      response_format: { type: 'json_object' }
    });

    const responseText = chatCompletion.choices[0]?.message?.content || '{}';

    let aiAction = {};
    try {
      aiAction = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Groq JSON output:', responseText);
      aiAction = { action: 'WAIT', reason: 'Failed to parse AI output', raw: responseText };
    }

    console.log('--- Responding with Action ---', aiAction);
    res.json({ success: true, ai_response: aiAction });

  } catch (error) {
    console.error('Error during analysis:', error);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🛡️ DrishtiAI Local Backend running on http://localhost:${PORT}`);
  console.log(`Ready to receive sanitized page context on POST /api/analyze`);
});
