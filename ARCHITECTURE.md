# StudyFlow Architecture

## System overview

```text
                   WEBSITE (website/)
                      │   explains product, hosts installer download
                      ▼
             Windows Installer (src-tauri/)
                      │
                      ▼
              DESKTOP APPLICATION (src/ + src-tauri/)
                      │
          ┌───────────┼──────────────┬──────────────┐
          ▼           ▼              ▼              ▼
       Local store   Google OAuth   Planner      Backend (backend/)
      (appStore /    (PKCE loopback, (deterministic)   │
       SQLite target)  refresh token)   │               ▼
          │              ▼               │            AI provider
          │         Classroom API        │         (key server-side)
          └──────────► UI (React) ◄──────┘
```

## Repository structure

```text
src/            desktop frontend — pages/, components/, google/, planner.ts, appStore.ts
src-tauri/      Tauri 2 shell — windowing, NSIS installer, icons
website/        public marketing site (own Vite project, port 5173)
backend/        accounts + per-user data sync + secure AI proxy (zero-dep Node, SQLite)
database/       SQLite schema (production persistence target)
docs/           user + development guides
scripts/        icon generation (pure Python stdlib)
```

## Desktop stack

- **Shell:** Tauri 2 — small distributable, system WebView, NSIS installer, path to signed auto-updates.
- **Frontend:** React + TypeScript + Vite, split into pages and pure logic modules (`planner.ts`, `utils.ts`, `google/sync.ts`) so the UI never contains business logic it can't test.
- **Styling:** global stylesheet with CSS variables; light, dark, and system themes.
- **Persistence:** the current milestone persists via `src/appStore.ts` (local storage) behind repository-style functions. The production target is SQLite (`database/schema.sql`) accessed through the Tauri native layer; the adapter swap is contained to the store modules.

## Google integration

```text
Desktop OAuth (RFC 8252): PKCE S256 + loopback redirect + refresh token
        ↓  access token (no client secret anywhere)
Classroom REST v1 → courses → published coursework → submission status
        ↓
sync layer (src/google/sync.ts) → dedupe on Google coursework IDs
        ↓
app store → UI (Dashboard / Assignments / Classroom)
```

- Deterministic due-label and priority derivation in application code; the AI never controls these calculations.
- Explicit sync states; failed/offline syncs never delete local data; per-course restrictions are reported as partial sync.
- Auto-sync every 5 minutes while connected, plus manual Sync Now.
- Only Classroom scopes plus identity scopes are requested. Gmail/Drive are never requested.
- The desktop OAuth flow (system browser + loopback, PKCE, refresh token) is implemented in `src/google/sync.ts`; in the web preview the code exchange is proxied through the Vite dev server (`/oauth2-token`) because Google's token endpoint does not allow browser CORS. The packaged Tauri build performs the same exchange natively.

## Planner

`src/planner.ts` is a pure, deterministic engine: it sorts by deadline and priority, fits work into configurable study windows, never schedules past a deadline, never overlaps, inserts breaks, and reports overload and unscheduleable work honestly. The UI (Planner page) handles Accept / Regenerate / Cancel and persists accepted plans.

## Accounts, data sync, and AI

Signing in is required before anything loads. `backend/` is a zero-dependency Node service (built-in http/sqlite/crypto) that provides:

- **Accounts** — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`. Passwords are scrypt-hashed; sessions are HMAC-signed 30-day tokens.
- **Per-user data** — `GET/PUT /data` stores the user's assignments, sessions, goals, and plan in SQLite, so progress follows the account. The frontend hydrates on sign-in and pushes debounced saves; localStorage is only the offline cache.
- **AI proxy** — `POST /ai/chat` forwards to Groq (`openai/gpt-oss-20b`). Provider keys are read from the backend environment only; the desktop app never contains them.

During development the Vite server proxies `/api/*` to the backend, so the browser stays same-origin. When the backend is down, the app shows a clear "can't reach server" message and AI returns a friendly 503-equivalent error.

## Development vs production

Development offers clearly labeled sample data via a Settings button — never seeded automatically, and never synced to a real account. Production builds start from the empty store; the Classroom page shows setup instructions, never fake data.

## Website

Static Vite/React site sharing the StudyFlow brand. The download button points at a real hosted installer only when `VITE_WINDOWS_DOWNLOAD_READY=true` and `VITE_WINDOWS_DOWNLOAD_URL` are set; otherwise it honestly shows "coming soon."

## Security model

- Google passwords are never collected; auth happens in Google's UI.
- Minimal scopes; no secrets in the desktop app or website.
- `.env`/`.env.local` git-ignored; `.env.example` documents placeholders.
- Tokens: local storage in the web preview; OS keyring in the Tauri milestone. StudyFlow account tokens are HMAC-signed and expire after 30 days.
- Destructive actions require confirmation; failed syncs never delete data.
- Backend validates input, restricts CORS, and returns generic errors to clients.

## Development vs production

Development seeds clearly labeled mock records and works fully offline. Production builds start from the empty local store; the Classroom page shows setup instructions, never fake data.

## Future integrations

The sync layer is provider-shaped (source + providerId + metadata), so Google Calendar, Canvas, Moodle, etc. can be added without touching the UI: new provider adapter → same dedupe/merge → same pages.
