import { Check, ChevronRight, Clock3, ListTodo, Play, Plus, Sparkles, Timer } from 'lucide-react'
import type { Assignment, FocusSession, PlanBlock, StudentProfile } from '../types'
import { dateKey, fmtMinutes, startOfDay } from '../utils'
import { AssignmentRow, PageHeader, Stat, StudentCard } from '../components/ui'

export function Dashboard({
  assignments,
  incomplete,
  nextTask,
  toggleComplete,
  startFocus,
  onOpenDetails,
  setShowAdd,
  sessions,
  plan,
  userName,
  profile,
}: {
  assignments: Assignment[]
  incomplete: Assignment[]
  nextTask?: Assignment
  toggleComplete: (id: string) => void
  startFocus: (a: Assignment) => void
  onOpenDetails: (id: string) => void
  setShowAdd: (v: boolean) => void
  sessions: FocusSession[]
  plan: PlanBlock[]
  userName: string
  profile: StudentProfile
}) {
  const workloadMinutes = incomplete.reduce((sum, a) => sum + (a.estimatedMinutes || 0), 0)
  const workloadLabel = workloadMinutes > 0 ? fmtMinutes(workloadMinutes) : '—'
  const completedCount = assignments.filter((a) => a.completed).length
  const completionPct = assignments.length > 0 ? Math.round((completedCount / assignments.length) * 100) : 0
  const weekSessions = sessions.filter((s) => startOfDay(new Date(s.startedAt)).getTime() >= startOfDay(new Date(Date.now() - 6 * 86400000)).getTime()).length

  const recommendationText = nextTask
    ? nextTask.estimatedMinutes
      ? `It's due ${nextTask.dueLabel.toLowerCase()} and should take about ${nextTask.estimatedMinutes} minutes. A focused start now will keep your week comfortable.`
      : `It's due ${nextTask.dueLabel.toLowerCase()} and hasn't been started yet. A focused start now will keep your week comfortable.`
    : 'You are all caught up. Enjoy the breathing room!'

  const sortedSoon = [...assignments].sort((a, b) => a.dueInDays - b.dueInDays).slice(0, 3)

  const todayKey = dateKey(new Date())
  const todayPlan = plan.filter((b) => b.date === todayKey).sort((a, b) => a.startMinutes - b.startMinutes)
  const scheduleRows = todayPlan.map((b) => ({
    id: b.id,
    title: b.title,
    time: `${Math.floor(b.startMinutes / 60) % 12 || 12}:${String(b.startMinutes % 60).padStart(2, '0')} ${b.startMinutes >= 720 ? 'PM' : 'AM'}`,
    duration: `${b.durationMinutes} min`,
    kind: b.kind,
  }))

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase()

  return (
    <div className="page">
      <PageHeader
        eyebrow={dateLabel}
        title={`${greeting}, ${userName}`}
        subtitle={`You have ${incomplete.length} ${incomplete.length === 1 ? 'thing' : 'things'} to focus on. Let's make today count.`}
        action={<button className="primary" onClick={() => setShowAdd(true)}><Plus size={17} /> Add task</button>}
      />
      <StudentCard profile={profile} fallbackName={userName} />
      <div className="stat-grid">
        <Stat icon={<ListTodo />} value={String(incomplete.length)} label="Open tasks" tone="purple" />
        <Stat icon={<Clock3 />} value={workloadLabel} label="Estimated workload" tone="blue" />
        <Stat icon={<Check />} value={`${completionPct}%`} label="Completion rate" tone="green" />
        <Stat icon={<Timer />} value={String(weekSessions)} label="Focus sessions (7d)" tone="orange" />
      </div>
      <div className="dashboard-grid">
        <section className="recommendation card">
          <div className="section-label"><Sparkles size={16} /> AI RECOMMENDATION</div>
          <h2>Start with {nextTask?.title || 'your next task'}</h2>
          <p>{recommendationText}</p>
          {nextTask && (
            <div className="recommendation-meta">
              <span><Clock3 size={15} /> {nextTask.estimatedMinutes ? `${nextTask.estimatedMinutes} min` : 'Duration not set'}</span>
              <span className="priority high">{nextTask.priority} priority</span>
            </div>
          )}
          <button className="primary" disabled={!nextTask} onClick={() => nextTask && startFocus(nextTask)}>
            <Play size={16} fill="currentColor" /> Start focus
          </button>
          <button className="text-button">Why this task? <ChevronRight size={15} /></button>
        </section>
        <section className="card schedule">
          <div className="section-heading">
            <div>
              <p className="eyebrow">TODAY'S PLAN</p>
              <h2>A calm, achievable day</h2>
            </div>
            <button className="text-button">Edit plan</button>
          </div>
          {scheduleRows.length > 0 ? scheduleRows.map((s) => (
            <div className={`schedule-row ${s.kind}`} key={s.id}>
              <span className="schedule-time">{s.time}</span>
              <span className="schedule-line" />
              <div>
                <strong>{s.title}</strong>
                <small>{s.duration}{s.kind === 'focus' ? ' · Focus session' : ''}</small>
              </div>
            </div>
          )) : (
            <p className="dashboard-empty-note">No plan for today yet — generate one in the Planner and it will appear here.</p>
          )}
        </section>
      </div>
      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">UP NEXT</p>
            <h2>Due soon</h2>
          </div>
          <button className="text-button">View all <ChevronRight size={15} /></button>
        </div>
        <div className="assignment-list">
          {sortedSoon.map((a) => <AssignmentRow key={a.id} assignment={a} toggleComplete={toggleComplete} startFocus={startFocus} onOpen={onOpenDetails} />)}
        </div>
      </section>
    </div>
  )
}
