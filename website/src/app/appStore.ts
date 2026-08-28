import type { Assignment, EarnedAchievement, FocusSession, Goal, GradeClass, HelpChat, LetterToSelf, PlanBlock, SchoolConnection, SchoolYear, StudentProfile, ThemeMode } from './types'

const KEYS = {
  assignments: 'studyflow.assignments',
  sessions: 'studyflow.sessions',
  goals: 'studyflow.goals',
  plan: 'studyflow.plan',
  theme: 'studyflow.theme',
  schoolYear: 'studyflow.schoolYear',
  letters: 'studyflow.letters',
  helpChats: 'studyflow.helpChats',
  achievements: 'studyflow.achievements',
  grades: 'studyflow.grades',
  schools: 'studyflow.schools',
  profile: 'studyflow.profile',
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function loadAssignments(): Assignment[] | null {
  return safeParse<Assignment[]>(localStorage.getItem(KEYS.assignments))
}
export function saveAssignments(assignments: Assignment[]): void {
  localStorage.setItem(KEYS.assignments, JSON.stringify(assignments))
}

export function loadSessions(): FocusSession[] | null {
  return safeParse<FocusSession[]>(localStorage.getItem(KEYS.sessions))
}
export function saveSessions(sessions: FocusSession[]): void {
  localStorage.setItem(KEYS.sessions, JSON.stringify(sessions))
}

export function loadGoals(): Goal[] | null {
  return safeParse<Goal[]>(localStorage.getItem(KEYS.goals))
}
export function saveGoals(goals: Goal[]): void {
  localStorage.setItem(KEYS.goals, JSON.stringify(goals))
}

export function loadPlan(): PlanBlock[] | null {
  return safeParse<PlanBlock[]>(localStorage.getItem(KEYS.plan))
}
export function savePlan(plan: PlanBlock[]): void {
  localStorage.setItem(KEYS.plan, JSON.stringify(plan))
}

export function loadThemeMode(): ThemeMode | null {
  const value = localStorage.getItem(KEYS.theme)
  return value === 'light' || value === 'dark' || value === 'system' ? value : null
}
export function saveThemeMode(mode: ThemeMode): void {
  localStorage.setItem(KEYS.theme, mode)
}

export function loadSchoolYear(): SchoolYear | null {
  return safeParse<SchoolYear>(localStorage.getItem(KEYS.schoolYear))
}
export function saveSchoolYear(schoolYear: SchoolYear): void {
  localStorage.setItem(KEYS.schoolYear, JSON.stringify(schoolYear))
}

export function loadLetters(): LetterToSelf[] | null {
  return safeParse<LetterToSelf[]>(localStorage.getItem(KEYS.letters))
}
export function saveLetters(letters: LetterToSelf[]): void {
  localStorage.setItem(KEYS.letters, JSON.stringify(letters))
}

export function loadHelpChats(): HelpChat[] | null {
  return safeParse<HelpChat[]>(localStorage.getItem(KEYS.helpChats))
}
export function saveHelpChats(chats: HelpChat[]): void {
  localStorage.setItem(KEYS.helpChats, JSON.stringify(chats))
}

export function loadAchievements(): EarnedAchievement[] | null {
  return safeParse<EarnedAchievement[]>(localStorage.getItem(KEYS.achievements))
}
export function saveAchievements(earned: EarnedAchievement[]): void {
  localStorage.setItem(KEYS.achievements, JSON.stringify(earned))
}

export function loadGrades(): GradeClass[] | null {
  return safeParse<GradeClass[]>(localStorage.getItem(KEYS.grades))
}
export function saveGrades(grades: GradeClass[]): void {
  localStorage.setItem(KEYS.grades, JSON.stringify(grades))
}

export function loadSchools(): Record<string, SchoolConnection> | null {
  return safeParse<Record<string, SchoolConnection>>(localStorage.getItem(KEYS.schools))
}
export function saveSchools(schools: Record<string, SchoolConnection>): void {
  localStorage.setItem(KEYS.schools, JSON.stringify(schools))
}

export function loadProfile(): StudentProfile | null {
  return safeParse<StudentProfile>(localStorage.getItem(KEYS.profile))
}
export function saveProfile(profile: StudentProfile): void {
  localStorage.setItem(KEYS.profile, JSON.stringify(profile))
}

/** JSON export of the user's local productivity data (never auth secrets). */
export function exportData(): string {
  return JSON.stringify(
    {
      app: 'StudyFlow',
      version: '0.1.0',
      exportedAt: new Date().toISOString(),
      assignments: loadAssignments() ?? [],
      focusSessions: loadSessions() ?? [],
      goals: loadGoals() ?? [],
      plan: loadPlan() ?? [],
      schoolYear: loadSchoolYear() ?? {},
      letters: loadLetters() ?? [],
      helpChats: loadHelpChats() ?? [],
      achievements: loadAchievements() ?? [],
      grades: loadGrades() ?? [],
      schools: loadSchools() ?? {},
      profile: loadProfile() ?? {},
    },
    null,
    2,
  )
}

/** Remove local productivity data. Keeps the Google session and the account. */
export function clearAppData(): void {
  for (const key of [KEYS.assignments, KEYS.sessions, KEYS.goals, KEYS.plan, KEYS.schoolYear, KEYS.letters, KEYS.helpChats, KEYS.achievements, KEYS.grades, KEYS.schools, KEYS.profile]) {
    localStorage.removeItem(key)
  }
}

/** Full reset: productivity data, theme, the Google session, and the account session. */
export function resetAll(): void {
  clearAppData()
  localStorage.removeItem(KEYS.theme)
  localStorage.removeItem('studyflow.session')
  localStorage.removeItem('studyflow.lastSyncedAt')
  localStorage.removeItem('studyflow.auth.token')
}
