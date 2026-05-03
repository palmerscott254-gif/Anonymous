Server folder: Express + Socket.IO.

Quick start:

1. Create `.env` with `JWT_SECRET` and `PORT`.
2. Run `node server/index.js` (or `npm run start:server` if scripts added).

Socket usage:
- Client should provide `auth: { token }` when connecting to Socket.IO.
- Events are defined in `shared/events.ts`.
