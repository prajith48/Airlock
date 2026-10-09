# Attack Demonstration

This directory contains a realistic DNS rebinding attack demonstration that shows how Airlock protects your development environment.

## 🎯 What This Attack Demonstrates

### Real Attack Vectors (Not Just Logging)

The attacker server demonstrates **actual data exfiltration**, not just console logs:

1. **API Data Theft** - Steals sensitive endpoints:
   - 🔑 API Keys (OpenAI, Stripe, AWS credentials)
   - 👥 User Database (emails, SSNs, password hashes)
   - 🎫 Session Tokens (JWT tokens, auth tokens)
   - 💳 Credit Card Information (numbers, CVV, expiry)
   - ⚙️ Database Credentials and config

2. **File System Access** - Attempts to read files:
   - 📄 `.env` files (environment secrets)
   - 📦 `package.json` (project configuration)
   - 🔑 Path traversal attempts (`../.env`, `../../.ssh/id_rsa`)

3. **Network Traffic Capture** - Intercepts:
   - 📡 HTTP request/response data
   - 🔌 WebSocket messages
   - 🔐 Authentication headers and tokens

### Exfiltration Methods

When attacks succeed (WITHOUT Airlock), stolen data is:
- **Written to disk** in `attack-demo/stolen-files/` directory
- **Saved as JSON** in `attack-demo/stolen-data.json`
- **Displayed visually** in the attack dashboard UI
- **Logged in detail** with timestamps and data previews

## 📁 Files

- **`attacker-server.js`** - Malicious server that hosts the attack page and receives stolen data
- **`demo-attack.sh`** - Automated demonstration script showing before/after protection
- **`README.md`** - This file

## 🚀 Quick Start

### Automated Demo (Recommended)

Run the full demonstration showing attacks failing WITH Airlock and succeeding WITHOUT:

```bash
cd /home/Prajith/PROGRAMMING/Airlock
./attack-demo/demo-attack.sh
```

This will:
1. Start an unprotected server → show successful attacks
2. Start Airlock-protected server → show blocked attacks
3. Guide you through the visual comparison

### Manual Testing

#### Test WITHOUT Airlock (Vulnerable)

```bash
# Terminal 1: Start vulnerable test server
node test-server.js

# Terminal 2: Start attacker
node attack-demo/attacker-server.js

# Browser: Visit http://127.0.0.1:8888/attack
# Click "Start Attack Demo" → Watch data get stolen! 💀
```

Check the stolen data:
```bash
cat attack-demo/stolen-data.json          # All stolen data
ls -lh attack-demo/stolen-files/          # Stolen files on disk
```

#### Test WITH Airlock (Protected)

```bash
# Terminal 1: Start Airlock guard
./start.sh
# OR
npm run guard

# Terminal 2: Start attacker
node attack-demo/attacker-server.js

# Browser: Visit http://127.0.0.1:8888/attack
# Click "Start Attack Demo" → All attacks BLOCKED! 🛡️
```

Check the results:
```bash
# No data stolen (files won't exist or will be empty)
cat attack-demo/stolen-data.json          # Should show no successful attacks
ls attack-demo/stolen-files/              # Directory empty or non-existent
```

## 🔍 What Gets Stolen (Without Airlock)

### API Keys and Credentials
```json
{
  "openai": "sk-proj-AbCdEf123456789...",
  "stripe": "sk_test_51AbCdEf123456789...",
  "aws": "AKIAIOSFODNN7EXAMPLE...",
  "database": "mongodb://admin:SuperSecret123@..."
}
```

### User Database
```json
[
  {
    "email": "admin@company.com",
    "password": "hashed_admin_pass",
    "ssn": "123-45-6789"
  }
]
```

### Files from Disk
```
# Stolen from: /.env
# Time: 2026-09-11T09:03:12.345Z
# Size: 234 bytes

OPENAI_API_KEY=sk-proj-RealSecretKey123
DATABASE_URL=postgres://user:pass@localhost/db
STRIPE_SECRET=sk_live_RealStripeKey456
```

### Network Traffic
```json
{
  "recentRequests": [
    {
      "method": "POST",
      "url": "https://api.stripe.com/v1/charges",
      "headers": {"Authorization": "Bearer sk_live_..."},
      "body": {"amount": 5000, "card": "4532-1111-2222-3333"}
    }
  ]
}
```

## 🛡️ How Airlock Blocks It

Airlock's Dev Server Guard prevents DNS rebinding attacks by:

1. **Host Header Validation** - Only accepts `localhost` or `127.0.0.1`
2. **Origin Validation** - Verifies request origin matches expected localhost
3. **Abrupt Connection Drop** - No 403 response, just immediate disconnect
4. **Zero Information Disclosure** - Attackers get no feedback

### Attack Flow

**Without Airlock:**
```
Attacker Site → DNS Rebind to 127.0.0.1 → Fetch localhost:3000/api/secrets → SUCCESS! 💀
                                                                            ↓
                                                              Stolen data exfiltrated
```

**With Airlock:**
```
Attacker Site → DNS Rebind to 127.0.0.1 → Fetch localhost:3000/api/secrets → BLOCKED! 🛡️
                                          ↑
                                   Host header invalid
                                   Connection dropped
```

## 📊 Attack Statistics

The attacker server tracks comprehensive metrics:

- **Total bytes stolen** - Sum of all exfiltrated data
- **Successful attacks** - Number of endpoints accessed
- **Files stolen** - Count of filesystem reads
- **Network captures** - Number of traffic intercepts
- **Blocked attempts** - Failed attack count

View in real-time:
- Terminal logs show detailed exfiltration data
- Browser UI displays live attack progress
- `stolen-data.json` contains full audit trail

## ⚠️ Educational Purpose Only

This attack demonstration is for **EDUCATIONAL PURPOSES ONLY**. It shows:

- Real security vulnerabilities in development environments
- How DNS rebinding attacks work in practice
- Why localhost protection is critical
- How Airlock mitigates these threats

**DO NOT:**
- Use this code against systems you don't own
- Modify it for malicious purposes
- Deploy it in production environments

## 🔗 Learn More

- [DNS Rebinding Explained](../../ARCHITECTURE.md#dns-rebinding-attacks)
- [Airlock Architecture](../../ARCHITECTURE.md)
- [Security Best Practices](../../README.md#security)

## 🐛 Troubleshooting

### "Port already in use"
```bash
# Kill processes on ports 3000, 8888
./stop.sh
# OR manually:
kill $(lsof -t -i:3000)
kill $(lsof -t -i:8888)
```

### "Cannot read property of null"
Ensure you've built the project first:
```bash
npm run build
```

### Attack succeeds WITH Airlock
If attacks succeed when they shouldn't:
1. Verify Airlock is actually running: `ps aux | grep airlock`
2. Check you're accessing via correct port: `localhost:3000` (not 3001)
3. Review logs: `tail -f airlock.log`

### No data in stolen-data.json
This is EXPECTED when Airlock is running (protection working).
Without Airlock, if still empty:
1. Check browser console for errors
2. Verify attacker-server.js is running
3. Ensure CORS is enabled on test-server.js
