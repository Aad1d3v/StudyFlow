import { AlertTriangle, Check, RefreshCw, Sparkles, X } from 'lucide-react'
import type { Assignment, PlanBlock, PlanResult } from '../types'
import { dateKey, dateFromKey, fmtClock, fmtMinutes, startOfWeek } from '../utils'
import { Empty, PageHeader } from '../components/ui'

export function Planner({
  plan,
  suggestion,
  onAutoPlan,
  onAccept,
  onRegenerate,
  onCancel,
}: {
  plan: PlanBlock[]
  suggestion: PlanResult | null
  onAutoPlan: () => void
  onAccept: () => void
  onRegenerate: () => void
  onCancel: () => void
}) {
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek(new Date()).getTime() + i * 86400000)
    return d
  })
  const weekKeys = week.map((d) => dateKey(d))
  const planByDay = new Map<string, PlanBlock[]>()
  for (const b of plan) {
    const list = planByDay.get(b.date) || []
    list.push(b)
    planByDay.set(b.date, list)
  }

  const suggestionByDay = new Map<string, PlanBlock[]>()
  if (suggestion) {
    for (const b of suggestion.blocks) {
      const list = suggestionByDay.get(b.date) || []
      list.push(b)
      suggestionByDay.set(b.date, list)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="YOUR TIME"
        title="Planner"
        subtitle="A realistic view of how your week can flow."
        action={<button className="secondary" onClick={onAutoPlan}><Sparkles size={16} /> Auto plan</button>}
      />

      {suggestion && (
        <div className="suggestion card">
          <div className="suggestion-head">
            <div>
              <p className="eyebrow">SUGGESTED PLAN</p>
              <h2>{fmtMinutes(suggestion.workMinutes)} of work scheduled</h2>
            </div>
            <div className="suggestion-actions">
              <button className="primary small" onClick={onAccept}><Check size={14} /> Accept</button>
              <button className="secondary small" onClick={onRegenerate}><RefreshCw size={14} /> Regenerate</button>
              <button className="icon-button" onClick={onCancel} aria-label="Cancel suggestion"><X size={16} /></button>
            </div>
          </div>
          {suggestion.message && (
            <div className="overload-banner">
              <AlertTriangle size={15} />
              <span>{suggestion.message}</span>
            </div>
          )}
          {suggestion.unscheduled.length > 0 && (
            <div className="overload-banner subtle">
              <span>Could not schedule before their deadlines: {suggestion.unscheduled.join(', ')}</span>
            </div>
          )}
          <div className="suggestion-summary">
            <span><strong>{fmtMinutes(suggestion.workMinutes)}</strong> work</span>
            <span><strong>{fmtMinutes(suggestion.availableMinutes)}</strong> available</span>
            <span><strong>{suggestion.blocks.filter((b) => b.kind === 'focus').length}</strong> sessions</span>
          </div>
          <div className="plan-day-list">
            {Array.from(suggestionByDay.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([key, blocks]) => (
              <div className="plan-day" key={key}>
                <div className="plan-day-label">{formatDayLabel(key)}</div>
                <div className="plan-day-blocks">
                  {blocks.map((b) => (
                    <div className={`plan-row ${b.kind}`} key={b.id}>
                      <span className="plan-row-time">{fmtClock(b.startMinutes)}</span>
                      <span className="plan-row-line" />
                      <div>
                        <strong>{b.title}</strong>
                        <small>{b.durationMinutes} min{b.kind === 'break' ? ' · Break' : b.className ? ` · ${b.className}` : ''}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!suggestion && !plan.length && (
        <Empty
          title="No plan yet"
          text="Auto Plan analyzes your workload, deadlines, and available study time to build a realistic schedule."
          action={<button className="secondary" onClick={onAutoPlan}><Sparkles size={15} /> Auto plan</button>}
        />
      )}

      {plan.length > 0 && !suggestion && (
        <div className="planner-grid">
          {weekKeys.map((key) => {
            const day = dateFromKey(key)
            const blocks = planByDay.get(key) || []
            const today = key === dateKey(new Date())
            return (
              <div className={`day-column ${today ? 'today' : ''}`} key={key}>
                <div className="day-label">
                  {day.toLocaleDateString(undefined, { weekday: 'short' })} {day.getDate()}
                  {today && <span>Today</span>}
                </div>
                <div className="day-body">
                  {blocks.length ? blocks.sort((a, b) => a.startMinutes - b.startMinutes).map((b) => (
                    <div className={`plan-block ${b.kind === 'break' ? 'break' : 'purple'}`} key={b.id}>
                      <strong>{b.title}</strong>
                      <small>{fmtClock(b.startMinutes)} · {b.durationMinutes} min</small>
                    </div>
                  )) : (
                    <p className="day-empty">—</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatDayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = dateKey(new Date()) === key
  return today
    ? 'Today'
    : date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}
