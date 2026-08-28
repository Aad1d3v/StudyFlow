# StudyFlow Backend

Zero-dependency Node service (built-in `http`, `sqlite`, `crypto`) that provides:

1. **Accounts** — register / sign in with scrypt-hashed passwords and HMAC-signed tokens.
2. **Per-user data sync** — the desktop app stores assignments, focus sessions, goals, and plans per account.
3. **AI proxy** — the Groq key (OpenAI OSS 20B) lives here, never in the desktop app.

```text
Desktop App → /api/* (Vite proxy) → backend → SQLite (accounts + data) / Groq (AI)
```

Requires Node ≥ 23.6 (runs TypeScript directly; no build step, no `npm install`).

## Run

```bash
cd backend
copy .env.example .env   # add AI_API_KEY, adjust BACKEND_PORT if needed
npm run dev              # http://127.0.0.1:8787
```

The dev frontend proxies `/api/*` to this port (see `vite.config.ts`), so the browser never talks to the backend directly.

## Endpoints

| Method | Path           | Auth   | Purpose                                        |
| ------ | -------------- | ------ | ---------------------------------------------- |
| GET    | `/health`      | –      | `{ status, aiConfigured, model }`              |
| POST   | `/auth/register` | –    | `{ name, email, password }` → `{ token, user }` |
| POST   | `/auth/login`  | –      | `{ email, password }` → `{ token, user }`      |
| GET    | `/auth/me`     | Bearer | Validates the session → `{ user }`             |
| GET    | `/data`        | Bearer | `{ data }` (the user's synced app data)        |
| PUT    | `/data`        | Bearer | `{ data }` — replaces the user's synced data   |
| POST   | `/ai/chat`     | Bearer | `{ messages, context }` → `{ answer }` (Groq)  |

## Storage

- `data/studyflow.db` — SQLite (`users`, `user_data`), created on first run.
- `data/auth-secret` — random per-install signing secret (persisted so tokens survive restarts; override with `AUTH_SECRET`).
- `data/` is git-ignored. Back it up with the database if you move instances.

## Security

- Passwords are hashed with scrypt + per-user salt; never stored in plain text.
- Tokens are HMAC-SHA256 signed, expire after 30 days, and are validated on every request.
- The AI API key is read from the environment on the server only; it never ships in the desktop app or website.
- Auth endpoints are rate-limited per IP; payloads are size- and shape-validated.
- When `AI_API_KEY` is absent, AI endpoints return `503` with a clear message — the app keeps working without AI.
