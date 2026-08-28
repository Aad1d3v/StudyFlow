import { useState } from 'react'
import { Check, Coffee, Play, Timer, X } from 'lucide-react'
import type { Assignment, FocusSession } from '../types'
import { fmtMinutes } from '../utils'
import { PageHeader } from '../components/ui'

export function Focus({
  focus,
  seconds,
  paused,
  setPaused,
  presetMinutes,
  setPresetMinutes,
  breakLeft,
  onFinish,
  onCancel,
  onSkipBreak,
  sessions,
}: {
  focus: Assignment | null
  seconds: number
  paused: boolean
  setPaused: (v: boolean) => void
  presetMinutes: number
  setPresetMinutes: (v: number) => void
  breakLeft: number | null
  onFinish: () => void
  onCancel: () => void
  onSkipBreak: () => void
  sessions: FocusSession[]
}) {
  const [custom, setCustom] = useState('45')
  const mins = Math.floor(Math.max(seconds, 0) / 60).toString().padStart(2, '0')
  const secs = (Math.max(seconds, 0) % 60).toString().padStart(2, '0')

  const recent = [...sessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 6)
  const totalMinutes = sessions.reduce((sum, s) => sum + Math.round(s.durationSeconds / 60), 0)

  return (
    <div className="page focus-page">
      <PageHeader eyebrow="DEEP WORK" title="Focus mode" subtitle="One task. A little progress. No pressure." />

      <div className="focus-card card">
        <div className="focus-orb"><Timer size={27} /></div>
        <p className="eyebrow">{focus ? focus.className.toUpperCase() : 'READY WHEN YOU ARE'}</p>
        <h2>{focus?.title || 'Choose a task to begin'}</h2>
        <div className="timer">{focus ? `${mins}:${secs}` : `${String(presetMinutes).padStart(2, '0')}:00`}</div>
        <p className="focus-note">
          {breakLeft !== null
            ? 'Break time. Stand up, stretch, drink some water.'
            : focus
              ? 'Your session is saved locally. You can stop whenever you need.'
              : 'Start a focus session from any assignment, or pick a duration below.'}
        </p>

        {breakLeft !== null ? (
          <div className="break-timer">
            <Coffee size={18} />
            <strong>{String(Math.floor(breakLeft / 60)).padStart(2, '0')}:{String(breakLeft % 60).padStart(2, '0')}</strong>
            <button className="secondary small" onClick={onSkipBreak}>Skip break</button>
          </div>
        ) : (
          <div className="focus-actions">
            {focus ? (
              <>
                <button className="secondary" onClick={() => setPaused(!paused)}>{paused ? <Play size={16} /> : 'Ⅱ'} {paused ? 'Resume' : 'Pause'}</button>
                <button className="primary" onClick={onFinish}><Check size={16} /> Finish session</button>
                <button className="icon-button" onClick={onCancel} aria-label="Exit session"><X size={18} /></button>
              </>
            ) : (
              <>
                <button className="primary" disabled><Play size={16} /> Start from Assignments</button>
                <div className="preset-row">
                  {[25, 50].map((p) => (
                    <button key={p} className={`preset ${presetMinutes === p ? 'active' : ''}`} onClick={() => { setPresetMinutes(p); setCustom(String(p)) }}>
                      {p} min
                    </button>
                  ))}
                  <input
                    className="preset-input"
                    type="number"
                    min="5"
                    max="180"
                    value={custom}
                    onChange={(e) => { setCustom(e.target.value); const n = Number(e.target.value); if (n >= 5) setPresetMinutes(n) }}
                    aria-label="Custom minutes"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {recent.length > 0 && (
        <section className="session-history">
          <div className="section-heading">
            <div>
              <p className="eyebrow">HISTORY</p>
              <h2>Recent sessions</h2>
            </div>
            <span className="status-badge">{fmtMinutes(totalMinutes)} total</span>
          </div>
          <div className="assignment-list">
            {recent.map((s) => (
              <div className="stream-item card" key={s.id}>
                <span className={`session-dot ${s.completed ? 'done' : 'stopped'}`} />
                <div className="stream-body">
                  <strong>{s.title}</strong>
                  <small>{s.className} · {new Date(s.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>
                </div>
                <span className="due-chip">{fmtMinutes(Math.round(s.durationSeconds / 60))}</span>
                <span className={`submit-badge ${s.completed ? 'turned-in' : ''}`}>{s.completed ? 'Completed' : 'Stopped'}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
