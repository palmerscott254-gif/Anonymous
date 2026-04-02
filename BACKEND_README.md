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
