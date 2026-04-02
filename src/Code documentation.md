## 🚀 How to Run

### Start Backend + Frontend Together

```bash
cd /home/scholsey/Desktop/Anonymous

# Terminal 1: Start the backend server (port 3001)
npm run dev:server

# Terminal 2 (in new terminal): Start the frontend (port 5173)
npm run dev
```

## 🎮 Quick Commands

```bash
# Development
npm run dev:server            # Backend only
npm run dev                   # Frontend only
npm run dev:full             # Both together

# Production
npm run build                # Build web assets
npm run android:build        # Build APK

# Testing
curl http://localhost:3001   # Test backend is up
npm run preview              # Test production build locally


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

## 📊 Architecture

```
┌─────────────────┐
│  React App      │ (Browser)
│  - GhostChat    │
│  - useSocket    │
└────────┬────────┘
         │ WebSocket
         │ (Socket.IO)
         ▼
┌─────────────────────────────────────┐
│  Node.js Backend (server.js)        │
│  - Express server                   │
│  - Socket.IO manager                │
│  - In-memory room storage           │
│  - Session tracking                 │
│  - Message broadcast                │
└─────────────────────────────────────┘
         ▲
         │ Messages
         │ (JSON via WebSocket)
         │
     ┌───┴────┐
     │ Browser│ (Another client)
     └────────┘
```

## 📈 Next Features To Build

1. **Database Persistence** (MongoDB/PostgreSQL)
   - Store room history
   - User profiles
   - Message archive

2. **End-to-End Encryption**
   - Client-side encryption before sending
   - Elliptic curve key exchange
   - TweetNaCl.js or libsodium.js

3. **Group Chats**
   - Multi-member rooms
   - Group invite codes
   - Admin controls

4. **File Sharing**
   - Image upload
   - File transfer protocol
   - Encrypted storage

5. **Android Optimization**
   - Background message sync
   - Push notifications
   - Battery optimization

6. **Voice/Video**
   - WebRTC integration
   - STUN/TURN servers
   - Call signaling via Socket.IO

## 🎯 Current Limitations

- **No persistence**: Messages lost on server restart
- **Single server**: No horizontal scaling yet
- **No authentication**: Anyone can claim any identity
- **No encryption**: Messages sent in plaintext
- **Memory usage**: Room data stays in RAM

## 🛠️ Troubleshooting

### "Cannot connect to socket server"
- Make sure backend is running: `npm run dev:server`
- Check port 3001 is available: `lsof -i :3001`

### "Room not found"
- Room may have expired (TTL is 1 hour by default)
- Generate a new code

### "Messages not syncing"
- Refresh the page (socket reconnects)
- Check browser console for errors
- Verify WebSocket connection: DevTools → Network → WS tab

### Android Cannot Connect
- Update `VITE_SOCKET_URL` to your machine's IP
- Use Android emulator host IP: `http://10.0.2.2:3001`
- Or run on physical device with LAN IP: `http://192.168.x.x:3001`

## 📚 Resources

- Socket.IO Docs: https://socket.io/docs/
- Express Guide: https://expressjs.com/
- Capacitor Android: https://capacitorjs.com/docs/android
- WebSocket Security: https://owasp.org/www-community/attacks/WebSocket



---

**Status**: ✅ MVP Real-Time Backend Complete
**Next**: Deploy backend server + add message encryption
**Time to first real message**: < 5 minutes!
