# GhostChat - Real-Time Anonymous Chat

A privacy-focused, code-based anonymous chat application with end-to-end encryption capabilities.

## 🚀 Features

- **Code-Based Rooms**: Generate unique peer codes to create private chat rooms
- **Real-Time Messaging**: WebSocket-powered instant message delivery via Socket.IO
- **Emoji Identities**: Anonymous usernames based on emoji + name
- **Message Auto-Shred**: Messages automatically expire after a configurable duration
- **Multi-Platform**: Built with React frontend + Node.js/Express backend

## 🏗️ Project Structure

```
.
├── GhostChat.jsx              # Main React UI component
├── server.js                  # Socket.IO backend server
├── src/
│   ├── main.jsx              # React entry point
│   └── hooks/
│       └── useSocket.js       # Socket.IO client hook
├── android/                   # Capacitor Android project
└── dist/                      # Production frontend build
```

## 💻 Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
```

### Run Locally

**Terminal 1 - Backend (Socket.IO server):**
```bash
npm run dev:server
# Server starts on http://localhost:3001
```

**Terminal 2 - Frontend (React dev server):**
```bash
npm run dev
# Frontend starts on http://localhost:5173
```

Or run both simultaneously:
```bash
npm run dev:full
```

## 🏚️ Backend Usage

### Socket.IO Events

#### Client → Server

- `session.hello` - Initialize user session with identity
- `room.generate_code` - Generate a new room code (ttlMinutes: number)
- `room.join` - Join a room by code with identity
- `msg.send` - Send a message to room
- `typing.set` - Update typing status
- `room.leave` - Leave current room

#### Server → Client

- `session.ready` - Session initialized with peerId
- `room.code_generated` - Room created with code and expiry
- `room.joined` - Successfully joined room with members list
- `msg.new` - New message received in room
- `msg.ack` - Message delivery acknowledgment
- `typing.update` - Peer typing status change
- `room.member_joined` - Peer joined the room
- `room.member_left` - Peer left the room
- `error` - Error event with code and message

### Room Management

- **Room Lifetime**: 1 hour default (configurable via TTL)
- **Message History**: Last 100 messages per room
- **Auto-Cleanup**: Expired rooms are automatically deleted
- **Member Tracking**: Active members tracked per room

## 📱 Android Build

```bash
# Build APK
npm run android:build

# The APK will be generated at:
# android/app/build/outputs/apk/debug/app-debug.apk
```

For Android to connect to the backend, update `VITE_SOCKET_URL` in `.env.local` to your machine's IP:
```
VITE_SOCKET_URL=http://192.168.x.x:3001
```

## 🔒 Security Notes

Current implementation:
- ✅ WebSocket transport (WSS in production)
- ✅ Per-room isolation
- ✅ Message auto-expiry
- ⏳ End-to-end encryption (planned)
- ⏳ Message signing (planned)

## 📦 Production Deployment

For production, you'll want to:

1. Use HTTPS + WSS (secure WebSockets)
2. Add authentication if needed
3. Implement database persistence
4. Add rate limiting
5. Deploy backend to a server (AWS, Heroku, Railway, etc.)

Example with dotenv for production config:
```bash
PORT=3000 NODE_ENV=production npm run server
```

## 🧪 Testing

To test real-time messaging:
1. Open the app in two browser tabs
2. Generate a code in tab 1
3. Enter the code in tab 2's search
4. Send messages - they should arrive in real-time in both tabs

## 📝 API Response Examples

### Generate Code
```json
{
  "roomId": "room-1234567890-abc123",
  "roomCode": "AB-1234",
  "expiresAt": 1625097600000,
  "kind": "direct"
}
```

### Send Message  
```json
{
  "roomCode": "AB-1234",
  "clientMsgId": "1234567890-abc123",
  "bodyCiphertext": "Hello!",
  "sentAt": 1625097540000,
  "autoShredSeconds": 45
}
```

### Receive Message
```json
{
  "roomId": "room-1234567890-abc123",
  "msgId": "msg-1234567890-abc123",
  "fromPeerId": "peer-1234567890-abc123",
  "fromEmoji": "🦅",
  "bodyCiphertext": "Hello!",
  "sentAt": 1625097540000,
  "serverReceivedAt": 1625097541000
}
```

## 🤝 Contributing

Contributions welcome! Areas for improvement:
- E2EE message encryption
- Mobile optimization
- Group chat features
- Message reactions
- Voice/video calling
- Screenshot detection

## 📄 License

MIT
