import type { Assignment, PlannedSession } from './types'

export type { Assignment, FocusSession, Goal, PlanBlock, PlanResult, PlannedSession, Priority, Source, SubmissionState, ThemeMode } from './types'

export const mockAssignments: Assignment[] = [
  { id: 'math-quadratic', title: 'Quadratic Equations', className: 'Mathematics', dueLabel: 'Tomorrow', dueInDays: 1, dueDateIso: new Date(Date.now() + 86400000).toISOString(), estimatedMinutes: 45, priority: 'High', completed: false, source: 'Development Mock', notes: 'Complete problems 1–20.' },
  { id: 'science-cell', title: 'Cell Biology Lab', className: 'Science', dueLabel: 'Friday', dueInDays: 3, dueDateIso: new Date(Date.now() + 3 * 86400000).toISOString(), estimatedMinutes: 60, priority: 'High', completed: false, source: 'Development Mock', notes: 'Write up observations and conclusion.' },
  { id: 'english-essay', title: 'Persuasive Essay', className: 'English', dueLabel: 'Monday', dueInDays: 6, dueDateIso: new Date(Date.now() + 6 * 86400000).toISOString(), estimatedMinutes: 90, priority: 'Medium', completed: false, source: 'Development Mock', notes: 'Draft a clear thesis and three supporting points.' },
]

export const mockSchedule: PlannedSession[] = [
  { id: 'session-math', title: 'Quadratic Equations', time: '4:00 PM', duration: '45 min', kind: 'focus' },
  { id: 'session-break', title: 'Break', time: '4:45 PM', duration: '15 min', kind: 'break' },
  { id: 'session-science', title: 'Cell Biology Lab', time: '5:00 PM', duration: '60 min', kind: 'focus' },
]
