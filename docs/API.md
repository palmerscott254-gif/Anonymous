# API Reference

## HTTP Endpoints

### POST /auth/register
Body:

```json
{ "username": "alice", "password": "password123", "publicKey": "optional" }
```

### POST /auth/login
Body:

```json
{ "username": "alice", "password": "password123" }
```

### POST /auth/refresh
Body:

```json
{ "refreshToken": "..." }
```

### POST /auth/logout
Body:

```json
{ "refreshToken": "..." }
```

### POST /auth/guest
Body:

```json
{ "username": "optional", "publicKey": "optional" }
```

### GET /health
Returns liveness and runtime counters.

### GET /health/ready
Readiness endpoint.

### GET /health/db
Database probe endpoint.

## Socket Events

### Client -> Server (supported aliases)

- `session.hello`
- `room.generate_code`, `room:generate`
- `room.join`, `room:join`
- `room.leave`, `room:leave`
- `msg.send`, `msg:send`
- `typing.set`, `typing:set`

### Server -> Client

- `session.ready`
- `room.code_generated`
- `room.joined`
- `room.member_joined`
- `room.member_left`
- `msg.ack`
- `msg.new`, `msg:new`
- `typing.update`
- `error`

## Structured error shape

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "event": "msg.send",
    "details": null
  }
}
```
