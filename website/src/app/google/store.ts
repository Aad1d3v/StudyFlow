export type StoredSession = {
  accessToken: string
  refreshToken?: string
  email: string
  name: string
  expiresAt: number
}

const SESSION_KEY = 'studyflow.session'
const LAST_SYNCED_KEY = 'studyflow.lastSyncedAt'

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function loadSession(): StoredSession | null {
  return safeParse<StoredSession>(localStorage.getItem(SESSION_KEY))
}

export function saveSession(session: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function loadLastSynced(): string | null {
  return localStorage.getItem(LAST_SYNCED_KEY)
}

export function saveLastSynced(): string {
  const now = new Date().toISOString()
  localStorage.setItem(LAST_SYNCED_KEY, now)
  return now
}
