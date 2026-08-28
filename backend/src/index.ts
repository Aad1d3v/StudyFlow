import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

/*
 * StudyFlow backend — auth + per-user data + AI proxy + Google OAuth proxy.
 *
 * Zero runtime dependencies on purpose: Node's built-in http server, sqlite
 * (node:sqlite), crypto (scrypt + HMAC), and fetch cover everything. Run it
 * with:  node --env-file-if-exists=.env src/index.ts
 * (Node >= 23.6 strips types and runs .ts directly.)
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

const portRaw = Number(process.env.BACKEND_PORT || process.env.PORT || 8787)
const PORT = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 8787
// Bind address: 127.0.0.1 locally, 0.0.0.0 in containers (Render sets HOST=0.0.0.0).
const HOST = process.env.HOST || '127.0.0.1'
// Optional static build of the website. When present, the backend serves the
// full product (landing + app) and the API same-origin — one deployable unit.
const STATIC_DIR = process.env.STATIC_DIR || path.join(__dirname, '..', '..', 'website', 'dist')
// Comma-separated list of origins that may call the backend: the dev server
// origin plus the origins the packaged Tauri app (WebView2) fetches from.
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGIN ||
  'http://localhost:1420,http://127.0.0.1:1420,http://localhost:5173,http://127.0.0.1:5173,http://tauri.localhost,https://tauri.localhost,tauri://localhost'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const AI_API_KEY = process.env.AI_API_KEY || ''
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1'
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-oss-20b'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
// Contact form delivery: messages are always stored in SQLite. When these are
// set, each message is also emailed to the owner via Resend.
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const CONTACT_EMAIL_TO = process.env.CONTACT_EMAIL_TO || ''
const CONTACT_ADMIN_KEY = process.env.CONTACT_ADMIN_KEY || '' // owner-only read access

/* ------------------------------ secrets ------------------------------ */

// Persisted per-install secret so signed tokens survive restarts.
const secretFile = path.join(DATA_DIR, 'auth-secret')
let AUTH_SECRET = process.env.AUTH_SECRET || ''
if (!AUTH_SECRET && fs.existsSync(secretFile)) {
  AUTH_SECRET = fs.readFileSync(secretFile, 'utf8').trim()
}
if (!AUTH_SECRET) {
  AUTH_SECRET = crypto.randomBytes(32).toString('hex')
  fs.writeFileSync(secretFile, AUTH_SECRET, { mode: 0o600 })
}

/* ------------------------------ database ----------------------------- */

const db = new DatabaseSync(path.join(DATA_DIR, 'studyflow.db'))
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_data (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`)

/* ------------------------------ passwords ---------------------------- */

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'))
}

/* ------------------------------- tokens ------------------------------ */

function signToken(userId: string): string {
  const body = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url')
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verifyToken(token: string): string | null {
  const [body, sig] = String(token || '').split('.')
  if (!body || !sig) return null
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(body).digest('base64url')
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { sub?: string; exp?: number }
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return payload.sub
  } catch {
    return null
  }
}

/* ---------------------------- rate limiting --------------------------- */

const attempts = new Map<string, { count: number; resetAt: number }>()

function rateLimited(key: string, limit = 40): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 })
    return false
  }
  entry.count += 1
  return entry.count > limit
}

/* ------------------------------- helpers ------------------------------ */

function corsOrigin(req: http.IncomingMessage): string | null {
  const origin = req.headers.origin
  if (!origin) return null
  return ALLOWED_ORIGINS.includes(origin) ? origin : null
}

function corsHeaders(req: http.IncomingMessage): Record<string, string> {
  const origin = corsOrigin(req)
  if (!origin) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
}

function send(req: http.IncomingMessage, res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...corsHeaders(req),
  })
  res.end(JSON.stringify(body))
}

function sendHtml(req: http.IncomingMessage, res: http.ServerResponse, html: string): void {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    ...corsHeaders(req),
  })
  res.end(html)
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.exe': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
}

/** Serves the built website (SPA) when a production build is present. */
function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): boolean {
  if (req.method !== 'GET') return false
  const root = STATIC_DIR
  if (!fs.existsSync(path.join(root, 'index.html'))) return false
  if (pathname.includes('..')) {
    send(req, res, 404, { error: 'Not found.' })
    return true
  }
  const safe = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const filePath = path.join(root, safe)
  try {
    const stat = fs.statSync(filePath)
    if (stat.isFile()) {
      const ext = path.extname(filePath).toLowerCase()
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': stat.size,
        ...corsHeaders(req),
      })
      res.end(fs.readFileSync(filePath))
      return true
    }
  } catch {
    // fall through to the SPA fallback below
  }
  // SPA fallback: unknown paths render the app (hash routing handles views).
  const html = fs.readFileSync(path.join(root, 'index.html'))
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    ...corsHeaders(req),
  })
  res.end(html)
  return true
}

function readBody(req: http.IncomingMessage, limit = 1_000_000): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('Payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) {
        resolve({})
        return
      }
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        resolve(parsed && typeof parsed === 'object' ? parsed : {})
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function bearerUserId(req: http.IncomingMessage): string | null {
  const header = req.headers.authorization || ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? verifyToken(match[1]) : null
}

function nowIso(): string {
  return new Date().toISOString()
}

/* ------------------------------ OAuth page ---------------------------- */

/**
 * The Google sign-in popup (or system browser) lands here after the loopback
 * redirect. The page hands the authorization code back to the StudyFlow
 * window via postMessage and closes itself — the app then exchanges the code
 * through the backend proxy. No code is stored server-side.
 */
function oauthCallbackPage(state: string, code: string | null, error: string | null): string {
  const escaped = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const ok = Boolean(code) && !error
  const message = error
    ? 'Sign-in did not complete. Return to StudyFlow and try again.'
    : code
      ? 'Sign-in complete — you can close this window and return to StudyFlow.'
      : 'This window can be closed now.'
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>StudyFlow sign-in</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#14141c;color:#e6e6f0;font-family:system-ui,sans-serif">
  <p style="font-size:14px;max-width:360px;text-align:center;line-height:1.6">${escaped(message)}</p>
<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  var state = params.get('state') || '';
  var code = params.get('code');
  var error = params.get('error');
  if (window.opener) {
    window.opener.postMessage({
      type: 'studyflow:oauth-result',
      state: state,
      ok: ${ok ? 'true' : 'false'},
      payload: code ? { code: code } : null,
      error: error || undefined
    }, '*');
    window.close();
  }
})();
</script>
</body></html>`
}

/* --------------------------------- AI --------------------------------- */

async function runGroq(messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!AI_API_KEY) {
    const error = new Error('AI is not configured on the backend.')
    ;(error as { status?: number }).status = 503
    throw error
  }
  const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      max_tokens: 700,
      temperature: 0.7,
    }),
  })
  if (!response.ok) {
    const error = new Error(`AI provider returned ${response.status}`)
    ;(error as { status?: number }).status = 502
    throw error
  }
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  return body.choices?.[0]?.message?.content || ''
}

function systemPrompt(context: string): string {
  return [
    'You are StudyFlow, an AI productivity assistant for students. You help students manage their schoolwork by analyzing their actual workload and making practical recommendations.',
    'Core rules:',
    '- Be concise and direct. Use bullet points for lists. Keep responses short unless the student asks for detail.',
    '- Base every recommendation on the student\'s real data provided in the context below.',
    '- Never invent deadlines, grades, teacher instructions, or calendar events. If information is missing, say so directly.',
    '- When recommending a task, mention its deadline and estimated time.',
    '- If the student seems overwhelmed, help them prioritize.',
    '',
    'Student\'s current data:',
    context || '(no workload data provided)',
  ].join('\n')
}

/* ---------------------------- Google proxy ---------------------------- */

/**
 * Forwards token calls to Google. The browser (dev server origin or the
 * packaged WebView2 origin) cannot call Google's token endpoint directly
 * because it sends no CORS headers — the backend proxies it. No Google
 * credentials are stored here; the client_id is public and there is no
 * client secret in the desktop flow.
 */
async function proxyToGoogleToken(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const userId = bearerUserId(req)
  if (!userId) {
    send(req, res, 401, { error: 'Session expired. Sign in again.' })
    return
  }
  const body = await readBody(req, 128_000)
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') params.set(key, value)
  }
  if (!params.has('grant_type')) {
    send(req, res, 400, { error: 'Missing grant_type.' })
    return
  }
  const google = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  const data = (await google.json().catch(() => ({}))) as Record<string, unknown>
  send(req, res, google.status, data)
}

async function proxyToGoogleRevoke(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const userId = bearerUserId(req)
  if (!userId) {
    send(req, res, 401, { error: 'Session expired. Sign in again.' })
    return
  }
  const body = await readBody(req, 16_000)
  const token = body.token
  if (typeof token !== 'string' || !token) {
    send(req, res, 400, { error: 'Missing token.' })
    return
  }
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`)
  send(req, res, 200, { ok: true })
}

/* --------------------------- school proxy --------------------------- */

/**
 * Read-only JSON proxy for school portal APIs (Canvas, Moodle, D2L). School
 * servers almost never send CORS headers, so the browser cannot call them
 * directly — the backend forwards the student's own request instead.
 * Deliberately restricted: authenticated users only, http(s) only, private /
 * loopback targets blocked (unless SCHOOL_PROXY_ALLOW_LOOPBACK=1 is set for
 * local testing), a small header allowlist, a response cap, and a timeout.
 */
const SCHOOL_PROXY_ALLOW_LOOPBACK = process.env.SCHOOL_PROXY_ALLOW_LOOPBACK === '1'
const SCHOOL_PROXY_HEADER_ALLOWLIST = new Set(['authorization', 'x-auth-token', 'x-api-key', 'accept', 'user-agent'])

function isBlockedSchoolHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host.startsWith('::ffff:')) {
    return !SCHOOL_PROXY_ALLOW_LOOPBACK
  }
  const ipv4 = host.split('.').map(Number)
  if (ipv4.length === 4 && ipv4.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = ipv4
    if (a === 127) return !SCHOOL_PROXY_ALLOW_LOOPBACK // loopback
    if (a === 10) return true // private
    if (a === 169 && b === 254) return true // link-local
    if (a === 172 && b >= 16 && b <= 31) return true // private
    if (a === 192 && b === 168) return true // private
  }
  return false
}

async function proxyToSchool(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const userId = bearerUserId(req)
  if (!userId) {
    send(req, res, 401, { error: 'Session expired. Sign in again.' })
    return
  }
  const body = await readBody(req, 16_000)
  const url = typeof body.url === 'string' ? body.url.trim() : ''
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    send(req, res, 400, { error: 'Invalid URL.' })
    return
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    send(req, res, 400, { error: 'Only http(s) URLs are supported.' })
    return
  }
  if (isBlockedSchoolHost(parsed.hostname)) {
    send(req, res, 403, { error: 'That target is not allowed.' })
    return
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body.headers && typeof body.headers === 'object') {
    for (const [key, value] of Object.entries(body.headers as Record<string, unknown>)) {
      const name = key.toLowerCase()
      if (typeof value === 'string' && SCHOOL_PROXY_HEADER_ALLOWLIST.has(name)) headers[name] = value
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(url, { method: 'GET', headers, redirect: 'follow', signal: controller.signal })
    const text = await response.text()
    // Always 200 from this endpoint: the school's own status is carried in the
    // envelope so the client can classify auth/not-found errors precisely.
    send(req, res, 200, {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get('content-type') || '',
      body: text.slice(0, 500_000),
    })
  } catch {
    send(req, res, 200, { status: 0, ok: false, contentType: '', body: '' })
  } finally {
    clearTimeout(timer)
  }
}

/* -------------------------------- routes ------------------------------ */

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  let pathname = url.pathname
  // Accept both /auth/me (native) and /api/auth/me (browser same-origin when
  // the backend serves the website).
  if (pathname.startsWith('/api')) pathname = pathname.slice(4) || '/'
  const method = req.method || 'GET'

  try {
    if (method === 'OPTIONS') {
      res.writeHead(204, corsHeaders(req))
      res.end()
      return
    }

    if (method === 'GET' && pathname === '/health') {
      send(req, res, 200, { status: 'ok', service: 'studyflow-backend', aiConfigured: Boolean(AI_API_KEY), model: AI_MODEL })
      return
    }

    /* ---- Google OAuth loopback landing page (public) ---- */
    if (method === 'GET' && pathname === '/oauth/callback') {
      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      const state = url.searchParams.get('state') || ''
      sendHtml(req, res, oauthCallbackPage(state, code, error))
      return
    }

    /* ---- Google token/refresh/revoke proxies (StudyFlow auth) ---- */
    if (method === 'POST' && (pathname === '/oauth/token' || pathname === '/oauth/refresh')) {
      await proxyToGoogleToken(req, res)
      return
    }
    if (method === 'POST' && pathname === '/oauth/revoke') {
      await proxyToGoogleRevoke(req, res)
      return
    }

    /* ---- accounts ---- */
    if (method === 'POST' && pathname === '/auth/register') {
      if (rateLimited(req.socket.remoteAddress || 'anon')) {
        send(req, res, 429, { error: 'Too many attempts. Try again in a minute.' })
        return
      }
      const body = await readBody(req)
      const name = String(body.name || '').trim().slice(0, 80)
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      if (!name) { send(req, res, 400, { error: 'Please enter your name.' }); return }
      if (!EMAIL_RE.test(email)) { send(req, res, 400, { error: 'Please enter a valid email address.' }); return }
      if (password.length < 8) { send(req, res, 400, { error: 'Password must be at least 8 characters.' }); return }
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined
      if (existing) { send(req, res, 409, { error: 'An account with that email already exists. Sign in instead.' }); return }
      const id = crypto.randomUUID()
      db.prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, email, name, hashPassword(password), nowIso())
      send(req, res, 201, { token: signToken(id), user: { id, email, name } })
      return
    }

    if (method === 'POST' && pathname === '/auth/login') {
      if (rateLimited(req.socket.remoteAddress || 'anon')) {
        send(req, res, 429, { error: 'Too many attempts. Try again in a minute.' })
        return
      }
      const body = await readBody(req)
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const row = db.prepare('SELECT id, name, password_hash FROM users WHERE email = ?').get(email) as
        | { id: string; name: string; password_hash: string }
        | undefined
      if (!row || !verifyPassword(password, row.password_hash)) {
        send(req, res, 401, { error: 'Incorrect email or password.' })
        return
      }
      send(req, res, 200, { token: signToken(row.id), user: { id: row.id, email, name: row.name } })
      return
    }

    if (method === 'GET' && pathname === '/auth/me') {
      const userId = bearerUserId(req)
      if (!userId) { send(req, res, 401, { error: 'Session expired. Sign in again.' }); return }
      const row = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(userId) as
        | { id: string; email: string; name: string }
        | undefined
      if (!row) { send(req, res, 401, { error: 'Account not found. Sign in again.' }); return }
      send(req, res, 200, { user: row })
      return
    }

    /* ---- per-user data ---- */
    if (method === 'GET' && pathname === '/data') {
      const userId = bearerUserId(req)
      if (!userId) { send(req, res, 401, { error: 'Session expired. Sign in again.' }); return }
      const row = db.prepare('SELECT payload FROM user_data WHERE user_id = ?').get(userId) as { payload: string } | undefined
      if (!row) { send(req, res, 200, { data: null }); return }
      try {
        send(req, res, 200, { data: JSON.parse(row.payload) })
      } catch {
        send(req, res, 200, { data: null })
      }
      return
    }

    if (method === 'PUT' && pathname === '/data') {
      const userId = bearerUserId(req)
      if (!userId) { send(req, res, 401, { error: 'Session expired. Sign in again.' }); return }
      // 4 MB headroom for assignment file attachments (small data: URLs).
      const body = await readBody(req, 4_000_000)
      const data = body.data
      if (!data || typeof data !== 'object') { send(req, res, 400, { error: 'Invalid data payload.' }); return }
      db.prepare(
        `INSERT INTO user_data (user_id, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      ).run(userId, JSON.stringify(data), nowIso())
      send(req, res, 200, { ok: true })
      return
    }

    /* ---- contact / support ---- */
    if (method === 'POST' && pathname === '/contact') {
      const userId = bearerUserId(req)
      if (!userId) { send(req, res, 401, { error: 'Session expired. Sign in again.' }); return }
      const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId) as { name: string; email: string } | undefined
      if (!user) { send(req, res, 401, { error: 'Account not found. Sign in again.' }); return }
      const body = await readBody(req)
      const subject = String(body.subject || '').trim().slice(0, 140)
      const message = String(body.message || '').trim().slice(0, 5000)
      if (!subject) { send(req, res, 400, { error: 'Please describe the problem in a few words.' }); return }
      if (!message) { send(req, res, 400, { error: 'Please describe what happened.' }); return }
      const id = crypto.randomUUID()
      db.prepare('INSERT INTO contact_messages (id, user_id, user_name, user_email, subject, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, userId, user.name, user.email, subject, message, nowIso())
      // Email the owner when a mail service is configured (messages are still
      // stored server-side either way — nothing is ever lost).
      let emailed = false
      if (RESEND_API_KEY && CONTACT_EMAIL_TO) {
        try {
          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'StudyFlow <onboarding@resend.dev>',
              to: [CONTACT_EMAIL_TO],
              subject: `[StudyFlow Support] ${subject}`,
              text: `From: ${user.name} <${user.email}>\n\n${message}`,
              reply_to: user.email,
            }),
          })
          emailed = emailRes.ok
        } catch {
          emailed = false
        }
      }
      send(req, res, 201, { ok: true, stored: true, emailed })
      return
    }

    /* Owner-only read access to support messages. Guarded by CONTACT_ADMIN_KEY
       (header X-Admin-Key or ?key=). Disabled until that key is configured. */
    if (method === 'GET' && pathname === '/contact') {
      const key = String(req.headers['x-admin-key'] || url.searchParams.get('key') || '')
      if (!CONTACT_ADMIN_KEY || key !== CONTACT_ADMIN_KEY) {
        send(req, res, 403, { error: 'Admin access is not configured or the key is wrong.' })
        return
      }
      const rows = db.prepare('SELECT id, user_name, user_email, subject, message, created_at FROM contact_messages ORDER BY created_at DESC LIMIT 200').all()
      send(req, res, 200, { messages: rows })
      return
    }

    /* ---- school portal proxy (Canvas / Moodle / D2L) ---- */
    if (method === 'POST' && pathname === '/school-proxy') {
      await proxyToSchool(req, res)
      return
    }

    /* ---- AI ---- */
    if (method === 'POST' && pathname === '/ai/chat') {
      const userId = bearerUserId(req)
      if (!userId) { send(req, res, 401, { error: 'Session expired. Sign in again.' }); return }
      const body = await readBody(req)
      const messages = body.messages
      const context = typeof body.context === 'string' ? body.context : ''
      if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
        send(req, res, 400, { error: 'Invalid messages payload.' })
        return
      }
      const answer = await runGroq([{ role: 'system', content: systemPrompt(context) }, ...messages])
      send(req, res, 200, { answer })
      return
    }

    // Serve the built website when present (also the SPA fallback).
    if (serveStatic(req, res, pathname)) return

    send(req, res, 404, { error: 'Not found.' })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Server error'
    if (message === 'Invalid JSON' || message === 'Payload too large') {
      send(req, res, 400, { error: message })
      return
    }
    const status = (e as { status?: number }).status || 500
    send(req, res, status, {
      error:
        status === 503 ? 'AI is temporarily unavailable.' :
        status === 502 ? 'The AI provider could not be reached.' :
        'Something went wrong on the server.',
    })
  }
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(() => {
    send(req, res, 500, { error: 'Something went wrong on the server.' })
  })
})

server.listen(PORT, HOST, () => {
  console.log(`StudyFlow backend listening on http://${HOST}:${PORT}`)
  console.log(`  data dir : ${DATA_DIR}`)
  console.log(`  static   : ${fs.existsSync(path.join(STATIC_DIR, 'index.html')) ? STATIC_DIR : 'not serving (no website build)'}`)
  console.log(`  ai       : ${AI_MODEL} (${AI_API_KEY ? 'configured' : 'NOT configured'})`)
})
