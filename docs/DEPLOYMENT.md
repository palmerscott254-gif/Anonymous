# Deployment Guide

## Environment

Minimum required in production:

- `NODE_ENV=production`
- `PORT`
- `CORS_ORIGIN`
- `JWT_SECRET`
- `DATABASE_URL`

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
