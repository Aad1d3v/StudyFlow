import { useState } from 'react'
import { Plus, Target, Trash2 } from 'lucide-react'
import type { Assignment, FocusSession, Goal, GoalUnit } from '../types'
import { fmtMinutes, isSameWeek } from '../utils'
import { Empty, PageHeader } from '../components/ui'

function goalProgress(goal: Goal, sessions: FocusSession[], assignments: Assignment[]): { current: number; total: number; pct: number } {
  if (goal.unit === 'hours') {
    const current = Math.round(sessions.filter((s) => isSameWeek(new Date(s.startedAt))).reduce((sum, s) => sum + s.durationSeconds, 0) / 3600 * 10) / 10
    return { current, total: goal.target, pct: Math.min(100, Math.round((current / goal.target) * 100)) }
  }
  const current = assignments.filter((a) => a.completed && a.completedAt && isSameWeek(new Date(a.completedAt))).length
  return { current, total: goal.target, pct: Math.min(100, Math.round((current / goal.target) * 100)) }
}

export function Goals({
  goals,
  sessions,
  assignments,
  onAdd,
  onDelete,
}: {
  goals: Goal[]
  sessions: FocusSession[]
  assignments: Assignment[]
  onAdd: (goal: Omit<Goal, 'id' | 'createdAt'>) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('5')
  const [unit, setUnit] = useState<GoalUnit>('hours')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(target)
    if (!title.trim() || !num || num <= 0) return
    onAdd({ title: title.trim(), target: num, unit, period: 'week' })
    setTitle('')
    setTarget('5')
  }

  return (
    <div className="page">
      <PageHeader eyebrow="INTENTIONS" title="Goals" subtitle="Small, tracked intentions that keep your week on course." />
      <form className="goal-form card" onSubmit={submit}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Study 5 hours this week" aria-label="Goal title" required />
        <input className="goal-target" type="number" min="1" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Goal target" required />
        <select value={unit} onChange={(e) => setUnit(e.target.value as GoalUnit)} aria-label="Goal unit">
          <option value="hours">hours / week</option>
          <option value="tasks">tasks / week</option>
        </select>
        <button className="primary" type="submit"><Plus size={16} /> Add goal</button>
      </form>

      {!goals.length ? (
        <Empty title="No goals yet" text="Set a small weekly intention — like studying a certain number of hours — and watch the progress fill in automatically." />
      ) : (
        <div className="goal-list">
          {goals.map((g) => {
            const { current, total, pct } = goalProgress(g, sessions, assignments)
            return (
              <div className="goal-card card" key={g.id}>
                <div className="goal-head">
                  <div className="goal-icon"><Target size={17} /></div>
                  <div>
                    <strong>{g.title}</strong>
                    <small>{g.unit === 'hours' ? `${current}h of ${total}h this week` : `${current} of ${total} tasks this week`}</small>
                  </div>
                  <button className="icon-button danger" onClick={() => onDelete(g.id)} aria-label={`Delete ${g.title}`}><Trash2 size={15} /></button>
                </div>
                <div className="goal-bar"><span style={{ width: `${pct}%` }} /></div>
                <p className="goal-pct">{pct}%</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="analytics-note card">
        {fmtMinutes(sessions.filter((s) => isSameWeek(new Date(s.startedAt))).reduce((sum, s) => sum + Math.round(s.durationSeconds / 60), 0))} of focused work recorded this week.
      </div>
    </div>
  )
}
