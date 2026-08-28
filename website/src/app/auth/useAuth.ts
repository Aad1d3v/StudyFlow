import { useCallback, useEffect, useState } from 'react'
import { ApiError, authApi, type AuthUser } from './api'
import { setSessionToken } from './session'

const TOKEN_KEY = 'studyflow.auth.token'

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [booting, setBooting] = useState<boolean>(() => Boolean(localStorage.getItem(TOKEN_KEY)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Restore a persisted session: validate the token against the backend.
  useEffect(() => {
    if (!token) {
      setBooting(false)
      setSessionToken(null)
      return
    }
    setSessionToken(token)
    let cancelled = false
    authApi
      .me()
      .then(({ user: me }) => {
        if (!cancelled) setUser(me)
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
      })
      .finally(() => {
        if (!cancelled) setBooting(false)
      })
    return () => {
      cancelled = true
    }
  }, [token])

  const applySession = useCallback((nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken)
    setSessionToken(nextToken)
    setToken(nextToken)
    setUser(nextUser)
    setError('')
  }, [])

  const signIn = useCallback(
    async (email: string, password: string) => {
      setBusy(true)
      setError('')
      try {
        const { token: t, user: u } = await authApi.login(email, password)
        applySession(t, u)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not reach the server. Is the backend running?')
      } finally {
        setBusy(false)
      }
    },
    [applySession],
  )

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      setBusy(true)
      setError('')
      try {
        const { token: t, user: u } = await authApi.register(name, email, password)
        applySession(t, u)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not reach the server. Is the backend running?')
      } finally {
        setBusy(false)
      }
    },
    [applySession],
  )

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setSessionToken(null)
    setToken(null)
    setUser(null)
    setError('')
  }, [])

  return { user, token, booting, busy, error, signIn, signUp, signOut }
}
