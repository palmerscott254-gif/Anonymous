Server folder: Express + Socket.IO runtime modules.

Quick start:

1. Create `.env` from `.env.example`.
2. Run migrations: `npm run migrate`.
3. Run backend: `npm run server`.

Canonical entrypoint: project root `server.js`.

Socket usage:
- Client may connect with `auth: { token }`.
- Guest mode is supported through `/auth/guest`.
- Legacy and canonical event aliases are both supported.
