const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3001;

// ============================================
// CONFIGURATION
// ============================================
const USE_TEST_MODE = false;
const N8N_BASE_URL = 'http://localhost:5678';
const N8N_WEBHOOK_PATH = USE_TEST_MODE
  ? '/webhook-test/master-agent'
  : '/webhook/master-agent';

console.log(`\n🔧 Running Simple Proxy`);
console.log(`🔗 Target: ${N8N_BASE_URL + N8N_WEBHOOK_PATH}\n`);

// ============================================
// CORS
// ============================================
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ✅ FIXED: Handle OPTIONS requests as middleware, not route
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  next();
});

// ============================================
// LOGGING
// ============================================
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    proxy: `running on port ${PORT}`,
    n8n_target: N8N_BASE_URL + N8N_WEBHOOK_PATH,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// MANUAL WEBHOOK PROXY (ALL METHODS)
// ============================================
app.use('/webhook', (req, res) => {
  console.log('📥 Incoming request to proxy');
  console.log('   Method:', req.method);
  console.log('   Path:', req.path);
  console.log('   Headers:', JSON.stringify(req.headers, null, 2));

  // Collect the raw body
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
    console.log('   📦 Received chunk:', chunk.length, 'bytes');
  });

  req.on('end', async () => {
    console.log('   ✅ Full body received:', body);
    
    // Build target URL
    const targetPath = req.path.replace('/webhook', USE_TEST_MODE ? '/webhook-test' : '/webhook');
    const targetUrl = N8N_BASE_URL + '/webhook' + req.path;
    
    console.log('   🔄 Forwarding to:', targetUrl);
    
    try {
      // Forward to n8n
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: body ? JSON.parse(body) : undefined,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000,
        validateStatus: () => true, // Accept any status code
      });

      console.log('   ✅ n8n responded:', response.status);
      console.log('   📤 Response data:', JSON.stringify(response.data, null, 2));

      // Send response back
      res.status(response.status).json(response.data);
      
    } catch (axiosError) {
      console.error('   ❌ Axios error:', axiosError.message);
      if (axiosError.response) {
        res.status(axiosError.response.status).json({
          error: 'n8n error',
          details: axiosError.response.data,
        });
      } else {
        res.status(502).json({
          error: 'Cannot reach n8n',
          details: axiosError.message,
        });
      }
    }
  });

  req.on('error', (err) => {
    console.error('   ❌ Request stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Request stream error', details: err.message });
    }
  });
});

// ============================================
// DIAGNOSTICS
// ============================================
app.get('/diagnostics', async (req, res) => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    proxy: { status: 'running', port: PORT },
    services: {},
  };

  // Test n8n base
  try {
    const r = await axios.get(N8N_BASE_URL + '/', { timeout: 4000 });
    diagnostics.services.n8n = { status: 'online', code: r.status };
  } catch (e) {
    diagnostics.services.n8n = { status: 'offline', error: e.message };
  }

  // Test webhook
  try {
    const r = await axios.post(
      N8N_BASE_URL + N8N_WEBHOOK_PATH,
      { ping: true },
      { timeout: 4000 }
    );
    diagnostics.services.webhook = { status: 'active', code: r.status, data: r.data };
  } catch (e) {
    diagnostics.services.webhook = { status: 'inactive', error: e.message };
  }

  res.json(diagnostics);
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    available: [
      'GET /health',
      'GET /diagnostics',
      'ALL /webhook/*',
    ],
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('═'.repeat(60));
  console.log('🚀 Simple Proxy Server Running');
  console.log('═'.repeat(60));
  console.log(`📍 Port: ${PORT}`);
  console.log(`🔗 Target: ${N8N_BASE_URL + N8N_WEBHOOK_PATH}`);
  console.log(`🩺 Health: http://localhost:${PORT}/health`);
  console.log(`🧪 Diagnostics: http://localhost:${PORT}/diagnostics`);
  console.log('═'.repeat(60) + '\n');
});