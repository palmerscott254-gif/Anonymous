# GhostChat Backend Server (Archived)

This folder is archived for backward compatibility.

Use the canonical backend at project root:

- Entrypoint: `server.js`
- Runtime modules: `server/`

The duplicate backend code in this folder should not be used for new development.

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies (production only)
npm ci --production

# Or with yarn
yarn install --production
```

### Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update environment variables:
```env
NODE_ENV=production              # or 'development'
PORT=3001                        # Server port
CORS_ORIGIN=https://yourdomain.com  # Frontend origin for CORS
DATABASE_URL=                    # Optional: PostgreSQL connection (if using persistent storage)
```

### Running the Server

```bash
# Production
node server.js

# Or with a process manager (recommended for production)
pm2 start server.js --name "ghostchat"
```

The server will start on `http://localhost:3001` (or your configured PORT).

### Health Checks

Three diagnostic endpoints for monitoring:

- **`GET /health`** — Basic liveness check
  ```json
  { "status": "ok" }
  ```

- **`GET /health/ready`** — Readiness check (all services initialized)
  ```json
  { "status": "ok", "timestamp": 1700000000000 }
  ```

- **`GET /health/db`** — Database connectivity check (if DATABASE_URL is set)
  ```json
  { "status": "ok|error", "database": "connected|disconnected", "error": "..." }
  ```

## Architecture

### Module Structure

```
server/
├── controllers/          # Socket event handlers
│   ├── sessionController.js    # Session lifecycle (hello, ready)
│   ├── roomController.js       # Room generation, joining, leaving
│   └── messageController.js    # Messages, typing, read receipts
├── services/            # Business logic & storage
│   ├── room.js          # In-memory room/session/message storage
│   └── rateLimit.js     # HTTP & Socket.IO rate limiting
├── middleware/          # Express middleware
│   └── security.js      # CORS, security headers, config validation
├── utils/               # Utility functions
│   └── crypto.js        # ECDSA-P256 signature verification
├── routes/              # HTTP endpoints
│   └── health.js        # Health check endpoints
└── sockets/             # Real-time event setup
    └── handlers.js      # Socket.IO event registration
```

### Key Services

#### Room Service (`server/services/room.js`)
Manages ephemeral encrypted messaging rooms:
- Room creation with TTL expiry (1 min – 24 hours)
- session/peer management
- Message deduplication (prevents double-delivery)
- Typing indicator state
- Read receipt tracking

#### Rate Limiting (`server/services/rateLimit.js`)
Enforces per-socket rate limits:
- HTTP: Global per-endpoint limits
- Socket.IO: Per-socket per-event limits
- Configurable for dev/prod environments

**Limits (default dev | production):**
- `room.generate_code`: 120 req/min | 20 req/min
- `room.join`: 180 req/min | 30 req/min
- `msg.send`: 300 msg/min | 40 msg/min
- `typing.set`: 720 updates/min | 180 updates/min

#### Security Middleware (`server/middleware/security.js`)
- **CORS**: Validates origins against `CORS_ORIGIN` env var
- **Security Headers**: Strict-Transport-Security, X-Content-Type-Options, etc.
- **Production Checks**: Enforces HTTPS, secure CORS in production

#### Crypto Utilities (`server/utils/crypto.js`)
- **ECDSA-P256 Signature Verification**: Validates message signatures
- **Base64 Encoding/Decoding**: Safe payload transformation

## Socket Events

### Client → Server

| Event | Payload | Purpose |
|-------|---------|---------|
| `session.hello` | `{ deviceId, identity }` | Initialize session |
| `room.generate_code` | `{ ttlMinutes?, roomCode?, kind }` | Create encrypted room |
| `room.join` | `{ roomCode, identity }` | Join room & exchange keys |
| `room.leave` | — | Leave room gracefully |
| `msg.send` | `{ clientMsgId, bodyCiphertext, bodyIv, wrappedKeys, signature, ... }` | Send encrypted message |
| `typing.set` | `{ isTyping }` | Update typing state |
| `msg.read` | `{ msgId, readAt }` | Broadcast read receipt |

### Server → Client

| Event | Payload | Purpose |
|-------|---------|---------|
| `session.ready` | `{ sessionId, peerId, features }` | Session initialized |
| `room.code_generated` | `{ roomCode, expiresAt }` | Room created |
| `room.joined` | `{ roomCode, members, security }` | Joined room |
| `room.member_joined` | `{ peerId, username, emoji, e2ee }` | User joined |
| `room.member_left` | `{ peerId, leftAt }` | User left |
| `msg.new` | `{ msgId, fromPeerId, bodyCiphertext, ... }` | New message |
| `msg.ack` | `{ clientMsgId, msgId, deliveredAt }` | Message delivered |
| `typing.update` | `{ peerId, isTyping, ts }` | Typing state |
| `msg.read` | `{ peerId, msgId, readAt }` | Read receipt |
| `error` | `{ code, message }` | Error response |

## Encryption & Security

### End-to-End Encryption (E2EE)
- **Algorithm**: AES-256-GCM (content) + ECDH-P256 (key exchange) + ECDSA-P256 (signatures)
- **Key Wrapping**: Each message has keys wrapped for every room member
- **Signature Verification**: Server validates sender identity via ECDSA
- **Server-Side**: Server stores encrypted messages, never decrypts content

### Message Signing
All messages include a Base64-encoded ECDSA-P256 signature. The server verifies signatures using the sender's registered public key.

### Rate Limiting & DoS Prevention
- Per-socket per-event rate limits
- Burst tolerance with sliding window
- Automatic cleanup of stale sessions

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode (dev/prod) |
| `PORT` | `3001` | Server port |
| `CORS_ORIGIN` | `http://localhost:5173` | Client origin for CORS |
| `DATABASE_URL` | — | PostgreSQL connection (optional) |

## Logging

Logs include:
- Connection/disconnection events: `[SESSION]`, `[DISCONNECT]`
- Room operations: `[ROOM.GENERATED]`, `[ROOM.JOINED]`, `[ROOM.LEFT]`
- Messages: `[MSG]` with ciphertext preview
- Health checks: `[HEALTH]`

## Performance Considerations

- **In-Memory Storage**: Rooms auto-expire; no persistent storage by default
- **Message Retention**: Limited to active room members; deleted on room expiry
- **Socket.IO Adapters**: Scales to multiple server instances with `socket.io-redis` or `socket.io-postgres`
- **Database (Optional)**: PostgreSQL support for persistent room archives

## Deployment

### Docker Example
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY server/ ./server/
EXPOSE 3001
CMD ["node", "server.js"]
```

### Docker Compose
```yaml
services:
  ghostchat-backend:
    build: .
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      PORT: 3001
      CORS_ORIGIN: https://yourdomain.com
    restart: unless-stopped
```

### Process Manager (PM2)
```bash
pm2 start server.js --name "ghostchat" \
  --instances max \
  --env NODE_ENV=production \
  --env PORT=3001
pm2 save
pm2 startup
```

## Monitoring & Debugging

### Troubleshooting

**"CORS_ORIGIN_INVALID" errors:**
- Verify `CORS_ORIGIN` matches your frontend URL exactly
- Include protocol (`https://`) and exclude trailing slashes

**Signature verification failures:**
- Ensure client is sending the correct `signingPublicKey`
- Check that client and server use the same signature algorithm (ECDSA-P256)

**Rate limit errors:**
- Adjust limits in `.env` or `messageController.js`
- Check client for excessive event firing (e.g., rapid `msg.send`)

**Health check failures:**
- `/health` should always return 200 if process is alive
- `/health/db` only succeeds if `DATABASE_URL` is set and reachable

### Enable Debug Logging
```bash
DEBUG=ghostchat:* node server.js
```

## License

Proprietary. See the root LICENSE file.
