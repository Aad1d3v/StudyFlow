import type { Assignment, Priority, SubmissionState } from '../types'
import type { StoredSession } from './store'
import { APP_CONFIG } from '../config'
import { postOauthProxy } from '../auth/api'

export type SyncStatus = 'unconfigured' | 'signed-out' | 'syncing' | 'synced' | 'failed' | 'auth-required' | 'offline'

export type SyncProgressStep = { id: string; label: string; state: 'pending' | 'active' | 'done' | 'skipped' }

export type CourseInfo = { id: string; name: string; section?: string }

export type SyncSummary = { courses: number; assignments: number; added: number; updated: number; restricted: number }

export type SyncResult = {
  assignments: Assignment[]
  courses: CourseInfo[]
  restricted: string[]
}

/** Only the Classroom permissions the implemented features actually use. */
export const CLASSROOM_SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.student-submissions.me.readonly',
].join(' ')

export class SyncError extends Error {
  status: SyncStatus
  constructor(status: SyncStatus, message: string) {
    super(message)
    this.name = 'SyncError'
    this.status = status
  }
}

export function isUserCancelled(e: unknown): boolean {
  const message = e instanceof Error ? e.message.toLowerCase() : ''
  return message.includes('popup_closed') || message.includes('access_denied')
}

export function classifyError(e: unknown): { status: SyncStatus; message: string } {
  if (e instanceof SyncError) return { status: e.status, message: e.message }
  if (!navigator.onLine) return { status: 'offline', message: "You're offline. Your saved information is still available." }
  const err = e as { httpStatus?: number }
  if (err.httpStatus === 401) return { status: 'auth-required', message: 'Your Google session has expired. Reconnect your account to continue syncing.' }
  if (err.httpStatus === 403) return { status: 'failed', message: 'Google did not allow access to some of this information. Your school may restrict certain classes.' }
  if (err.httpStatus === 429) return { status: 'failed', message: 'Google is rate-limiting requests right now. Wait a moment and try again.' }
  return { status: 'failed', message: 'Could not synchronize Google Classroom. Your existing data is still available.' }
}

/* ------------------------------------------------------------------ */
/* Desktop OAuth flow (official installed-app flow, RFC 8252)          */
/*   - PKCE (S256) code verifier/challenge                             */
/*   - Loopback redirect URI (http://127.0.0.1:port)                   */
/*   - No client secret (desktop clients cannot keep secrets)          */
/*   - access_type=offline → refresh token keeps the session alive     */
/* ------------------------------------------------------------------ */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'

/**
 * Token exchange, refresh, and revoke are proxied through the StudyFlow
 * backend: Google's token endpoint sends no CORS headers (blocking both the
 * browser dev flow and the packaged WebView2), and the backend works in both.
 */
const TOKEN_PATH = '/oauth/token'
const REFRESH_PATH = '/oauth/refresh'
const REVOKE_PATH = '/oauth/revoke'

export const OAUTH_RESULT_MESSAGE = 'studyflow:oauth-result'

export type DesktopAuthResult = {
  accessToken: string
  refreshToken?: string
  idToken?: string
  expiresIn: number
  email: string
  name: string
}

/** Message the backend callback page posts back: carries the auth code. */
export type OAuthResultMessage = {
  type: string
  state: string
  ok: boolean
  payload?: { code: string } | null
  error?: string
}

const PENDING_KEY = 'studyflow.oauth.pending'

type PendingAuth = { state: string; verifier: string }

const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

function randomUnreserved(length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += UNRESERVED[bytes[i] % UNRESERVED.length]
  return out
}

function b64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64UrlEncode(new Uint8Array(digest))
}

export function buildAuthUrl(clientId: string, redirectUri: string, challenge: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: CLASSROOM_SCOPES,
    access_type: 'offline',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

async function postForm(path: string, params: Record<string, string>): Promise<{ ok: boolean; data: Record<string, unknown>; httpStatus: number }> {
  const result = await postOauthProxy(path, params)
  if (result.httpStatus === 0) {
    throw new SyncError('failed', 'Could not reach the StudyFlow backend. Is it running on port 8787?')
  }
  return result
}

async function exchangeCode(clientId: string, redirectUri: string, code: string, verifier: string): Promise<{ accessToken: string; refreshToken?: string; idToken?: string; expiresIn: number }> {
  const { ok, data, httpStatus } = await postForm(TOKEN_PATH, {
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  })
  if (!ok || !data.access_token) {
    const error = typeof data.error === 'string' ? data.error : ''
    const description = typeof data.error_description === 'string' ? data.error_description : ''
    if (error === 'invalid_grant') throw new SyncError('auth-required', 'Google could not verify the sign-in. Please try again.')
    if (httpStatus === 429) throw new SyncError('failed', 'Google is rate-limiting requests right now. Wait a moment and try again.')
    throw new SyncError('failed', `Google sign-in did not complete.${description ? ` ${description}` : ' Please try again.'}`)
  }
  return {
    accessToken: data.access_token as string,
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    idToken: typeof data.id_token === 'string' ? data.id_token : undefined,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 3600,
  }
}

export async function refreshAccessToken(clientId: string, refreshToken: string): Promise<{ accessToken: string; expiresIn: number; idToken?: string }> {
  const { ok, data } = await postForm(REFRESH_PATH, {
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  if (!ok || !data.access_token) throw new SyncError('auth-required', 'Your Google session has expired. Reconnect your account to continue syncing.')
  return {
    accessToken: data.access_token as string,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 3600,
    idToken: typeof data.id_token === 'string' ? data.id_token : undefined,
  }
}

export async function revokeToken(token: string): Promise<void> {
  try {
    await postOauthProxy(REVOKE_PATH, { token })
  } catch {
    // Revocation is best-effort; clearing the local session always proceeds.
  }
}

/**
 * Opens the Google sign-in page in a popup. Google redirects to the backend's
 * loopback callback page, which posts the authorization code back here via
 * postMessage and closes itself; this function exchanges the code for tokens
 * through the backend proxy. Works identically in the browser and the
 * packaged desktop app (both fetch the backend, never Google directly).
 */
export async function connectDesktop(clientId: string): Promise<DesktopAuthResult> {
  if (!clientId) throw new SyncError('unconfigured', 'Google integration is not configured. Set VITE_GOOGLE_CLIENT_ID to connect.')
  const redirectUri = APP_CONFIG.oauthRedirectUri
  const verifier = randomUnreserved(64)
  const challenge = await pkceChallenge(verifier)
  const state = randomUnreserved(32)
  const pending: PendingAuth = { state, verifier }
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))

  const url = buildAuthUrl(clientId, redirectUri, challenge, state)
  const popup = window.open(url, 'studyflow-oauth', 'popup=yes,width=520,height=620')
  if (!popup) {
    sessionStorage.removeItem(PENDING_KEY)
    throw new SyncError('failed', 'The Google sign-in window could not open. Your browser may be blocking pop-ups.')
  }

  return new Promise<DesktopAuthResult>((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(timer)
    }
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }
    const onMessage = (event: MessageEvent) => {
      const msg = event.data as OAuthResultMessage | null
      if (!msg || msg.type !== OAUTH_RESULT_MESSAGE) return
      if (msg.state !== state) {
        finish(() => reject(new SyncError('failed', 'Sign-in state did not match. Please try again.')))
        return
      }
      finish(() => {
        if (msg.ok && msg.payload?.code) {
          exchangeCode(clientId, redirectUri, msg.payload.code, verifier)
            .then(async (tokens) => {
              const profile = await fetchProfile(tokens.accessToken, tokens.idToken)
              resolve({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                idToken: tokens.idToken,
                expiresIn: tokens.expiresIn,
                email: profile.email,
                name: profile.name,
              })
            })
            .catch((e) => reject(e instanceof Error ? e : new SyncError('failed', 'Google sign-in did not complete. Please try again.')))
        } else if (msg.error === 'access_denied') reject(new SyncError('failed', 'Access was denied. You can keep using StudyFlow without Google.'))
        else reject(new SyncError('failed', msg.error || 'Google sign-in did not complete. Please try again.'))
      })
    }
    const timer = window.setInterval(() => {
      if (popup.closed) {
        finish(() => reject(new SyncError('failed', 'The Google sign-in window was closed before you finished. Try again when you are ready.')))
      }
    }, 500)
    window.addEventListener('message', onMessage)
  })
}



/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

function decodeJwt(token: string): Record<string, unknown> {
  const payload = token.split('.')[1]
  if (!payload) return {}
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  )
  return JSON.parse(json) as Record<string, unknown>
}

export async function fetchProfile(token: string, idToken?: string): Promise<{ name: string; email: string }> {
  if (idToken) {
    try {
      const payload = decodeJwt(idToken)
      const email = typeof payload.email === 'string' ? payload.email : ''
      if (email) {
        const name = typeof payload.name === 'string' && payload.name ? payload.name : email.split('@')[0] || 'Connected account'
        return { name, email }
      }
    } catch {
      // fall through to the tokeninfo endpoint
    }
  }
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`)
    if (response.ok) {
      const info = (await response.json()) as { email?: string }
      if (info.email) return { name: info.email.split('@')[0] || 'Connected account', email: info.email }
    }
  } catch {
    // fall back to a neutral label
  }
  return { name: 'Connected account', email: 'Google account' }
}

/** Builds a persisted session record from a fresh desktop-flow result. */
export function buildSession(result: DesktopAuthResult): StoredSession {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: Date.now() + result.expiresIn * 1000,
    email: result.email,
    name: result.name,
  }
}

/** Silently refreshes an expired session using its refresh token. */
export async function refreshSession(session: StoredSession, clientId: string): Promise<StoredSession> {
  if (!session.refreshToken) throw new SyncError('auth-required', 'Your Google session has expired. Reconnect your account to continue syncing.')
  const refreshed = await refreshAccessToken(clientId, session.refreshToken)
  return {
    ...session,
    accessToken: refreshed.accessToken,
    expiresAt: Date.now() + refreshed.expiresIn * 1000,
  }
}

/* ------------------------------------------------------------------ */
/* Google Classroom API (official REST v1)                             */
/* ------------------------------------------------------------------ */

type ApiError = Error & { httpStatus?: number; apiStatus?: string }

async function apiGet<T>(path: string, token: string): Promise<T> {
  let response: Response
  try {
    response = await fetch(`https://classroom.googleapis.com/v1${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new SyncError('offline', "You're offline. Your saved information is still available.")
  }
  if (!response.ok) {
    let apiStatus = `HTTP ${response.status}`
    let message = ''
    try {
      const body = (await response.json()) as { error?: { status?: string; message?: string } }
      apiStatus = body?.error?.status || apiStatus
      message = body?.error?.message || ''
    } catch {
      // keep defaults
    }
    const err = new Error(message) as ApiError
    err.httpStatus = response.status
    err.apiStatus = apiStatus
    throw err
  }
  return response.json() as Promise<T>
}

type Course = { id: string; name: string; section?: string; courseState?: string }
type DateParts = { year: number; month: number; day: number }
type TimeParts = { hours: number; minutes: number }
type CourseWorkItem = {
  id: string
  courseId: string
  title?: string
  description?: string
  state?: string
  dueDate?: DateParts
  dueTime?: TimeParts
  alternateLink?: string
  maxPoints?: number
}
type Submission = { state?: SubmissionState }

async function listCourses(token: string): Promise<Course[]> {
  const all: Course[] = []
  let pageToken: string | undefined
  do {
    const query = `courseStates=ACTIVE&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
    const page = await apiGet<{ courses?: Course[]; nextPageToken?: string }>(`/courses?${query}`, token)
    all.push(...(page.courses || []))
    pageToken = page.nextPageToken
  } while (pageToken)
  return all
}

async function listCourseWork(courseId: string, token: string): Promise<CourseWorkItem[]> {
  const all: CourseWorkItem[] = []
  let pageToken: string | undefined
  do {
    const query = `courseWorkStates=PUBLISHED&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
    const page = await apiGet<{ courseWork?: CourseWorkItem[]; nextPageToken?: string }>(
      `/courses/${courseId}/courseWork?${query}`,
      token,
    )
    all.push(...(page.courseWork || []))
    pageToken = page.nextPageToken
  } while (pageToken)
  return all
}

async function getSubmissionState(courseId: string, courseWorkId: string, token: string): Promise<SubmissionState | undefined> {
  try {
    const page = await apiGet<{ studentSubmissions?: Submission[] }>(
      `/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions?userId=me&pageSize=1`,
      token,
    )
    return page.studentSubmissions?.[0]?.state
  } catch {
    // Submission status is optional; never fail the whole sync for one item.
    return undefined
  }
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

function dueMeta(dueDate?: DateParts, dueTime?: TimeParts): { iso?: string; label: string; days: number } {
  if (!dueDate) return { label: 'No due date', days: 99 }
  const now = startOfToday()
  const due = new Date(dueDate.year, dueDate.month - 1, dueDate.day)
  const days = Math.round((due.getTime() - now.getTime()) / 86400000)
  let label: string
  if (days < 0) label = 'Overdue'
  else if (days === 0) label = 'Today'
  else if (days === 1) label = 'Tomorrow'
  else if (days < 7) label = `In ${days} days`
  else label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return { iso: due.toISOString(), label, days }
}

function derivePriority(dueInDays: number): Priority {
  if (dueInDays <= 2) return 'High'
  if (dueInDays <= 5) return 'Medium'
  return 'Low'
}

function toAssignment(course: Course, item: CourseWorkItem, submissionState?: SubmissionState): Assignment {
  const due = dueMeta(item.dueDate, item.dueTime)
  return {
    id: `cc:${course.id}:${item.id}`,
    providerId: item.id,
    courseId: course.id,
    title: item.title || 'Untitled assignment',
    className: course.name,
    dueLabel: due.label,
    dueInDays: due.days,
    dueDateIso: due.iso,
    priority: derivePriority(due.days),
    completed: false,
    source: 'Google Classroom',
    notes: '',
    description: item.description || '',
    alternateLink: item.alternateLink,
    submissionState,
    maxPoints: item.maxPoints,
    updatedAt: new Date().toISOString(),
  }
}

function isPermissionError(e: unknown): boolean {
  return (e as ApiError)?.httpStatus === 403
}

/**
 * Full sync: courses → published coursework → submission status → local model.
 * A failed sync never touches existing local data; callers decide how to merge.
 */
export async function syncClassroom(
  token: string,
  onProgress: (stepId: string, state: SyncProgressStep['state']) => void,
): Promise<SyncResult> {
  onProgress('connect', 'done')
  onProgress('courses', 'active')
  const courses = await listCourses(token)
  onProgress('courses', 'done')
  onProgress('coursework', 'active')

  const assignments: Assignment[] = []
  const restricted: string[] = []

  for (const course of courses) {
    let items: CourseWorkItem[]
    try {
      items = await listCourseWork(course.id, token)
    } catch (e) {
      if (isPermissionError(e)) {
        // The student may not be permitted to see coursework for this course.
        restricted.push(course.name)
        continue
      }
      throw e
    }
    onProgress('submissions', 'active')
    for (const item of items) {
      const submissionState = await getSubmissionState(course.id, item.id, token)
      assignments.push(toAssignment(course, item, submissionState))
    }
  }

  onProgress('submissions', 'done')
  onProgress('organize', 'done')

  return { assignments, courses, restricted }
}
