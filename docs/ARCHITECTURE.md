# GhostChat Architecture

## Overview

GhostChat is a React + Vite frontend with an Express + Socket.IO backend and optional PostgreSQL persistence.

Design goals:

- Preserve existing UI and UX behavior.
- Preserve client-side encryption flow.
- Add production-grade backend layers under the existing interface.
- Keep socket event backward compatibility.

## Runtime topology

- Frontend: `src/` and `GhostChat.jsx`
- Backend entrypoint: `server.js`
- Backend runtime factory: `server/appFactory.js`
- Socket handlers: `server/sockets/handlers.js`
- Persistence: `server/repositories/*` + `server/db/migrations/*`

## Backend layers

1. HTTP layer
- Express app with `helmet`, `cors`, body parsing, and global HTTP rate limiting.
- Auth endpoints at `/auth/*`.
- Health endpoints at `/health*`.

2. Service and repository layer
- Auth service: `server/services/authService.js`.
- Repository pattern for users/rooms/messages/sessions.
- PostgreSQL used when `DATABASE_URL` is provided; app remains usable in memory-only mode for development.

3. Socket layer
- Zod validation on inbound payloads.
- Per-user/per-IP/per-socket rate limiting.
- Room membership validation for protected events.
- Structured error payloads.
- Legacy and canonical event alias support (`room:generate` and `room.generate_code`, etc.).

## Data model

Tables defined through SQL migrations:

- `users`
- `rooms`
- `room_members`
- `messages`
- `sessions`
- `schema_migrations`

Indexes are added for room expiry, message lookup, and session token lookup.

## Encryption boundaries

- E2EE and key wrapping remain client-side.
- Server does not decrypt message bodies.
- Server validates signatures for message integrity.
- Encrypted payload fields are persisted exactly as received.

## Compatibility strategy

- Existing UI components/screens are unchanged.
- Legacy backend entrypoints are archived and forward to `server.js`.
- Socket event aliases preserve prior client behavior.

## Testing strategy

- Unit tests: utility-level behavior.
- API tests: auth endpoints with SuperTest.
- Socket integration tests: room generation/session flow with Socket.IO client.
- Basic E2E smoke test: Playwright app shell check.
