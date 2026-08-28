import { Check, Lock, Trophy } from 'lucide-react'
import { ACHIEVEMENTS, focusStats, progressFor } from '../achievements'
import type { EarnedAchievement, FocusSession } from '../types'
import { PageHeader } from '../components/ui'
import { fmtMinutes } from '../utils'

export function Achievements({ earned, sessions }: { earned: EarnedAchievement[]; sessions: FocusSession[] }) {
  const earnedIds = new Set(earned.map((e) => e.id))
  const { totalMinutes, completedCount } = focusStats(sessions)
  const next = ACHIEVEMENTS.find((a) => !earnedIds.has(a.id))

  return (
    <div className="page achievements-page">
      <PageHeader
        eyebrow="GAMIFICATION"
        title="Achievements"
        subtitle="Every hour you lock in counts. Complete focus sessions to unlock milestones and build your streak of deep work."
      />

      <div className="achievement-hero card">
        <div className="achievement-hero-stats">
          <div>
            <strong>{fmtMinutes(totalMinutes)}</strong>
            <small>Total focus time</small>
          </div>
          <div>
            <strong>{completedCount}</strong>
            <small>Completed sessions</small>
          </div>
          <div>
            <strong>{earned.length} / {ACHIEVEMENTS.length}</strong>
            <small>Achievements earned</small>
          </div>
        </div>
        <div className="achievement-next">
          <Trophy size={18} />
          <div>
            <small>NEXT UP</small>
            {next ? (
              <>
                <strong>{next.icon} {next.name}</strong>
                <span>{next.kind === 'minutes' ? `${fmtMinutes(next.threshold)} of focused work` : `${next.threshold} completed sessions`}</span>
                <div className="achievement-next-bar">
                  <i style={{ width: `${Math.round(progressFor(next, sessions).progress * 100)}%` }} />
                </div>
              </>
            ) : (
              <strong>Everything unlocked — legendary work! 👑</strong>
            )}
          </div>
        </div>
      </div>

      <div className="achievement-grid">
        {ACHIEVEMENTS.map((a) => {
          const earnedAt = earned.find((e) => e.id === a.id)?.earnedAt
          const isEarned = Boolean(earnedAt)
          const { progress, remaining } = progressFor(a, sessions)
          return (
            <div key={a.id} className={`achievement-card card ${isEarned ? 'earned' : ''}`}>
              <div className="achievement-icon">{a.icon}</div>
              <div className="achievement-info">
                <strong>{a.name}</strong>
                <p>{a.description}</p>
                {isEarned ? (
                  <span className="achievement-earned"><Check size={12} /> Earned {new Date(earnedAt!).toLocaleDateString()}</span>
                ) : (
                  <>
                    <div className="achievement-progress"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                    <span className="achievement-remaining">
                      <Lock size={10} /> {a.kind === 'minutes' ? `${fmtMinutes(remaining)} to go` : `${remaining} more session${remaining === 1 ? '' : 's'}`}
                    </span>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {completedCount === 0 && (
        <p className="muted achievement-hint">No focus sessions yet — start a focus session on any assignment and finish it to earn your first achievement.</p>
      )}
    </div>
  )
}
