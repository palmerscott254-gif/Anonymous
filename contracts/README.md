# GhostChat Realtime Contract (MVP)

This folder defines the backend contract for GhostChat realtime messaging.

## Goals
- Keep transport generic (`WebSocket` or `Socket.IO`).
- Use an envelope format for all messages.
- Keep payloads privacy-focused (no required traditional account fields).
- Support code-first room access (`generate code -> join by code -> chat`).

## Files
- `events.ts`: event constants + TypeScript payload/envelope types.
- `schemas/client-events.schema.json`: JSON Schema for client -> server events.
- `schemas/server-events.schema.json`: JSON Schema for server -> client events.

## Envelope
All events use this common wrapper:

```json
{
  "v": "1.0",
  "event": "room.join",
  "reqId": "req_123",
  "ts": 1760000000000,
  "data": {}
}
```

- `v`: contract version.
- `event`: event name string.
- `reqId`: optional request correlation id (recommended for request/ack flows).
- `ts`: epoch milliseconds.
- `data`: event payload.

## Security Notes
- Use `wss://` only.
- Hash normalized room code server-side for persistence (`codeHash`), never store plaintext code in long-term DB.
- Encrypt message body client-side before emit when E2EE is enabled.
- Prefer short room TTL and message auto-shred metadata.

## Suggested Handshake Sequence
1. Client emits `session.hello`
2. Server replies `session.ready`
3. Client emits `room.generate_code` or `room.join`
4. Server emits `room.code_generated` / `room.joined`
5. Chat events start: `typing.set`, `msg.send`, `msg.new`, `msg.ack`
