import { useState } from 'react'
import { ArrowRight, GraduationCap, Loader2, Lock, Mail, Sparkles, Timer, User } from 'lucide-react'
import { APP_CONFIG } from '../config'

type Mode = 'signin' | 'signup'

export function AuthPage({
  busy,
  error,
  onSignIn,
  onSignUp,
}: {
  busy: boolean
  error: string
  onSignIn: (email: string, password: string) => void
  onSignUp: (name: string, email: string, password: string) => void
}) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [localError, setLocalError] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (mode === 'signup') {
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters.')
        return
      }
      if (password !== confirm) {
        setLocalError('Passwords do not match.')
        return
      }
    }
    setLocalError('')
    if (mode === 'signin') onSignIn(email.trim(), password)
    else onSignUp(name.trim(), email.trim(), password)
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setLocalError('')
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="auth-brand">
          <div className="brand-mark"><Sparkles size={18} /></div>
          <strong>{APP_CONFIG.name}</strong>
        </div>
        <h1>Your schoolwork,<br />organized automatically.</h1>
        <p className="auth-hero-copy">
          Sign in once and StudyFlow keeps your assignments, plans, focus history, and AI
          recommendations in sync — so nothing you do is ever lost.
        </p>
        <ul className="auth-features">
          <li><GraduationCap size={16} /> Google Classroom sync</li>
          <li><Timer size={16} /> Focus mode with real analytics</li>
          <li><Sparkles size={16} /> AI that plans your workload</li>
        </ul>
      </div>

      <div className="auth-panel">
        <form className="auth-card card" onSubmit={submit}>
          <div className="auth-tabs">
            <button type="button" className={`auth-tab ${mode === 'signin' ? 'active' : ''}`} onClick={() => switchMode('signin')}>Sign in</button>
            <button type="button" className={`auth-tab ${mode === 'signup' ? 'active' : ''}`} onClick={() => switchMode('signup')}>Create account</button>
          </div>

          {mode === 'signup' && (
            <label className="auth-field">
              <User size={15} />
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required />
            </label>
          )}
          <label className="auth-field">
            <Mail size={15} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" type="email" autoComplete="email" required />
          </label>
          <label className="auth-field">
            <Lock size={15} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required />
          </label>
          {mode === 'signup' && (
            <>
              <label className="auth-field">
                <Lock size={15} />
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" type="password" autoComplete="new-password" required />
              </label>
              <p className="auth-hint">Use at least 8 characters. Your password is hashed and never stored in plain text.</p>
            </>
          )}

          {(localError || error) && <p className="auth-error">{localError || error}</p>}

          <button className="primary full" type="submit" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <ArrowRight size={16} />}
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

          <p className="auth-note">
            {mode === 'signin' ? (
              <>New to {APP_CONFIG.name}? <button type="button" className="text-button" onClick={() => switchMode('signup')}>Create an account</button></>
            ) : (
              <>Already have an account? <button type="button" className="text-button" onClick={() => switchMode('signin')}>Sign in</button></>
            )}
          </p>
          <small className="auth-footnote">
            Your password is hashed and never stored in plain text. You can export or delete your data at any time from Settings.
          </small>
          <small className="auth-footnote">Made by Aadidev Prasanth</small>
        </form>
      </div>
    </div>
  )
}
