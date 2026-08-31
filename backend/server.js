const express = require('express');
const cors = require('cors');
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
    
    // In Phase 8, we will send this sanitizedData to an LLM/VLM.
    // For now, we just mock the AI response.
    
    setTimeout(() => {
      // Mocked AI Structured Action
      const mockAction = {
        action: 'WAIT',
        target_id: null,
        reason: 'Page context received successfully and sanitized locally. Awaiting further instructions.',
        context_summary: `Processed ${sanitizedData.element_count} elements safely.`
      };

      console.log('--- Responding with Mock Action ---', mockAction);
      res.json({ success: true, ai_response: mockAction });
    }, 1500); // Simulate network/LLM latency

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
