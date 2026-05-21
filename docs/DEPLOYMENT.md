# Deployment Guide

## Environment

Minimum required in production:

- `NODE_ENV=production`
- `PORT`
- `CORS_ORIGIN`
- `JWT_SECRET` is recommended; the server can derive a fallback on Render if it is missing, but a real secret preserves token continuity across deploys
- `DATABASE_URL`

Frontend production endpoints for GhostChat:

- `VITE_API_URL=https://anonymous-193w.onrender.com`
- `VITE_SOCKET_URL=https://anonymous-193w.onrender.com`

## Docker

Build image:

```bash
docker build -t ghostchat:latest .
```

Run image:

```bash
docker run --rm -p 3001:3001 --env-file .env ghostchat:latest
```

## Health checks

- Liveness: `/health`
- Readiness: `/health/ready`
- DB probe: `/health/db`

## Startup sequence

1. Service loads env config.
2. DB migrations run.
3. HTTP and Socket.IO listeners start.

## Recommended production setup

- Reverse proxy (Nginx or cloud LB) with TLS.
- Managed PostgreSQL.
- Sticky sessions or Socket.IO adapter when scaling to multiple instances.
- Log aggregation and alerting on `/health/ready` failures.

## Render Deployment

The deployed backend for the current GhostChat release is:

- `https://anonymous-193w.onrender.com`

Use the Render service URL for both REST and Socket.IO traffic. The frontend now resolves that endpoint automatically from `.env.production` and will fall back to it in production builds if the explicit variables are missing.
