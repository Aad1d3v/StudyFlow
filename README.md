# StudyFlow

StudyFlow is a productivity app for students. It connects your school account, shows every assignment in one place, and helps you decide what to work on next.

- **Web app (primary):** a landing page plus the full product with **real accounts** — sign up, sign in, and your assignments, plans, focus history, and AI recommendations sync to your account. Runs at `/` and `#/app`.
- **Windows desktop app:** the same product packaged with Tauri (installer, optional).

> **StudyFlow understands your workload and helps you turn it into an actionable plan.**

## Repository layout

```text
website/        The product: marketing landing + full app (src/app), real auth
backend/        Accounts, per-user data sync, AI proxy, Google OAuth callback
                (zero-dependency Node — no npm install needed)
src/            Desktop (Tauri) application source — same app, packaged
src-tauri/      Tauri 2 desktop shell (Windows installer, icons)
database/       SQLite schema reference
docs/           Setup, deployment, security, troubleshooting
scripts/        Tooling (installer staging, icon generation)
Dockerfile      One container: website + API (Render-ready)
render.yaml     Render blueprint
```

## Features

- **Real auth:** accounts with scrypt-hashed passwords, HMAC-signed tokens, per-user data sync (nothing is local-only anymore)
- Dashboard: recommended next task, workload, due-soon list, today's plan
- Assignments: manual + Google Classroom, details view, edit, delete, filters, sorting, search
- Planner with a real deterministic **Auto Plan** (deadline-aware, break-aware, overload warnings)
- Focus Mode: timer, pause/resume, pomodoro breaks, session history
- Analytics and Goals driven by real data
- Settings: theme, account (sign out), Google connection, auto-sync, data export/delete/reset
- Google Classroom sync through the official Google APIs with 5-minute auto-sync
- AI Assistant grounded in your real workload (OpenAI OSS 20B via Groq, key server-side)

## Quick start (local)

Prereqs: Node.js ≥ 23.6 (backend runs TypeScript directly) — this repo's dev environment uses a portable Node under `.tooling/` (git-ignored).

```bash
# 1. Backend (accounts, data, AI, OAuth callback)
cd backend
copy .env.example .env   # add AI_API_KEY
npm run dev              # http://127.0.0.1:8787

# 2. Website (landing + app)
cd website
npm install
npm run dev              # http://127.0.0.1:5173  → app at #/app
```

The Vite dev server proxies `/api/*` and `/oauth/callback` to the backend. See `.freebuff/run.md` for the exact detached-launch procedure used on this machine.

## Deploy to Render (one click)

The repo includes a `Dockerfile` (multi-stage: builds the website, then serves it **and** the API from one zero-dependency Node container) and a `render.yaml` blueprint:

1. Push this repository to GitHub.
2. In Render: **New → Blueprint** → select the repo (it reads `render.yaml`), or **New → Web Service** with runtime **Docker** and the `Dockerfile`.
3. In the service's **Environment**, set the secret `AI_API_KEY` (your Groq key). `AUTH_SECRET` is generated on first boot; set it manually if you want tokens to survive redeploys.
4. Optional: attach a 1 GB disk at `/data` (render.yaml includes it) so SQLite data persists across restarts.

The container listens on port 8787 and serves both the site and `/api/*` same-origin — no CORS setup needed. Health check: `/health`.

**Google Classroom from the deployed domain:** the current OAuth client is a **Desktop** client (loopback only), which works locally. To sync Classroom on the deployed site, create a Google OAuth **Web application** client with your Render domain as an authorized origin and `https://your-app.onrender.com/oauth/callback` as a redirect URI, then set `VITE_GOOGLE_REDIRECT_URI` at build time. See `docs/deployment.md`.

## Docker

```bash
docker build -t studyflow .
docker run -p 8787:8787 -e AI_API_KEY=... -v studyflow-data:/data studyflow
# open http://localhost:8787
```

## Windows installer (optional)

```bash
powershell -ExecutionPolicy Bypass -File scripts/build-exe.ps1
```

The script checks/installs the Rust + MSVC prerequisites, builds with release settings, and stages the installer into `website/public/downloads/` so the site's download button goes live. Output: `src-tauri/target/release/bundle/nsis/StudyFlow_0.1.0_x64-setup.exe`.

## Google Classroom (local/dev)

Real sync needs an OAuth client ID — see `docs/google-setup.md`:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Only Classroom scopes (courses, coursework, submissions) and identity scopes (name, email) are requested. No client secret exists anywhere in the project. A failed sync never deletes local data.

## Security

- Never commit `.env`, `.env.local`, keys, tokens, or local databases (all git-ignored; `*.example` files are placeholders).
- AI provider keys live only on the backend, never in the browser bundle or executable.
- Passwords are scrypt-hashed; sessions are signed tokens that expire.
- Google passwords are never collected; authentication happens in Google's UI.
- Destructive data actions require confirmation.

## Docs

- `docs/getting-started.md`, `docs/google-setup.md`, `docs/classroom.md`, `docs/calendar.md`, `docs/ai.md`
- `docs/development.md`, `docs/testing.md`, `docs/deployment.md`, `docs/security.md`, `docs/troubleshooting.md`
- `ARCHITECTURE.md` and `TESTING.md`
