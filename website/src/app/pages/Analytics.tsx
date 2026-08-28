import { BarChart3, Check, Clock3, Timer } from 'lucide-react'
import type { Assignment, FocusSession } from '../types'
import { fmtMinutes, isSameWeek } from '../utils'
import { PageHeader, Stat } from '../components/ui'

export function Analytics({ assignments, sessions }: { assignments: Assignment[]; sessions: FocusSession[] }) {
  const completed = assignments.filter((a) => a.completed).length
  const weekSessions = sessions.filter((s) => isSameWeek(new Date(s.startedAt)))
  const totalFocusMinutes = weekSessions.reduce((sum, s) => sum + Math.round(s.durationSeconds / 60), 0)
  const avgSession = weekSessions.length ? Math.round(totalFocusMinutes / weekSessions.length) : 0

  const completedWithDue = assignments.filter((a) => a.completed && a.dueDateIso && a.completedAt)
  const onTime = completedWithDue.filter((a) => new Date(a.completedAt!) <= new Date(a.dueDateIso!)).length
  const onTimeRate = completedWithDue.length ? Math.round((onTime / completedWithDue.length) * 100) : null

  const weekWorkload = assignments
    .filter((a) => !a.completed && a.dueInDays >= 0 && a.dueInDays < 7)
    .reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0)

  return (
    <div className="page">
      <PageHeader eyebrow="YOUR PROGRESS" title="Analytics" subtitle="Small patterns that help you work with more intention." />
      <div className="analytics-hero card">
        <div>
          <p className="eyebrow">THIS WEEK</p>
          <h2>You're building momentum.</h2>
          <p>Keep showing up consistently. Completion is about progress, not perfection.</p>
        </div>
        <div className="progress-ring">
          <strong>{completed}/{assignments.length}</strong>
          <small>tasks done</small>
        </div>
      </div>
      <div className="stat-grid">
        <Stat icon={<Check />} value={String(completed)} label="Tasks completed" tone="green" />
        <Stat icon={<Clock3 />} value={fmtMinutes(totalFocusMinutes)} label="Focus time this week" tone="purple" />
        <Stat icon={<BarChart3 />} value={onTimeRate === null ? '—' : `${onTimeRate}%`} label="On-time completion" tone="blue" />
        <Stat icon={<Timer />} value={String(weekSessions.length)} label="Focus sessions" tone="orange" />
      </div>
      {weekWorkload > 0 && (
        <div className="analytics-note card">
          <strong>{fmtMinutes(weekWorkload)}</strong> of schoolwork is due in the next 7 days.
        </div>
      )}
    </div>
  )
}
