# Mobile Backend Setup

## What This Fix Does

GhostChat now resolves backend URLs dynamically so the same frontend bundle can talk to the backend from the browser, Android emulator, physical Android devices, and production deployments.

The production backend for this setup is `https://anonymous-193w.onrender.com`.

## Environment Variables

### Backend

- `PORT`: backend listen port, usually `3001`
- `DATABASE_URL`: optional for local development; if omitted, the app stays in in-memory mode where supported
- `CORS_ORIGIN`: comma-separated allow-list for production and explicit development origins
- `JWT_SECRET`: required in production, must be long and random

### Frontend

- `VITE_API_URL`: HTTP(S) base URL used by REST calls
- `VITE_SOCKET_URL`: Socket.IO base URL used by the realtime client
- `VITE_ANDROID_HOST`: optional LAN host for physical devices when you do not want to hardcode a full URL

## Local Development

1. Copy `.env.example` to `.env.development` if you want to override the defaults.
2. Start the backend with `npm run server` or `npm run dev:server`.
3. Start the frontend with `npm run dev`.
4. Open the browser frontend normally. If no explicit frontend URLs are set, the app falls back to `http://localhost:3001` in development and `https://anonymous-193w.onrender.com` in production builds.

The frontend performs a startup `GET /health` check and logs whether the backend is reachable.

## Android Emulator

For the Android emulator, the runtime resolver uses `http://10.0.2.2:3001` when no explicit URL is configured.

1. Make sure the backend is running on the host machine.
2. Run `npm run build`.
3. Run `npx cap sync android`.
4. Launch the Android app in the emulator.

If you are using Genymotion, the default host becomes `http://10.0.3.2:3001`.

## Physical Android Devices

Physical devices need a reachable LAN host.

1. Set `VITE_API_URL` and `VITE_SOCKET_URL` to your machine's LAN IP or production endpoint.
2. If you prefer, set `VITE_ANDROID_HOST` and let the resolver build the HTTP URL for local testing.
3. Ensure the device can reach the backend over the network.

When you are using the production APK, leave the explicit frontend URLs pointing at `https://anonymous-193w.onrender.com` so the app uses HTTPS end-to-end.

If you are testing with cleartext HTTP on a device build, use the debug Android network security configuration included in this repo.

## Production Deployment

1. Set `NODE_ENV=production`.
2. Use a real PostgreSQL `DATABASE_URL`.
3. Set `CORS_ORIGIN` to the production web domain and any Capacitor origins you need.
4. Set `VITE_API_URL` and `VITE_SOCKET_URL` to HTTPS endpoints.
5. Provide a strong `JWT_SECRET`.

For the current deployment, the frontend variables should point at `https://anonymous-193w.onrender.com`.

Production should not rely on wildcard CORS. The code only permits wildcard-style behavior in development.

## Troubleshooting

- If the browser cannot connect, verify `VITE_API_URL`, `VITE_SOCKET_URL`, and `PORT`.
- If the emulator cannot connect, confirm the backend is running on the host and that the app is using `10.0.2.2` or `10.0.3.2`.
- If a physical device cannot connect, use a LAN IP or HTTPS endpoint that the device can reach.
- If Socket.IO connects but messages fail, check the browser console for `session.hello` and `session.ready` logs.
- If `/health` fails, the frontend will log a backend unreachable message without crashing the UI.
- If production connections fail, confirm the Render service is awake and that both `VITE_API_URL` and `VITE_SOCKET_URL` are set to `https://anonymous-193w.onrender.com`.

## Validation Commands

- `npm test -- tests/unit/runtimeUrl.test.js tests/unit/apiClient.test.js tests/unit/socketService.test.js`
- `npm run build`
- `npx cap sync android`