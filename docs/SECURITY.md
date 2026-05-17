# Security Notes

## Authentication

- JWT access tokens are required for authenticated flows.
- Guest mode is supported through `/auth/guest`.
- Refresh tokens are stored hashed in `sessions`.

## Real-time protections

- Socket payload validation with Zod.
- Per-socket, per-IP, and per-user rate limiting.
- Room membership checks before message/typing events.
- Structured error responses to avoid leaking internals.

## Encryption

- Client-side WebCrypto E2EE is preserved.
- Server stores encrypted payload fields without decrypting.
- Server validates signatures for tamper detection.

## Data handling

- Message payload fields (`bodyCiphertext`, `bodyIv`, `wrappedKeys`, `signature`) are persisted as received.
- TTL room semantics are maintained and expired rooms are cleaned regularly.

## Hardening recommendations

- Rotate `JWT_SECRET` with a key management process.
- Enforce strict `CORS_ORIGIN` in production.
- Run DB over private networking and TLS.
- Add WAF/rate-limits at edge in addition to app-level limits.
