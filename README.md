# GhostChat MVP

GhostChat is a privacy-focused realtime chat application with Socket.IO, client-side E2EE, and optional PostgreSQL persistence.

## What is implemented

- Canonical backend entrypoint: `server.js`
- JWT authentication APIs (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/guest`)
- Socket auth support with guest fallback and protected room/message flows
- Backward-compatible socket aliases for legacy events (`room:generate` and `room.generate_code`, etc.)
- PostgreSQL migration system and repository layer
- Persistent rooms/messages/sessions when `DATABASE_URL` is configured
- Message payload persistence in encrypted form without server decryption
- Unit/API/socket integration tests + baseline Playwright E2E smoke test
- Dockerfile and deployment docs

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Run migrations (optional if `DATABASE_URL` not set):

```bash
npm run migrate
```

4. Start backend and frontend:

```bash
npm run dev:full
```

## Scripts

- `npm run dev`: Vite frontend
- `npm run dev:server`: backend in watch mode
- `npm run server`: backend
- `npm run migrate`: SQL migrations
- `npm run test`: unit + API + socket tests
- `npm run test:e2e`: Playwright smoke test
- `npm run build`: frontend production build

## Notes on compatibility

- Existing UI components and tabs are preserved.
- Existing event names still work via compatibility aliases.
- Existing E2EE client logic is preserved; server stores encrypted payloads as-is.

See docs for details:

- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DEPLOYMENT.md`
- `docs/SECURITY.md`
