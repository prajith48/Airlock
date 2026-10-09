#!/usr/bin/env node
/**
 * Test Development Server with Sensitive Data
 * This simulates a real dev server with secrets that attackers want to steal
 */

import { createServer } from 'http';

// Simulated sensitive data that would exist on a real dev server
const SENSITIVE_DATA = {
  apiKeys: {
    openai: 'sk-proj-AbCdEf123456789_FAKE_API_KEY_ghijklmnop',
    stripe: 'sk_test_51AbCdEf123456789_FAKE_STRIPE_KEY',
    aws: 'AKIAIOSFODNN7EXAMPLE_FAKE_AWS_KEY',
    database: 'mongodb://admin:SuperSecret123@localhost:27017/myapp'
  },
  users: [
    { id: 1, email: 'admin@company.com', password: 'hashed_admin_pass', role: 'admin', ssn: '123-45-6789' },
    { id: 2, email: 'user@company.com', password: 'hashed_user_pass', role: 'user', ssn: '987-65-4321' },
    { id: 3, email: 'developer@company.com', password: 'hashed_dev_pass', role: 'developer', ssn: '555-12-3456' },
  ],
  sessionTokens: [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkbWluIFVzZXIiLCJpYXQiOjE1MTYyMzkwMjJ9',
    'sess:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    'token:admin_super_secret_xyz789'
  ],
  creditCards: [
    { number: '4532-1111-2222-3333', cvv: '123', exp: '12/28', name: 'John Doe' },
    { number: '5425-2333-4444-5555', cvv: '456', exp: '06/27', name: 'Jane Smith' },
  ]
};

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';

const server = createServer((req, res) => {
  const url = req.url;

  // Log all requests
  console.log(`[${new Date().toISOString()}] ${req.method} ${url} - Host: ${req.headers.host} - Origin: ${req.headers.origin || 'none'}`);

  // Serve main page
  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Test Dev Server</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            max-width: 900px;
            margin: 50px auto;
            padding: 20px;
            background: #000000;
            color: #d4d4d4;
          }
          .container {
            background: #000000;
            padding: 30px;
            border: 1px solid #333333;
            border-radius: 0;
          }
          h1 { color: #ffffff; font-weight: normal; border-bottom: 1px solid #333; padding-bottom: 10px; }
          h2 { color: #ffffff; font-weight: normal; margin-top: 30px; }
          .endpoint {
            background: #111111;
            border-left: 2px solid #555555;
            padding: 15px;
            margin: 10px 0;
            cursor: pointer;
            transition: background 0.1s, border-color 0.1s;
          }
          .endpoint:hover {
            background: #1a1a1a;
            border-left: 2px solid #ffffff;
          }
          .endpoint code {
            background: #000000;
            padding: 2px 6px;
            font-family: 'Courier New', monospace;
            color: #569cd6;
          }
          .warning {
            background: #222200;
            border-left: 2px solid #d7ba7d;
            color: #d7ba7d;
            padding: 15px;
            margin: 20px 0;
          }
          .danger {
            background: #330000;
            border-left: 2px solid #f14c4c;
            color: #f14c4c;
            padding: 15px;
            margin: 20px 0;
          }
          .success {
            background: #002200;
            border-left: 2px solid #608b4e;
            color: #608b4e;
            padding: 15px;
            margin: 20px 0;
          }
          pre {
            background: #0a0a0a;
            color: #ce9178;
            padding: 15px;
            overflow-x: auto;
            border: 1px solid #333333;
          }
          #response {
            margin-top: 20px;
            display: none;
          }
          .dim { color: #808080; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>[ Development Server : Test Environment ]</h1>
          <p class="dim">> System environment loaded. Simulated sensitive data accessible.</p>

          <div class="warning">
            <strong>[WARNING] Development Mode:</strong> This server contains unauthenticated API endpoints.
          </div>

          <h2>> Available Endpoints</h2>

          <div class="endpoint" onclick="fetchEndpoint('/api/secrets')">
            <strong>GET /api/secrets</strong><br>
            <small class="dim">Returns system API keys and cloud credentials</small>
          </div>

          <div class="endpoint" onclick="fetchEndpoint('/api/users')">
            <strong>GET /api/users</strong><br>
            <small class="dim">Returns raw user database including SSNs</small>
          </div>

          <div class="endpoint" onclick="fetchEndpoint('/api/session')">
            <strong>GET /api/session</strong><br>
            <small class="dim">Returns active session tokens</small>
          </div>

          <div class="endpoint" onclick="fetchEndpoint('/api/payment')">
            <strong>GET /api/payment</strong><br>
            <small class="dim">Returns stored credit card information</small>
          </div>

          <div class="endpoint" onclick="fetchEndpoint('/api/config')">
            <strong>GET /api/config</strong><br>
            <small class="dim">Returns application configuration and connection strings</small>
          </div>

          <div id="response">
            <h3 style="color: #fff; font-weight: normal;">> Response Output</h3>
            <pre id="responseData"></pre>
          </div>

          <div class="danger">
            <strong>[ALERT] Security Notice:</strong> Without Airlock, these endpoints are vulnerable to DNS rebinding. External domains can exfiltrate this data.
          </div>

          <div class="success" style="display: none;" id="airlockStatus">
            <strong>[SECURE] Airlock Active:</strong> DNS rebinding mitigations applied. Unauthorized host/origin requests will be dropped.
          </div>

          <p style="margin-top: 30px; font-size: 0.85em;" class="dim">
            > Server Bind: ${HOST}:${PORT} | SysTime: ${new Date().toISOString()}
          </p>
        </div>

        <script>
          async function fetchEndpoint(endpoint) {
            const responseDiv = document.getElementById('response');
            const responseData = document.getElementById('responseData');

            responseDiv.style.display = 'block';
            responseData.textContent = '> Loading payload...';

            try {
              const response = await fetch(endpoint);
              const data = await response.json();
              responseData.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
              responseData.textContent = '> Error fetching endpoint: ' + error.message;
            }
          }

          // Check if running through Airlock proxy
          if (window.location.host.includes('127.0.0.1:3000') || window.location.host.includes('localhost:3000')) {
            document.getElementById('airlockStatus').style.display = 'block';
          }
        </script>
      </body>
      </html>
    `);
    return;
  }

  // DANGEROUS ENDPOINT: API Secrets
  if (url === '/api/secrets') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*' // Dev server has CORS wide open (bad but common in dev)
    });
    res.end(JSON.stringify({
      success: true,
      secrets: SENSITIVE_DATA.apiKeys,
      timestamp: new Date().toISOString(),
      warning: '[WARNING] SENSITIVE: These are API keys and credentials.'
    }, null, 2));
    return;
  }

  // DANGEROUS ENDPOINT: User Database
  if (url === '/api/users') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      success: true,
      users: SENSITIVE_DATA.users,
      count: SENSITIVE_DATA.users.length,
      timestamp: new Date().toISOString(),
      warning: '[WARNING] SENSITIVE: User database with SSNs and password hashes.'
    }, null, 2));
    return;
  }

  // DANGEROUS ENDPOINT: Session Tokens
  if (url === '/api/session') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      success: true,
      activeSessions: SENSITIVE_DATA.sessionTokens,
      count: SENSITIVE_DATA.sessionTokens.length,
      timestamp: new Date().toISOString(),
      warning: '[WARNING] SENSITIVE: Active user session tokens.'
    }, null, 2));
    return;
  }

  // DANGEROUS ENDPOINT: Payment Information
  if (url === '/api/payment') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      success: true,
      creditCards: SENSITIVE_DATA.creditCards,
      count: SENSITIVE_DATA.creditCards.length,
      timestamp: new Date().toISOString(),
      warning: '[HIGHLY SENSITIVE] Credit card information exposed.'
    }, null, 2));
    return;
  }

  // DANGEROUS ENDPOINT: Configuration
  if (url === '/api/config') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      success: true,
      config: {
        database: SENSITIVE_DATA.apiKeys.database,
        apiKeys: {
          openai: SENSITIVE_DATA.apiKeys.openai,
          aws: SENSITIVE_DATA.apiKeys.aws
        },
        environment: 'development',
        debugMode: true,
        allowedOrigins: ['*']
      },
      timestamp: new Date().toISOString(),
      warning: '[WARNING] SENSITIVE: Application configuration with credentials.'
    }, null, 2));
    return;
  }

  // DANGEROUS ENDPOINT: File Read (path traversal vulnerability)
  if (url.startsWith('/api/read-file')) {
    const urlObj = new URL(url, `http://${req.headers.host}`);
    const filePath = urlObj.searchParams.get('path');

    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': '*'
    });

    if (!filePath) {
      res.end(JSON.stringify({
        error: 'No path provided',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    try {
      // VULNERABILITY: No path validation! Attacker can read ANY file
      const targetPath = filePath.startsWith('/') ? `.${filePath}` : filePath;
      const fileContent = require('fs').readFileSync(targetPath, 'utf-8');

      console.log(`[ALERT] FILE READ: ${filePath} (${fileContent.length} bytes)`);

      res.end(JSON.stringify({
        success: true,
        path: filePath,
        content: fileContent,
        size: fileContent.length,
        timestamp: new Date().toISOString(),
        warning: '[CRITICAL] File system access without validation.'
      }, null, 2));
    } catch (err) {
      res.end(JSON.stringify({
        error: err.message,
        path: filePath,
        timestamp: new Date().toISOString()
      }));
    }
    return;
  }

  // DANGEROUS ENDPOINT: Network Traffic Capture
  if (url === '/api/network-capture') {
    // Simulated network traffic that would be captured
    const capturedTraffic = {
      recentRequests: [
        {
          method: 'POST',
          url: 'https://api.stripe.com/v1/charges',
          headers: { 'Authorization': 'Bearer sk_live_51AbCdEf_REAL_KEY' },
          body: { amount: 5000, currency: 'usd', card: '4532-1111-2222-3333' }
        },
        {
          method: 'GET',
          url: 'https://api.openai.com/v1/completions',
          headers: { 'Authorization': 'Bearer sk-proj-REAL_OPENAI_KEY' }
        },
        {
          method: 'POST',
          url: '/internal/admin/users',
          headers: { 'Cookie': 'session=admin_session_token_xyz' },
          body: { action: 'delete', userId: 123 }
        }
      ],
      webSocketMessages: [
        { type: 'auth', token: 'ws_auth_token_abc123' },
        { type: 'message', content: 'Confidential business data...' }
      ]
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });

    console.log('[ALERT] NETWORK CAPTURE ACCESSED - Sensitive traffic exposed.');

    res.end(JSON.stringify({
      success: true,
      captured: capturedTraffic,
      captureCount: capturedTraffic.recentRequests.length,
      timestamp: new Date().toISOString(),
      warning: '[CRITICAL] Network traffic exposed without authentication.'
    }, null, 2));
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, HOST, () => {
  console.log(`Test server listening on ${HOST}:${PORT}`);
  console.log('This server should be wrapped by Airlock guard for protection');
  console.log('\n[WARNING] This server exposes SENSITIVE endpoints:');
  console.log('   - /api/secrets (API keys for OpenAI, Stripe, AWS)');
  console.log('   - /api/users (User database with SSNs)');
  console.log('   - /api/session (Active session tokens)');
  console.log('   - /api/payment (Credit card information)');
  console.log('   - /api/config (Application config with credentials)\n');
  console.log('[INFO] Without Airlock: Attackers can steal this data via DNS rebinding');
  console.log('[SECURE] With Airlock: All unauthorized access is blocked.\n');
});
