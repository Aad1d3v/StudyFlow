import { useCallback, useEffect, useRef, useState } from 'react'
import type { Assignment } from '../data'
import { buildSession, classifyError, connectDesktop, isUserCancelled, refreshSession, revokeToken, syncClassroom } from './sync'
import type { SyncProgressStep, SyncStatus, SyncSummary } from './sync'
import { clearSession, loadLastSynced, loadSession, saveLastSynced, saveSession, StoredSession } from './store'

export const AUTO_SYNC_MS = 5 * 60 * 1000

const DEFAULT_STEPS: SyncProgressStep[] = [
  { id: 'connect', label: 'Connecting to Google', state: 'pending' },
  { id: 'courses', label: 'Loading classes', state: 'pending' },
  { id: 'coursework', label: 'Loading assignments', state: 'pending' },
  { id: 'submissions', label: 'Checking submission status', state: 'pending' },
  { id: 'organize', label: 'Organizing your workload', state: 'pending' },
]

export type ClassroomController = ReturnType<typeof useClassroom>

export function useClassroom(opts: {
  clientId: string
  onSyncResult: (items: Assignment[]) => { added: number; updated: number }
}) {
  const [session, setSession] = useState<StoredSession | null>(() => loadSession())
  const sessionRef = useRef(session)
  sessionRef.current = session

  const [status, setStatus] = useState<SyncStatus>(() =>
    opts.clientId ? (loadSession() ? 'synced' : 'signed-out') : 'unconfigured',
  )
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => loadLastSynced())
  const [progress, setProgress] = useState<SyncProgressStep[]>(DEFAULT_STEPS)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<SyncSummary | null>(null)
  const [autoSync, setAutoSync] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  const setStep = useCallback((stepId: string, state: SyncProgressStep['state']) => {
    setProgress((prev) => prev.map((s) => (s.id === stepId ? { ...s, state } : s)))
  }, [])

  const runSync = useCallback(async () => {
    if (syncingRef.current) return
    if (!navigator.onLine) {
      setStatus('offline')
      setError("You're offline. Your saved information is still available.")
      return
    }
    let current = sessionRef.current
    if (!current?.accessToken) {
      setStatus('auth-required')
      setError('Connect your Google account to sync Classroom.')
      return
    }
    if (current.expiresAt < Date.now() + 60_000) {
      if (current.refreshToken && opts.clientId) {
        try {
          // Silent refresh — keeps auto-sync alive past the ~1h token lifetime.
          const refreshed = await refreshSession(current, opts.clientId)
          saveSession(refreshed)
          sessionRef.current = refreshed
          setSession(refreshed)
          current = refreshed
        } catch {
          setStatus('auth-required')
          setError('Your Google session has expired. Reconnect your account to continue syncing.')
          return
        }
      } else {
        setStatus('auth-required')
        setError('Your Google session has expired. Reconnect your account to continue syncing.')
        return
      }
    }

    syncingRef.current = true
    setSyncing(true)
    setError(null)
    setStatus('syncing')
    setProgress(DEFAULT_STEPS.map((s) => ({ ...s, state: 'pending' })))
    try {
      const { assignments, courses, restricted } = await syncClassroom(current.accessToken, (id, state) => setStep(id, state))
      const { added, updated } = opts.onSyncResult(assignments)
      setSummary({ courses: courses.length, assignments: assignments.length, added, updated, restricted: restricted.length })
      setLastSyncedAt(saveLastSynced())
      setStatus('synced')
    } catch (e) {
      const classified = classifyError(e)
      setStatus(classified.status)
      setError(classified.message)
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [opts])

  const runSyncRef = useRef(runSync)
  runSyncRef.current = runSync

  const bootedRef = useRef(false)
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    if (opts.clientId && loadSession() && autoSync) {
      // Resume with a background sync shortly after launch.
      const timer = window.setTimeout(() => runSyncRef.current(), 1500)
      return () => window.clearTimeout(timer)
    }
  }, [opts.clientId, autoSync])

  useEffect(() => {
    if (!autoSync || !sessionRef.current) return
    const id = window.setInterval(() => {
      if (syncingRef.current) return
      runSyncRef.current()
    }, AUTO_SYNC_MS)
    return () => window.clearInterval(id)
  }, [autoSync])

  const connect = useCallback(async () => {
    setError(null)
    setStatus('syncing')
    setProgress(DEFAULT_STEPS.map((s, i) => ({ ...s, state: i === 0 ? 'active' : 'pending' })))
    syncingRef.current = true
    setSyncing(true)
    try {
      const previous = sessionRef.current
      const result = await connectDesktop(opts.clientId)
      // Desktop clients sometimes omit a second refresh token; keep the old one.
      const next = buildSession({ ...result, refreshToken: result.refreshToken || previous?.refreshToken })
      saveSession(next)
      sessionRef.current = next
      setSession(next)
      // Release the connecting guard so runSync can drive the actual sync.
      syncingRef.current = false
      setSyncing(false)
      await runSync()
    } catch (e) {
      if (!isUserCancelled(e)) {
        const classified = classifyError(e)
        setStatus(classified.status)
        setError(classified.message)
      } else {
        setStatus(opts.clientId ? 'signed-out' : 'unconfigured')
        setError(null)
      }
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }, [opts.clientId, runSync])

  const disconnect = useCallback(() => {
    const token = sessionRef.current?.accessToken
    if (token) {
      revokeToken(token).catch(() => undefined)
    }
    clearSession()
    sessionRef.current = null
    setSession(null)
    setStatus('signed-out')
    setError(null)
    setSummary(null)
    setLastSyncedAt(null)
  }, [])

  return {
    session,
    status,
    syncing,
    error,
    summary,
    lastSyncedAt,
    progress,
    autoSync,
    setAutoSync,
    connect,
    disconnect,
    runSync,
  }
}
