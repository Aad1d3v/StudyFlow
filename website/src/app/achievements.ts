import type { Achievement, EarnedAchievement, FocusSession } from './types'

/**
 * Achievement definitions. The core loop: every hour a student locks in and
 * completes focused work, they get closer to the next milestone. Milestones
 * are based on completed focus-session time and completed-session counts.
 */
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-session', name: 'First Steps', description: 'Complete your first focus session', icon: '🚀', kind: 'sessions', threshold: 1 },
  { id: 'first-hour', name: 'First Hour', description: 'Lock in for 1 hour of focused work', icon: '🌱', kind: 'minutes', threshold: 60 },
  { id: 'five-hours', name: 'Momentum', description: '5 hours of focused work', icon: '⚡', kind: 'minutes', threshold: 300 },
  { id: 'ten-sessions', name: 'Getting Serious', description: 'Complete 10 focus sessions', icon: '🎯', kind: 'sessions', threshold: 10 },
  { id: 'ten-hours', name: 'Deep Focus', description: '10 hours locked in', icon: '🧠', kind: 'minutes', threshold: 600 },
  { id: 'twenty-five-hours', name: 'Dedicated', description: '25 hours of focused work', icon: '🔥', kind: 'minutes', threshold: 1500 },
  { id: 'fifty-sessions', name: 'Ritual', description: 'Complete 50 focus sessions', icon: '🔁', kind: 'sessions', threshold: 50 },
  { id: 'fifty-hours', name: 'Marathoner', description: '50 hours locked in', icon: '🏃', kind: 'minutes', threshold: 3000 },
  { id: 'hundred-hours', name: 'Century Club', description: '100 hours of focused work', icon: '💯', kind: 'minutes', threshold: 6000 },
  { id: 'two-fifty-hours', name: 'Unstoppable', description: '250 hours locked in', icon: '👑', kind: 'minutes', threshold: 15000 },
  { id: 'five-hundred-hours', name: 'Study Legend', description: '500 hours of focused work', icon: '🏆', kind: 'minutes', threshold: 30000 },
]

/** Completed focus sessions only — partial or stopped sessions don't count. */
export function focusStats(sessions: FocusSession[]): { totalMinutes: number; completedCount: number } {
  const completed = sessions.filter((s) => s.completed)
  const totalMinutes = Math.floor(completed.reduce((sum, s) => sum + s.durationSeconds, 0) / 60)
  return { totalMinutes, completedCount: completed.length }
}

export function progressFor(a: Achievement, sessions: FocusSession[]): { progress: number; remaining: number } {
  const { totalMinutes, completedCount } = focusStats(sessions)
  const value = a.kind === 'minutes' ? totalMinutes : completedCount
  const progress = Math.min(1, value / a.threshold)
  const remaining = Math.max(0, a.threshold - value)
  return { progress, remaining }
}

/**
 * Award any newly reached achievements. Existing ones keep their original
 * earnedAt. Returns the full list plus the ones earned in this call.
 */
export function applyAchievements(
  prev: EarnedAchievement[],
  sessions: FocusSession[],
): { all: EarnedAchievement[]; newly: EarnedAchievement[] } {
  const { totalMinutes, completedCount } = focusStats(sessions)
  const earnedIds = new Set(prev.map((e) => e.id))
  const all = [...prev]
  const newly: EarnedAchievement[] = []
  for (const a of ACHIEVEMENTS) {
    if (earnedIds.has(a.id)) continue
    const value = a.kind === 'minutes' ? totalMinutes : completedCount
    if (value >= a.threshold) {
      const earned: EarnedAchievement = { id: a.id, earnedAt: new Date().toISOString() }
      earnedIds.add(a.id)
      all.push(earned)
      newly.push(earned)
    }
  }
  return { all, newly }
}
