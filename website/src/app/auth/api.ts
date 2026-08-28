import { getSessionToken } from './session'
import { APP_CONFIG } from '../config'
import type { Assignment, EarnedAchievement, FocusSession, Goal, GradeClass, HelpChat, LetterToSelf, PlanBlock, SchoolConnection, SchoolYear, StudentProfile } from '../types'

export type AuthUser = { id: string; email: string; name: string }

export type UserDataPayload = {
  assignments: Assignment[]
  sessions: FocusSession[]
  goals: Goal[]
  plan: PlanBlock[]
  schoolYear?: SchoolYear
  letters?: LetterToSelf[]
  helpChats?: HelpChat[]
  achievements?: EarnedAchievement[]
  grades?: GradeClass[]
  schools?: Record<string, SchoolConnection>
  profile?: StudentProfile
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  const token = getSessionToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${APP_CONFIG.apiBase}/api${path}`, { ...options, headers })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const message = (body as { error?: string } | null)?.error || `Request failed (${res.status})`
    throw new ApiError(message, res.status)
  }
  return body as T
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: AuthUser }>('/auth/me'),

  getData: () => request<{ data: UserDataPayload | null }>('/data'),

  putData: (data: UserDataPayload) =>
    request<{ ok: true }>('/data', { method: 'PUT', body: JSON.stringify({ data }) }),

  chat: (messages: unknown[], context: string, signal?: AbortSignal) =>
    request<{ answer: string }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, context }),
      signal,
    }),

  sendContact: (subject: string, message: string) =>
    request<{ ok: true; stored: boolean; emailed: boolean }>('/contact', {
      method: 'POST',
      body: JSON.stringify({ subject, message }),
    }),

  /** Forward a GET to a school portal through the backend (CORS-free). */
  schoolProxy: (url: string, headers: Record<string, string>) =>
    request<{ status: number; ok: boolean; contentType: string; body: string }>('/school-proxy', {
      method: 'POST',
      body: JSON.stringify({ url, headers }),
    }),
}

/**
 * Google OAuth token calls go through the backend proxy (Google's token
 * endpoint sends no CORS headers, and the packaged app has no dev-server
 * proxy). Returns the raw status so sync.ts can classify Google errors.
 */
export async function postOauthProxy(
  path: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; data: Record<string, unknown>; httpStatus: number }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getSessionToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let response: Response
  try {
    response = await fetch(`${APP_CONFIG.apiBase}/api${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    })
  } catch {
    return { ok: false, data: {}, httpStatus: 0 }
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: response.ok, data, httpStatus: response.status }
}
