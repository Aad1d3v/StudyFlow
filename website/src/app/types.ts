export type Priority = 'Low' | 'Medium' | 'High' | 'Critical'
export type Source = 'Development Mock' | 'Manual' | 'Google Classroom' | 'Canvas' | 'D2L' | 'Moodle'
export type ThemeMode = 'light' | 'dark' | 'system'

export type SubmissionState =
  | 'CREATED'
  | 'TURNED_IN'
  | 'RETURNED'
  | 'RECLAIMED_BY_STUDENT'
  | 'STUDENT_EDITED_AFTER_TURN_IN'
  | 'TURNED_IN_LATE'

export type Attachment = {
  id: string
  name: string
  size: number
  type: string
  dataUrl: string // data: URL (small files only — kept inside the synced payload)
  text?: string // extracted text for readable files — used by the Assignment Help AI
}

export type Assignment = {
  id: string
  title: string
  className: string
  dueLabel: string
  dueInDays: number
  dueDateIso?: string
  estimatedMinutes?: number
  priority: Priority
  completed: boolean
  completedAt?: string
  source: Source
  notes: string
  // Files the student attached to this assignment from StudyFlow.
  attachments?: Attachment[]
  // Google Classroom sync fields (present when source === 'Google Classroom')
  providerId?: string
  courseId?: string
  description?: string
  alternateLink?: string
  submissionState?: SubmissionState
  maxPoints?: number
  updatedAt?: string
}

export type SchoolYear = {
  start?: string // yyyy-mm-dd
  end?: string // yyyy-mm-dd — also unlocks the Letter to Yourself
}

export type LetterToSelf = {
  id: string
  title: string
  content: string
  createdAt: string // ISO
  revealDate: string // yyyy-mm-dd — sealed until this date
  openedAt?: string // ISO — set once the student opens it
}

export type HelpMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export type HelpChat = {
  id: string
  title: string // assignment title (or 'General question')
  assignmentId?: string
  createdAt: string
  updatedAt: string
  messages: HelpMessage[]
}

export type AchievementKind = 'minutes' | 'sessions'

export type Achievement = {
  id: string
  name: string
  description: string
  icon: string
  kind: AchievementKind
  threshold: number // minutes of completed focus, or completed session count
}

export type EarnedAchievement = {
  id: string
  earnedAt: string
}

export type GradeClass = {
  id: string
  name: string
  teacher?: string
  current?: number // current grade, percent 0-100 (unset until entered)
  target?: number // target grade, percent 0-100
  decidedPercent?: number // how much of the grade is already decided (0-100)
}

/** The student's identity card: name, school, and a short bio. */
export type StudentProfile = {
  name?: string
  school?: string
  bio?: string
}

/**
 * A school portal connection (Canvas / D2L / Moodle). Credentials are the
 * student's own and are stored with their account data so sync works on any
 * device. Auto-syncs assignments every 5 minutes while connected.
 */
export type SchoolConnection = {
  id: 'canvas' | 'd2l' | 'moodle'
  name: string
  connected: boolean
  baseUrl?: string // e.g. https://school.instructure.com
  token?: string // Canvas access token / Moodle web service token
  appId?: string // D2L Valence app ID (issued by the school)
  appKey?: string // D2L Valence app key (issued by the school)
  userKey?: string // D2L Valence user key
  lastSyncAt?: string // ISO
  lastError?: string
  lastCount?: number // assignments pulled on the last sync
}

export type FocusSession = {
  id: string
  taskId?: string
  title: string
  className: string
  startedAt: string
  endedAt: string
  durationSeconds: number
  completed: boolean
}

export type GoalUnit = 'hours' | 'tasks'

export type Goal = {
  id: string
  title: string
  target: number
  unit: GoalUnit
  period: 'week'
  createdAt: string
}

export type PlanBlock = {
  id: string
  title: string
  className?: string
  date: string
  startMinutes: number
  durationMinutes: number
  kind: 'focus' | 'break'
  assignmentId?: string
}

export type PlanResult = {
  blocks: PlanBlock[]
  workMinutes: number
  availableMinutes: number
  overloaded: boolean
  unscheduled: string[]
  message?: string
}

export type PlannedSession = { id: string; title: string; time: string; duration: string; kind: 'focus' | 'break' }
