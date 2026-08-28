import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, BookOpen, BookOpenCheck, CalendarDays, Check, ChevronRight, CircleHelp, ClipboardList, Download, GraduationCap, LayoutDashboard, ListTodo, Mail, Menu, Moon, Paperclip, Play, Plus, Search, Settings as SettingsIcon, Sparkles, Sun, Target, Timer, Trash2, Trophy, X } from 'lucide-react'
import { APP_CONFIG } from './config'
import { mockAssignments } from './data'
import type { Assignment, Attachment, EarnedAchievement, FocusSession, Goal, GradeClass, HelpChat, LetterToSelf, PlanBlock, PlanResult, Priority, SchoolConnection, SchoolYear, StudentProfile, ThemeMode } from './types'
import { ACHIEVEMENTS, applyAchievements } from './achievements'
import { dueMetaFromIso, filesToAttachments, isoFromDateInput } from './utils'
import { buildPlan } from './planner'
import { useClassroom } from './google/useClassroom'
import { fetchSchoolAssignments } from './school/sync'
import {
  clearAppData,
  exportData,
  loadAchievements,
  loadAssignments,
  loadGoals,
  loadGrades,
  loadHelpChats,
  loadLetters,
  loadPlan,
  loadProfile,
  loadSchoolYear,
  loadSchools,
  loadSessions,
  loadThemeMode,
  resetAll,
  saveAchievements,
  saveAssignments,
  saveGoals,
  saveGrades,
  saveHelpChats,
  saveLetters,
  savePlan,
  saveProfile,
  saveSchoolYear,
  saveSchools,
  saveSessions,
  saveThemeMode,
} from './appStore'
import { Dashboard } from './pages/Dashboard'
import { Assignments } from './pages/Assignments'
import { Planner } from './pages/Planner'
import { Focus } from './pages/Focus'
import { Analytics } from './pages/Analytics'
import { Goals } from './pages/Goals'
import { Settings } from './pages/Settings'
import { Classroom } from './pages/Classroom'
import { AIAssistant } from './pages/AI'
import { Calendar } from './pages/Calendar'
import { Portal } from './pages/Portal'
import { AuthPage } from './pages/Auth'
import { LetterToSelfPage } from './pages/LetterToSelf'
import { AssignmentHelp } from './pages/AssignmentHelp'
import { Achievements } from './pages/Achievements'
import { Grades } from './pages/Grades'
import { useAuth } from './auth/useAuth'
import { authApi, type UserDataPayload } from './auth/api'
import type { PortalInfo } from './pages/Portal'
import { PriorityBadge } from './components/ui'
import { ContactForm } from './components/ContactForm'

type View = 'Dashboard' | 'Assignments' | 'Planner' | 'Focus' | 'Analytics' | 'Goals' | 'Grades' | 'Letter to Self' | 'Achievements' | 'Classroom' | 'D2L' | 'Canvas' | 'Moodle' | 'Calendar' | 'AI Assistant' | 'Assignment Help' | 'Settings'

const workspaceNav: { label: View; icon: typeof LayoutDashboard }[] = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Assignments', icon: ListTodo },
  { label: 'Planner', icon: CalendarDays },
  { label: 'Focus', icon: Timer },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Goals', icon: Target },
  { label: 'Grades', icon: ClipboardList },
  { label: 'Letter to Self', icon: Mail },
  { label: 'Achievements', icon: Trophy },
]
const schoolNav: { label: View; icon: typeof LayoutDashboard }[] = [
  { label: 'Classroom', icon: GraduationCap },
  { label: 'D2L', icon: BookOpen },
  { label: 'Canvas', icon: BookOpen },
  { label: 'Moodle', icon: BookOpen },
]
const integrationNav: { label: View; icon: typeof LayoutDashboard }[] = [
  { label: 'Calendar', icon: CalendarDays },
  { label: 'AI Assistant', icon: Sparkles },
  { label: 'Assignment Help', icon: BookOpenCheck },
]

const portals: Record<'D2L' | 'Canvas' | 'Moodle', PortalInfo> = {
  D2L: {
    key: 'd2l',
    name: 'D2L Brightspace',
    short: 'D2L',
    tagline: 'Your Brightspace courses and assignments, synced alongside everything else.',
    description: 'D2L Brightspace is a learning management system used by many schools and universities. Connect with your school-issued Valence credentials and assignments sync automatically.',
    features: ['Courses you are enrolled in', 'Assignments, due dates, and descriptions', 'Submission status and feedback', 'Auto-syncs every 5 minutes'],
    docsUrl: 'https://docs.valence.desire2learn.com/',
    docsLabel: 'D2L Brightspace API documentation',
    color: '#0E7C86',
    baseUrl: 'https://[your-school].brightspace.com',
    apiNote: 'D2L uses the Valence API with signed requests. Your school must register a Valence app and provide the app ID, app key, and user key — most students get these from their school\'s IT or ed-tech team.',
    helpText: 'Your school issues Valence app credentials. Ask your IT/ed-tech team for an app ID, app key, and user key with assignment read access.',
  },
  Canvas: {
    key: 'canvas',
    name: 'Canvas',
    short: 'CANVAS',
    tagline: 'Your Canvas courses and assignments, synced alongside everything else.',
    description: 'Canvas is a popular learning management system used by schools and universities. Connect with your own access token and everything syncs automatically.',
    features: ['Courses you are enrolled in', 'Assignments and due dates', 'Submission status', 'Auto-syncs every 5 minutes'],
    docsUrl: 'https://canvas.instructure.com/doc/api/',
    docsLabel: 'Canvas LMS API documentation',
    color: '#D41F2C',
    baseUrl: 'https://[your-school].instructure.com',
    apiNote: 'Canvas uses a personal access token (Account → Settings → New Access Token). StudyFlow only reads your courses and assignments — never your password.',
    helpText: 'Create a token: open Canvas → Account → Settings → scroll to Access Tokens → New Access Token. Paste it here.',
  },
  Moodle: {
    key: 'moodle',
    name: 'Moodle',
    short: 'M',
    tagline: 'Your Moodle courses and deadlines, brought into your plan.',
    description: 'Moodle is an open-source learning platform used by many institutions. Connect with a web service token and assignments sync automatically.',
    features: ['Enrolled courses', 'Assignments and due dates', 'Auto-syncs every 5 minutes'],
    docsUrl: 'https://docs.moodle.org/dev/Web_services_API',
    docsLabel: 'Moodle web services documentation',
    color: '#F98012',
    baseUrl: 'https://[your-school].moodle.org',
    apiNote: 'Moodle needs web services enabled by your school. Ask them to enable the mod_assign_get_assignments function, then generate a token under Preferences → Web services.',
    helpText: 'In Moodle, go to Preferences → Web services → Manage tokens → Create token (function: mod_assign_get_assignments).',
  },
}

type ConfirmState = { title: string; message: string; confirmLabel: string; action: () => void }

function App() {
  const [view, setView] = useState<View>('Dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [assignments, setAssignments] = useState<Assignment[]>(() => loadAssignments() ?? [])
  const [sessions, setSessions] = useState<FocusSession[]>(() => loadSessions() ?? [])
  const [goals, setGoals] = useState<Goal[]>(() => loadGoals() ?? [])
  const [plan, setPlan] = useState<PlanBlock[]>(() => loadPlan() ?? [])
  const [schoolYear, setSchoolYear] = useState<SchoolYear>(() => loadSchoolYear() ?? {})
  const [letters, setLetters] = useState<LetterToSelf[]>(() => loadLetters() ?? [])
  const [helpChats, setHelpChats] = useState<HelpChat[]>(() => loadHelpChats() ?? [])
  const [earnedAchievements, setEarnedAchievements] = useState<EarnedAchievement[]>(() => loadAchievements() ?? [])
  const [grades, setGrades] = useState<GradeClass[]>(() => loadGrades() ?? [])
  const [schools, setSchools] = useState<Record<string, SchoolConnection>>(() => loadSchools() ?? {})
  const [schoolSyncing, setSchoolSyncing] = useState<Record<string, boolean>>({})
  const [profile, setProfile] = useState<StudentProfile>(() => loadProfile() ?? {})
  const [unlockToasts, setUnlockToasts] = useState<EarnedAchievement[]>([])
  const [suggestion, setSuggestion] = useState<PlanResult | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode() ?? 'system')
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)

  const [focus, setFocus] = useState<Assignment | null>(null)
  const [seconds, setSeconds] = useState(45 * 60)
  const [paused, setPaused] = useState(false)
  const [presetMinutes, setPresetMinutes] = useState(45)
  const [breakLeft, setBreakLeft] = useState<number | null>(null)
  const focusStartedRef = useRef(0)
  const focusInitialSecondsRef = useRef(45 * 60)

  const [showAdd, setShowAdd] = useState(false)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<ConfirmState | null>(null)
  const [search, setSearch] = useState('')
  const [showContact, setShowContact] = useState(false)

  /* ---------------- auth ---------------- */
  const { user, token, booting, busy: authBusy, error: authError, signIn, signUp, signOut } = useAuth()

  /* ---------------- achievements ---------------- */
  // Award milestones whenever focus sessions change. The initial hydration
  // effect below seeds earnedAchievements from the account before this runs.
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions
  useEffect(() => {
    const { all, newly } = applyAchievements(earnedAchievements, sessions)
    if (newly.length) {
      setEarnedAchievements(all)
      setUnlockToasts((prev) => [...prev, ...newly].slice(-3))
    }
  }, [earnedAchievements, sessions])

  // Auto-dismiss unlock toasts.
  useEffect(() => {
    if (!unlockToasts.length) return
    const id = window.setTimeout(() => setUnlockToasts([]), 7000)
    return () => window.clearTimeout(id)
  }, [unlockToasts])

  /* ---------------- persistence & theme ---------------- */
  useEffect(() => { saveAssignments(assignments) }, [assignments])
  useEffect(() => { saveSessions(sessions) }, [sessions])
  useEffect(() => { saveGoals(goals) }, [goals])
  useEffect(() => { savePlan(plan) }, [plan])
  useEffect(() => { saveSchoolYear(schoolYear) }, [schoolYear])
  useEffect(() => { saveLetters(letters) }, [letters])
  useEffect(() => { saveHelpChats(helpChats) }, [helpChats])
  useEffect(() => { saveAchievements(earnedAchievements) }, [earnedAchievements])
  useEffect(() => { saveGrades(grades) }, [grades])
  useEffect(() => { saveSchools(schools) }, [schools])
  useEffect(() => { saveProfile(profile) }, [profile])
  useEffect(() => { saveThemeMode(themeMode) }, [themeMode])

  // Development sample data never appears in a real account (product rule).
  // Anything derived from a mock assignment (plan blocks, focus sessions) is
  // dropped with it. Known mock ids/titles are matched directly because the
  // assignment rows themselves may already have been stripped.
  const mockIds = new Set(mockAssignments.map((a) => a.id))
  const mockTitles = new Set(mockAssignments.map((a) => a.title.toLowerCase()))
  const cleanForAccount = useCallback((data: UserDataPayload): UserDataPayload => {
    const assignments = (data.assignments ?? []).filter(
      (a) => a.source !== 'Development Mock' && !mockIds.has(a.id) && !mockTitles.has(a.title.toLowerCase()),
    )
    const isMockRef = (id?: string) => Boolean(id && mockIds.has(id))
    const isMockTitle = (title: string) => mockTitles.has(title.toLowerCase())
    const isMockBlock = (b: PlanBlock) =>
      isMockRef(b.assignmentId) || isMockTitle(b.title) || Array.from(mockIds).some((id) => b.id.includes(id))
    return {
      assignments,
      sessions: (data.sessions ?? []).filter((s) => !isMockRef(s.taskId) && !isMockTitle(s.title)),
      goals: data.goals ?? [],
      plan: (data.plan ?? []).filter((b) => !isMockBlock(b)),
      schoolYear: data.schoolYear ?? {},
      letters: data.letters ?? [],
      helpChats: data.helpChats ?? [],
      achievements: data.achievements ?? [],
      grades: data.grades ?? [],
      schools: data.schools ?? {},
      profile: data.profile ?? {},
    }
  }, [mockIds, mockTitles])

  // Hydrate from the account once, right after sign-in/restore. The server is
  // the source of truth for a session; localStorage is only the offline cache.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!user || !token || hydratedRef.current) return
    hydratedRef.current = true
    authApi
      .getData()
      .then(({ data }) => {
        if (!data) {
          setAssignments([])
          setSessions([])
          setGoals([])
          setPlan([])
          setSchoolYear({})
          setLetters([])
          setHelpChats([])
          setEarnedAchievements([])
          setGrades([])
          setSchools({})
          setProfile({})
          return
        }
        const clean = cleanForAccount(data)
        setAssignments(clean.assignments)
        setSessions(clean.sessions)
        setGoals(clean.goals)
        setPlan(clean.plan)
        setSchoolYear(clean.schoolYear ?? {})
        setLetters(clean.letters ?? [])
        setHelpChats(clean.helpChats ?? [])
        setEarnedAchievements(clean.achievements ?? [])
        setGrades(clean.grades ?? [])
        setSchools(clean.schools ?? {})
        setProfile(clean.profile ?? {})
      })
      .catch(() => { /* offline: keep the local cache */ })
  }, [user, token, cleanForAccount])

  // Debounced save-back to the account whenever productivity data changes.
  const saveTimerRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!user || !token) return
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      authApi
        .putData(cleanForAccount({ assignments, sessions, goals, plan, schoolYear, letters, helpChats, achievements: earnedAchievements, grades, schools, profile }))
        .catch(() => { /* offline: local cache stays; next change re-syncs */ })
    }, 900)
  }, [user, token, assignments, sessions, goals, plan, schoolYear, letters, helpChats, earnedAchievements, grades, schools, profile, cleanForAccount])

  const resolvedDark = themeMode === 'dark' || (themeMode === 'system' && systemDark)
  useEffect(() => { document.documentElement.dataset.theme = resolvedDark ? 'dark' : 'light' }, [resolvedDark])
  useEffect(() => {
    if (themeMode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setSystemDark(mq.matches)
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [themeMode])

  /* ---------------- timers ---------------- */
  useEffect(() => {
    if (!focus || paused || seconds <= 0) return
    const id = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [focus, paused, seconds])

  useEffect(() => {
    if (breakLeft === null || breakLeft <= 0) return
    const id = window.setInterval(() => setBreakLeft((s) => (s === null || s <= 1 ? null : s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [breakLeft])

  /* ---------------- Google classroom ---------------- */
  const assignmentsRef = useRef(assignments)
  assignmentsRef.current = assignments

  const mergeClassroom = useCallback((items: Assignment[]): { added: number; updated: number } => {
    const prev = assignmentsRef.current
    const freshById = new Map(items.map((i) => [i.id, i]))
    let updated = 0
    const next = prev
      .filter((a) => a.source !== 'Google Classroom' || freshById.has(a.id))
      .map((a) => {
        if (a.source === 'Google Classroom' && freshById.has(a.id)) {
          const fresh = freshById.get(a.id)!
          updated += 1
          return { ...fresh, completed: a.completed, completedAt: a.completedAt, estimatedMinutes: a.estimatedMinutes ?? fresh.estimatedMinutes, notes: a.notes || fresh.notes || '' }
        }
        return a
      })
    let added = 0
    for (const item of items) {
      if (!next.some((a) => a.id === item.id)) {
        next.push(item)
        added += 1
      }
    }
    setAssignments(next)
    return { added, updated }
  }, [])

  const classroom = useClassroom({ clientId: APP_CONFIG.googleClientId, onSyncResult: mergeClassroom })

  /* --------------- school portal sync (Canvas / D2L / Moodle) --------------- */
  const schoolsRef = useRef(schools)
  schoolsRef.current = schools

  const mergeSchoolItems = useCallback((items: Assignment[], source: Assignment['source']) => {
    const prev = assignmentsRef.current
    const freshById = new Map(items.map((i) => [i.id, i]))
    let updated = 0
    const next = prev
      .filter((a) => a.source !== source || freshById.has(a.id))
      .map((a) => {
        if (a.source === source && freshById.has(a.id)) {
          const fresh = freshById.get(a.id)!
          updated += 1
          return {
            ...fresh,
            completed: a.completed,
            completedAt: a.completedAt,
            estimatedMinutes: a.estimatedMinutes ?? fresh.estimatedMinutes,
            notes: a.notes || fresh.notes || '',
          }
        }
        return a
      })
    let added = 0
    for (const item of items) {
      if (!next.some((a) => a.id === item.id)) {
        next.push(item)
        added += 1
      }
    }
    setAssignments(next)
    return { added, updated }
  }, [])

  const runSchoolSync = useCallback(async (id: string) => {
    const conn = schoolsRef.current[id]
    if (!conn?.connected) return
    if (!navigator.onLine) {
      setSchools((prev) => ({ ...prev, [id]: { ...prev[id], lastError: "You're offline. Your saved data is still available." } }))
      return
    }
    setSchoolSyncing((prev) => ({ ...prev, [id]: true }))
    try {
      const result = await fetchSchoolAssignments(conn)
      if (result.error) {
        setSchools((prev) => ({ ...prev, [id]: { ...prev[id], lastError: result.error } }))
        return
      }
      const source = id === 'canvas' ? 'Canvas' : id === 'moodle' ? 'Moodle' : 'D2L'
      mergeSchoolItems(result.assignments, source)
      setSchools((prev) => ({
        ...prev,
        [id]: { ...prev[id], lastSyncAt: new Date().toISOString(), lastError: undefined, lastCount: result.assignments.length },
      }))
    } catch {
      setSchools((prev) => ({ ...prev, [id]: { ...prev[id], lastError: 'Sync failed. Try again in a moment.' } }))
    } finally {
      setSchoolSyncing((prev) => ({ ...prev, [id]: false }))
    }
  }, [mergeSchoolItems])

  const connectSchool = useCallback((id: string, config: Partial<SchoolConnection>) => {
    setSchools((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { id: id as SchoolConnection['id'], name: '', connected: false }),
        ...config,
        connected: true,
        lastError: undefined,
      },
    }))
    // Let the state flush, then pull assignments immediately.
    window.setTimeout(() => runSchoolSync(id), 400)
  }, [runSchoolSync])

  const disconnectSchool = useCallback((id: string) => {
    setSchools((prev) => ({ ...prev, [id]: { ...prev[id], connected: false, lastError: undefined } }))
  }, [])

  // Auto-sync every 5 minutes while any school portal is connected (same
  // cadence as Google Classroom).
  useEffect(() => {
    const connectedIds = Object.values(schools).filter((s) => s.connected).map((s) => s.id)
    if (!connectedIds.length) return
    const id = window.setInterval(() => {
      connectedIds.forEach((portalId) => runSchoolSync(portalId))
    }, 5 * 60 * 1000)
    return () => window.clearInterval(id)
  }, [schools, runSchoolSync])

  // Kick a background sync shortly after launch for already-connected portals.
  const schoolBootRef = useRef(false)
  useEffect(() => {
    if (schoolBootRef.current || !user) return
    schoolBootRef.current = true
    const ids = Object.values(schools).filter((s) => s.connected).map((s) => s.id)
    if (!ids.length) return
    const t = window.setTimeout(() => ids.forEach((portalId) => runSchoolSync(portalId)), 2500)
    return () => window.clearTimeout(t)
  }, [user, schools, runSchoolSync])

  /* ---------------- derived ---------------- */
  const userInitials = user
    ? user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')
    : ''
  const userFirstName = user?.name.split(/\s+/)[0] || 'there'
  const incomplete = assignments.filter((a) => !a.completed)
  const nextTask = useMemo(
    () => [...incomplete].sort((a, b) => a.dueInDays - b.dueInDays || b.priority.localeCompare(a.priority))[0],
    [incomplete],
  )
  const filtered = assignments.filter((a) => `${a.title} ${a.className}`.toLowerCase().includes(search.toLowerCase()))
  const classroomAssignments = assignments.filter((a) => a.source === 'Google Classroom')

  /* ---------------- actions ---------------- */
  const navigate = useCallback((next: View) => {
    setView(next)
    setSidebarOpen(false)
  }, [])

  const toggleComplete = useCallback((id: string) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, completed: !a.completed, completedAt: a.completed ? undefined : new Date().toISOString() }
          : a,
      ),
    )
  }, [])

  const startFocus = useCallback((task: Assignment) => {
    const duration = (task.estimatedMinutes ?? 45) * 60
    focusStartedRef.current = Date.now()
    focusInitialSecondsRef.current = duration
    setFocus(task)
    setSeconds(duration)
    setPaused(false)
    setBreakLeft(null)
    setView('Focus')
  }, [])

  const focusRef = useRef<Assignment | null>(null)
  focusRef.current = focus

  const recordSession = useCallback((completed: boolean) => {
    const task = focusRef.current
    if (!task || !focusStartedRef.current) return
    const ended = Date.now()
    const durationSeconds = Math.min(Math.max(Math.round((ended - focusStartedRef.current) / 1000), 0), focusInitialSecondsRef.current)
    setSessions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        taskId: task.id,
        title: task.title,
        className: task.className,
        startedAt: new Date(focusStartedRef.current).toISOString(),
        endedAt: new Date(ended).toISOString(),
        durationSeconds,
        completed,
      },
    ])
  }, [])

  const finishSession = useCallback(() => {
    const task = focus
    recordSession(true)
    if (task) {
      setAssignments((prev) =>
        prev.map((a) => (a.id === task.id && !a.completed ? { ...a, completed: true, completedAt: new Date().toISOString() } : a)),
      )
    }
    const done = focusInitialSecondsRef.current
    setBreakLeft(done >= 40 * 60 ? 10 * 60 : 5 * 60)
    setFocus(null)
    setPaused(false)
    setView('Focus')
  }, [focus, recordSession])

  const finishSessionRef = useRef(finishSession)
  finishSessionRef.current = finishSession
  useEffect(() => {
    if (focus && seconds <= 0 && !paused) finishSessionRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, seconds, paused])

  const cancelSession = useCallback(() => {
    recordSession(false)
    setFocus(null)
    setPaused(false)
    setBreakLeft(null)
  }, [recordSession])

  const addTask = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const dueIso = isoFromDateInput(String(data.get('dueDate') || ''))
    const due = dueMetaFromIso(dueIso)
    const files = (data.getAll('attachments').filter((v): v is File => v instanceof File && v.size > 0))
    const attachments = await filesToAttachments(files)
    setAssignments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: String(data.get('title')),
        className: String(data.get('className') || 'Personal'),
        dueLabel: due.label,
        dueInDays: due.days,
        dueDateIso: dueIso,
        estimatedMinutes: Number(data.get('minutes') || 30),
        priority: (data.get('priority') as Priority) || 'Medium',
        completed: false,
        source: 'Manual',
        notes: String(data.get('notes') || ''),
        attachments,
      },
    ])
    setShowAdd(false)
  }, [])

  const updateTask = useCallback(async (event: React.FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const dueIso = isoFromDateInput(String(data.get('dueDate') || ''))
    const due = dueMetaFromIso(dueIso)
    const files = (data.getAll('attachments').filter((v): v is File => v instanceof File && v.size > 0))
    const attachments = await filesToAttachments(files)
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              title: String(data.get('title')),
              className: String(data.get('className') || 'Personal'),
              dueLabel: due.label,
              dueInDays: due.days,
              dueDateIso: dueIso,
              estimatedMinutes: Number(data.get('minutes') || 30),
              priority: (data.get('priority') as Priority) || 'Medium',
              notes: String(data.get('notes') || ''),
              attachments: [...(a.attachments ?? []), ...attachments],
              updatedAt: new Date().toISOString(),
            }
          : a,
      ),
    )
    setEditId(null)
  }, [])

  const deleteTask = useCallback((id: string) => {
    const task = assignments.find((a) => a.id === id)
    setConfirm({
      title: 'Delete this task?',
      message: task ? `"${task.title}" will be removed from this device.` : 'This task will be removed from this device.',
      confirmLabel: 'Delete',
      action: () => {
        setAssignments((prev) => prev.filter((a) => a.id !== id))
        setDetailsId(null)
      },
    })
  }, [assignments])

  const buildSuggestion = useCallback(() => {
    setSuggestion(buildPlan(assignments))
    setView('Planner')
  }, [assignments])

  const acceptPlan = useCallback(() => {
    if (!suggestion) return
    setPlan(suggestion.blocks)
    setSuggestion(null)
  }, [suggestion])

  const exportDataNow = useCallback(() => {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `studyflow-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const clearData = useCallback(() => {
    setConfirm({
      title: 'Delete all local data?',
      message: 'Your assignments, tasks, focus sessions, goals, and plans will be removed from this device. Your Google connection stays.',
      confirmLabel: 'Delete everything',
      action: () => {
        clearAppData()
        setAssignments([])
        setSessions([])
        setGoals([])
        setPlan([])
        setSchoolYear({})
        setLetters([])
        setHelpChats([])
        setEarnedAchievements([])
        setGrades([])
        setSchools({})
        setProfile({})
        setUnlockToasts([])
        setSuggestion(null)
        setDetailsId(null)
        setEditId(null)
      },
    })
  }, [])

  const resetApp = useCallback(() => {
    setConfirm({
      title: 'Reset StudyFlow?',
      message: 'This erases everything on this device, including onboarding and your Google connection.',
      confirmLabel: 'Reset',
      action: () => {
        resetAll()
        window.location.reload()
      },
    })
  }, [])

  const addGoal = useCallback((goal: Omit<Goal, 'id' | 'createdAt'>) => {
    setGoals((prev) => [...prev, { ...goal, id: crypto.randomUUID(), createdAt: new Date().toISOString() }])
  }, [])

  const deleteGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id))
  }, [])

  const loadSample = useCallback(() => {
    setAssignments((prev) => (prev.length ? prev : mockAssignments))
  }, [])

  const addAttachmentsToTask = useCallback(async (id: string, files: File[]) => {
    const attachments = await filesToAttachments(files)
    if (!attachments.length) return
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, attachments: [...(a.attachments ?? []), ...attachments] } : a)),
    )
  }, [])

  const removeAttachment = useCallback((assignmentId: string, attachmentId: string) => {
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignmentId ? { ...a, attachments: (a.attachments ?? []).filter((att) => att.id !== attachmentId) } : a,
      ),
    )
  }, [])

  const detailsAssignment = detailsId ? assignments.find((a) => a.id === detailsId) : undefined
  const editAssignment = editId ? assignments.find((a) => a.id === editId) : undefined

  /* ---------------- auth gate ---------------- */
  if (booting) {
    return <Splash />
  }
  if (!user) {
    return <AuthPage busy={authBusy} error={authError} onSignIn={signIn} onSignUp={signUp} />
  }

  return (
    <div className="app-shell">
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><span>{APP_CONFIG.name}</span><span className="beta">BETA</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {workspaceNav.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${view === label ? 'active' : ''}`} onClick={() => navigate(label)}>
              <Icon size={18} /><span>{label}</span>
              {label === 'Assignments' && <span className="nav-count">{incomplete.length}</span>}
            </button>
          ))}
        </nav>
        <div className="workspace-label nav-group-label">SCHOOL</div>
        <nav>
          {schoolNav.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${view === label ? 'active' : ''}`} onClick={() => navigate(label)}>
              <Icon size={18} /><span>{label}</span>
              {label === 'Classroom' && <span className={`connection-dot ${classroom.status}`} />}
              {(label === 'Canvas' || label === 'D2L' || label === 'Moodle') && (
                <span className={`connection-dot ${schools[label.toLowerCase()]?.connected ? 'synced' : ''}`} />
              )}
            </button>
          ))}
        </nav>
        <div className="workspace-label nav-group-label">GOOGLE & AI</div>
        <nav>
          {integrationNav.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${view === label ? 'active' : ''}`} onClick={() => navigate(label)}>
              <Icon size={18} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="workspace-label nav-group-label">SYSTEM</div>
        <nav>
          <button className={`nav-item ${view === 'Settings' ? 'active' : ''}`} onClick={() => navigate('Settings')}>
            <SettingsIcon size={18} /><span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-card">
            <div className={`sync-dot ${classroom.status}`} />
            <div>
              <strong>{classroom.session ? 'Classroom connected' : 'Google not connected'}</strong>
              <small>{classroom.session ? classroom.session.email : 'Connect from the Classroom tab'}</small>
            </div>
          </div>
          <button className="help" onClick={() => setShowContact(true)}><CircleHelp size={17} /> Have a problem? Contact</button>
          <div className="profile">
            <div className="avatar">{userInitials}</div>
            <div><strong>{user.name}</strong><small>{user.email}</small></div>
            <ChevronRight size={15} />
          </div>
          <small className="made-by">Made by Aadidev Prasanth</small>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumb">Workspace <ChevronRight size={14} /> <strong>{view}</strong></div>
          <div className="top-actions">
            <label className="search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search anything" /></label>
            <button className="icon-button" onClick={() => setThemeMode(resolvedDark ? 'light' : 'dark')} aria-label="Toggle theme">
              {resolvedDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="avatar small">{userInitials}</button>
          </div>
        </header>
        {view === 'Dashboard' && <Dashboard assignments={assignments} incomplete={incomplete} nextTask={nextTask} toggleComplete={toggleComplete} startFocus={startFocus} onOpenDetails={setDetailsId} setShowAdd={setShowAdd} sessions={sessions} plan={plan} userName={userFirstName} profile={profile} />}
        {view === 'Assignments' && <Assignments assignments={filtered} toggleComplete={toggleComplete} startFocus={startFocus} onOpenDetails={setDetailsId} setShowAdd={setShowAdd} profile={profile} userName={userFirstName} classroom={classroom} onOpenClassroom={() => navigate('Classroom')} />}
        {view === 'Planner' && <Planner plan={plan} suggestion={suggestion} onAutoPlan={buildSuggestion} onAccept={acceptPlan} onRegenerate={buildSuggestion} onCancel={() => setSuggestion(null)} />}
        {view === 'Focus' && <Focus focus={focus} seconds={seconds} paused={paused} setPaused={setPaused} presetMinutes={presetMinutes} setPresetMinutes={setPresetMinutes} breakLeft={breakLeft} onFinish={finishSession} onCancel={cancelSession} onSkipBreak={() => setBreakLeft(null)} sessions={sessions} />}
        {view === 'Analytics' && <Analytics assignments={assignments} sessions={sessions} />}
        {view === 'Goals' && <Goals goals={goals} sessions={sessions} assignments={assignments} onAdd={addGoal} onDelete={deleteGoal} />}
        {view === 'Grades' && <Grades classes={grades} setClasses={setGrades} assignments={assignments} />}
        {view === 'Letter to Self' && <LetterToSelfPage letters={letters} setLetters={setLetters} schoolYear={schoolYear} />}
        {view === 'Achievements' && <Achievements earned={earnedAchievements} sessions={sessions} />}
        {view === 'Classroom' && <Classroom classroom={classroom} classroomAssignments={classroomAssignments} />}
        {view === 'D2L' && <Portal portal={portals.D2L} conn={schools.d2l} onConnect={(c) => connectSchool('d2l', c)} onDisconnect={() => disconnectSchool('d2l')} onSync={() => runSchoolSync('d2l')} syncing={Boolean(schoolSyncing.d2l)} assignments={assignments.filter((a) => a.source === 'D2L')} />}
        {view === 'Canvas' && <Portal portal={portals.Canvas} conn={schools.canvas} onConnect={(c) => connectSchool('canvas', c)} onDisconnect={() => disconnectSchool('canvas')} onSync={() => runSchoolSync('canvas')} syncing={Boolean(schoolSyncing.canvas)} assignments={assignments.filter((a) => a.source === 'Canvas')} />}
        {view === 'Moodle' && <Portal portal={portals.Moodle} conn={schools.moodle} onConnect={(c) => connectSchool('moodle', c)} onDisconnect={() => disconnectSchool('moodle')} onSync={() => runSchoolSync('moodle')} syncing={Boolean(schoolSyncing.moodle)} assignments={assignments.filter((a) => a.source === 'Moodle')} />}
        {view === 'Calendar' && <Calendar classroomStatus={classroom.status} />}
        {view === 'AI Assistant' && <AIAssistant assignments={assignments} sessions={sessions} />}
        {view === 'Assignment Help' && <AssignmentHelp assignments={assignments} chats={helpChats} setChats={setHelpChats} />}
        {view === 'Settings' && <Settings themeMode={themeMode} setThemeMode={setThemeMode} schoolYear={schoolYear} setSchoolYear={setSchoolYear} classroom={classroom} user={user} profile={profile} setProfile={setProfile} onSignOut={signOut} onLoadSample={loadSample} onExport={exportDataNow} onClearData={clearData} onReset={resetApp} />}
      </main>

      {/* Modals */}
      {showAdd && (
        <div className="modal-backdrop" onMouseDown={() => setShowAdd(false)}>
          <TaskForm title="Add something to your workload" subtitle="LOCAL TASK" submitLabel="Add task" onSubmit={addTask} onClose={() => setShowAdd(false)} />
        </div>
      )}
      {editAssignment && (
        <div className="modal-backdrop" onMouseDown={() => setEditId(null)}>
          <TaskForm title={`Edit "${editAssignment.title}"`} subtitle="LOCAL TASK" submitLabel="Save changes" initial={editAssignment} onSubmit={(e) => updateTask(e, editAssignment.id)} onClose={() => setEditId(null)} />
        </div>
      )}
      {detailsAssignment && (
        <div className="modal-backdrop" onMouseDown={() => setDetailsId(null)}>
          <div className="modal details-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">{detailsAssignment.className.toUpperCase()} · {detailsAssignment.source}</p>
                <h2>{detailsAssignment.title}</h2>
              </div>
              <button className="icon-button" onClick={() => setDetailsId(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="details-meta">
              <span><strong>Due</strong>{detailsAssignment.dueLabel}</span>
              <span><strong>Priority</strong><PriorityBadge priority={detailsAssignment.priority} /></span>
              <span><strong>Estimate</strong>{detailsAssignment.estimatedMinutes ? `${detailsAssignment.estimatedMinutes} min` : 'Not set'}</span>
              {detailsAssignment.maxPoints !== undefined && <span><strong>Points</strong>{detailsAssignment.maxPoints}</span>}
              {detailsAssignment.submissionState && <span><strong>Status</strong>{detailsAssignment.submissionState.startsWith('TURNED_IN') ? 'Turned in' : 'Not turned in'}</span>}
            </div>
            {(detailsAssignment.description || detailsAssignment.notes) && (
              <div className="details-text">
                {detailsAssignment.description && <p>{detailsAssignment.description}</p>}
                {detailsAssignment.notes && <p className="muted"><strong>Your notes:</strong> {detailsAssignment.notes}</p>}
              </div>
            )}
            <div className="details-attachments">
              <div className="details-attachments-head">
                <strong><Paperclip size={13} /> Attachments ({detailsAssignment.attachments?.length ?? 0})</strong>
                <label className="secondary small file-label">
                  <Plus size={13} /> Add file
                  <input
                    type="file"
                    multiple
                    accept=".txt,.md,.pdf,.doc,.docx,.png,.jpg,.jpeg,.csv,.json"
                    onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) addAttachmentsToTask(detailsAssignment.id, files); e.target.value = '' }}
                  />
                </label>
              </div>
              {detailsAssignment.attachments?.length ? (
                <ul className="attachment-list">
                  {detailsAssignment.attachments.map((att) => (
                    <li key={att.id}>
                      <Paperclip size={13} />
                      <span className="attachment-name" title={att.name}>{att.name}</span>
                      <span className="attachment-size">{(att.size / 1024).toFixed(0)} KB</span>
                      <a className="icon-button" href={att.dataUrl} download={att.name} aria-label={`Download ${att.name}`}><Download size={14} /></a>
                      <button className="icon-button" onClick={() => removeAttachment(detailsAssignment.id, att.id)} aria-label={`Remove ${att.name}`}><Trash2 size={13} /></button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted attachment-empty">No files attached. Add a rubric, prompt, or your draft — the Assignment Help AI can read text files you attach.</p>
              )}
            </div>
            <div className="details-actions">
              {!detailsAssignment.completed && <button className="primary" onClick={() => { setDetailsId(null); startFocus(detailsAssignment) }}><Play size={15} fill="currentColor" /> Start Focus</button>}
              <button className="secondary" onClick={() => toggleComplete(detailsAssignment.id)}>
                <Check size={15} /> {detailsAssignment.completed ? 'Reopen' : 'Mark Complete'}
              </button>
              <button className="secondary" onClick={buildSuggestion}><Sparkles size={15} /> Add to Plan</button>
              {detailsAssignment.alternateLink && (
                <a className="secondary" href={detailsAssignment.alternateLink} target="_blank" rel="noreferrer">Open in Classroom</a>
              )}
              {detailsAssignment.source === 'Manual' && (
                <>
                  <button className="secondary" onClick={() => { setEditId(detailsAssignment.id); setDetailsId(null) }}>Edit</button>
                  <button className="danger-link" onClick={() => deleteTask(detailsAssignment.id)}><Trash2 size={13} /> Delete</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop" onMouseDown={() => setConfirm(null)}>
          <div className="modal confirm-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head"><div><p className="eyebrow">PLEASE CONFIRM</p><h2>{confirm.title}</h2></div><button className="icon-button" onClick={() => setConfirm(null)} aria-label="Cancel"><X size={18} /></button></div>
            <p className="confirm-message">{confirm.message}</p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="danger" onClick={() => { confirm.action(); setConfirm(null) }}>{confirm.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
      {showContact && (
        <div className="modal-backdrop" onMouseDown={() => setShowContact(false)}>
          <ContactForm userName={user.name} userEmail={user.email} onClose={() => setShowContact(false)} />
        </div>
      )}
      {unlockToasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {unlockToasts.map((t) => {
            const def = ACHIEVEMENTS.find((a) => a.id === t.id)
            if (!def) return null
            return (
              <div className="toast" key={t.id}>
                <span className="toast-icon">{def.icon}</span>
                <div>
                  <small>ACHIEVEMENT UNLOCKED</small>
                  <strong>{def.name}</strong>
                  <p>{def.description}</p>
                </div>
                <button className="icon-button" onClick={() => setUnlockToasts((prev) => prev.filter((x) => x.id !== t.id))} aria-label="Dismiss"><X size={14} /></button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Splash() {
  return (
    <div className="splash">
      <div className="splash-mark"><Sparkles size={22} /></div>
      <strong>{APP_CONFIG.name}</strong>
      <small>Loading your workspace…</small>
    </div>
  )
}

function TaskForm({
  title,
  subtitle,
  submitLabel,
  initial,
  onSubmit,
  onClose,
}: {
  title: string
  subtitle: string
  submitLabel: string
  initial?: Assignment
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onClose: () => void
}) {
  return (
    <form className="modal" onSubmit={onSubmit} onMouseDown={(e) => e.stopPropagation()}>
      <div className="modal-head">
        <div><p className="eyebrow">{subtitle}</p><h2>{title}</h2></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
      </div>
      <label>Task title<input name="title" required placeholder="e.g. Read chapter 4" defaultValue={initial?.title} /></label>
      <div className="form-grid">
        <label>Class or category<input name="className" placeholder="Personal" defaultValue={initial?.className} /></label>
        <label>Estimated minutes<input name="minutes" type="number" min="5" defaultValue={initial?.estimatedMinutes ?? 30} /></label>
      </div>
      <div className="form-grid">
        <label>Due date<input name="dueDate" type="date" defaultValue={initial?.dueDateIso?.slice(0, 10)} /></label>
        <label>Priority<select name="priority" defaultValue={initial?.priority || 'Medium'}><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select></label>
      </div>
      <label>Notes<textarea name="notes" placeholder="Optional details" defaultValue={initial?.notes} /></label>
      <label className="file-label attachments-field"><Paperclip size={14} /> Attach files (optional — up to 400 KB each)<input type="file" name="attachments" multiple accept=".txt,.md,.pdf,.doc,.docx,.png,.jpg,.jpeg,.csv,.json" /></label>
      <button className="primary full" type="submit"><Plus size={17} /> {submitLabel}</button>
    </form>
  )
}

export default App
