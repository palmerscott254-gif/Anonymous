# GhostChat - Architecture Overview

This repository is being reorganized into a clearer, production-friendly layout.

Proposed top-level folders:

- `client/` - React frontend (UI, components, pages, hooks)
- `server/` - Node backend (routes, controllers, sockets)
- `shared/` - Shared contracts, event names, schemas
- `mobile/` - Capacitor/Android project
- `docs/` - Architecture diagrams, deployment guides

Next steps:
- Move existing `src/` UI code into `client/src/` and adapt imports.
- Move `server/index.js` and socket logic into `server/` (done: basic skeleton).
- Consolidate `contracts/` into `shared/` and use TypeScript types for validation.
- Add CI/CD, Docker, and production-ready configs.
