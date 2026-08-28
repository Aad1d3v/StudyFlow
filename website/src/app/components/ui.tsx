import type { ReactNode } from 'react'
import { BookOpen, Check, ExternalLink, Play } from 'lucide-react'
import type { Assignment, StudentProfile } from '../types'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string
  title: string
  subtitle: string
  action?: ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtitle">{subtitle}</p>
      </div>
      {action}
    </div>
  )
}

export function Stat({ icon, value, label, tone }: { icon: ReactNode; value: string; label: string; tone: string }) {
  return (
    <div className="stat card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-card">
      <BookOpen size={28} />
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function PriorityBadge({ priority }: { priority: Assignment['priority'] }) {
  return <span className={`priority ${priority.toLowerCase()}`}>{priority}</span>
}

/**
 * The student's identity card (name, school, short bio). Renders nothing
 * until the student fills in at least one field in Settings → Student Card.
 */
export function StudentCard({ profile, fallbackName }: { profile: StudentProfile; fallbackName: string }) {
  const hasCard = Boolean(profile.name?.trim() || profile.school?.trim() || profile.bio?.trim())
  if (!hasCard) return null
  const cardName = profile.name?.trim() || fallbackName
  const cardInitials =
    cardName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'ST'
  return (
    <div className="student-card card">
      <span className="student-card-avatar">{cardInitials}</span>
      <div className="student-card-info">
        <small>STUDENT CARD</small>
        <strong>{cardName}</strong>
        <span>{profile.school?.trim() || 'School not set'}</span>
      </div>
      {profile.bio?.trim() && <p className="student-card-bio-line">{profile.bio.trim()}</p>}
    </div>
  )
}

export function AssignmentRow({
  assignment: a,
  toggleComplete,
  startFocus,
  onOpen,
}: {
  assignment: Assignment
  toggleComplete: (id: string) => void
  startFocus: (a: Assignment) => void
  onOpen?: (id: string) => void
}) {
  return (
    <div className={`assignment-row ${a.completed ? 'done' : ''}`} onClick={() => onOpen && onOpen(a.id)} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} onKeyDown={onOpen ? (e) => { if (e.key === 'Enter') onOpen(a.id) } : undefined}>
      <button
        className={`check ${a.completed ? 'checked' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          toggleComplete(a.id)
        }}
        aria-label={`Mark ${a.title} complete`}
      >
        {a.completed && <Check size={14} />}
      </button>
      <div className="assignment-main">
        <strong>{a.title}</strong>
        <span>
          {a.className} <i>·</i> {a.source}
          {a.submissionState && <i className="submitted-note">· {a.submissionState.startsWith('TURNED_IN') ? 'Turned in' : 'Not turned in'}</i>}
        </span>
      </div>
      <PriorityBadge priority={a.priority} />
      <div className="due">
        <strong>{a.dueLabel}</strong>
        <small>{a.estimatedMinutes ? `${a.estimatedMinutes} min` : '—'}</small>
      </div>
      {a.alternateLink && (
        <a className="open-link" href={a.alternateLink} target="_blank" rel="noreferrer" aria-label={`Open ${a.title} in Classroom`} onClick={(e) => e.stopPropagation()}>
          <ExternalLink size={14} />
        </a>
      )}
      <button className="row-play" onClick={(e) => { e.stopPropagation(); startFocus(a) }} aria-label={`Start ${a.title}`}>
        <Play size={15} fill="currentColor" />
      </button>
    </div>
  )
}
