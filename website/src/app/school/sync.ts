import type { Assignment, SchoolConnection } from '../types'
import { authApi } from '../auth/api'

export type SchoolSyncResult = { assignments: Assignment[]; error?: string }

type ProxyOutcome = { ok: boolean; status: number; data: unknown; raw: string }

async function proxyJson(url: string, headers: Record<string, string>): Promise<ProxyOutcome> {
  const res = await authApi.schoolProxy(url, headers)
  let data: unknown = null
  try {
    data = JSON.parse(res.body)
  } catch {
    // non-JSON body — kept as raw
  }
  return { ok: res.ok && res.status > 0, status: res.status, data, raw: res.body }
}

function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function dueFields(iso: string | undefined): { dueLabel: string; dueInDays: number; dueDateIso?: string } {
  if (!iso) return { dueLabel: 'No due date', dueInDays: 99 }
  const due = new Date(iso)
  if (Number.isNaN(due.getTime())) return { dueLabel: 'No due date', dueInDays: 99 }
  return {
    dueLabel: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    dueInDays: Math.round((due.getTime() - Date.now()) / 86400000),
    dueDateIso: iso,
  }
}

function priorityFor(iso: string | undefined): Assignment['priority'] {
  if (!iso) return 'Medium'
  return new Date(iso).getTime() < Date.now() ? 'High' : 'Medium'
}

/* ------------------------------ Canvas ------------------------------ */

export async function syncCanvas(baseUrl: string, token: string): Promise<SchoolSyncResult> {
  const base = baseUrl.replace(/\/+$/, '')
  const headers = { Authorization: `Bearer ${token}` }
  const coursesOutcome = await proxyJson(`${base}/api/v1/courses?enrollment_state=active&enrollment_type=student&per_page=100`, headers)
  if (coursesOutcome.status === 0) return { assignments: [], error: 'Could not reach that school server. Check the URL and try again.' }
  if (!coursesOutcome.ok) return { assignments: [], error: `Canvas responded with ${coursesOutcome.status}. Check your URL and access token.` }
  const courses = coursesOutcome.data
  if (!Array.isArray(courses)) return { assignments: [], error: 'Canvas returned an unexpected response.' }

  const assignments: Assignment[] = []
  for (const course of courses) {
    const courseId = course?.id
    const courseName = course?.name || 'Course'
    if (!courseId || course?.access_restricted_by_date) continue
    const workOutcome = await proxyJson(
      `${base}/api/v1/courses/${courseId}/assignments?per_page=100&include[]=submission`,
      headers,
    )
    if (!workOutcome.ok) continue
    const work = workOutcome.data
    if (!Array.isArray(work)) continue
    for (const item of work) {
      if (!item || !item.id) continue
      const dueIso = typeof item.due_at === 'string' ? item.due_at : undefined
      const submitted = Boolean(item?.submission?.submitted_at)
      assignments.push({
        id: `canvas-${courseId}-${item.id}`,
        title: item.name || 'Untitled assignment',
        className: courseName,
        ...dueFields(dueIso),
        priority: priorityFor(dueIso),
        completed: false,
        source: 'Canvas',
        notes: '',
        providerId: String(item.id),
        courseId: String(courseId),
        description: typeof item.description === 'string' ? stripHtml(item.description) : undefined,
        alternateLink: `${base}/courses/${courseId}/assignments/${item.id}`,
        submissionState: submitted ? 'TURNED_IN' : 'CREATED',
        maxPoints: typeof item.points_possible === 'number' ? item.points_possible : undefined,
        updatedAt: new Date().toISOString(),
      })
    }
  }
  return { assignments }
}

/* ------------------------------ Moodle ------------------------------ */

export async function syncMoodle(baseUrl: string, token: string): Promise<SchoolSyncResult> {
  const base = baseUrl.replace(/\/+$/, '')
  const params = new URLSearchParams({
    wstoken: token,
    wsfunction: 'mod_assign_get_assignments',
    moodlewsrestformat: 'json',
  })
  const outcome = await proxyJson(`${base}/webservice/rest/server.php?${params.toString()}`, {})
  if (outcome.status === 0) return { assignments: [], error: 'Could not reach that school server. Check the URL and try again.' }
  if (!outcome.ok) return { assignments: [], error: `Moodle responded with ${outcome.status}. Check your URL and web service token.` }
  const data = outcome.data as { errorcode?: string; message?: string; courses?: Array<{ id?: number; fullname?: string; assignments?: Array<Record<string, unknown>> }> } | null
  if (data?.errorcode) return { assignments: [], error: `Moodle: ${data.message || data.errorcode}` }

  const assignments: Assignment[] = []
  for (const course of data?.courses || []) {
    const courseName = course.fullname || 'Course'
    for (const item of course.assignments || []) {
      const rawDue = Number(item.duedate || 0)
      const dueIso = rawDue > 0 ? new Date(rawDue * 1000).toISOString() : undefined
      const id = item.id
      if (!id) continue
      const grade = typeof item.grade === 'number' && item.grade > 0 ? item.grade : undefined
      assignments.push({
        id: `moodle-${course.id}-${id}`,
        title: String(item.name || 'Untitled assignment'),
        className: courseName,
        ...dueFields(dueIso),
        priority: priorityFor(dueIso),
        completed: false,
        source: 'Moodle',
        notes: '',
        providerId: String(id),
        courseId: String(course.id ?? ''),
        description: typeof item.intro === 'string' ? stripHtml(item.intro) : undefined,
        maxPoints: grade,
        updatedAt: new Date().toISOString(),
      })
    }
  }
  return { assignments }
}

/* ------------------------------- D2L -------------------------------- */

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * D2L Brightspace uses the Valence API: every request carries
 * x_a=appId, x_b=userKey, x_c=signature, x_d=timestamp, where the signature
 * is SHA256(appKey + "&" + userKey + "&" + METHOD + "&" + urlPath + "&" + ts)
 * and urlPath excludes the query string. The app ID/key are issued by the
 * school; the user key comes from the school's token endpoint.
 */
async function d2lGet(base: string, path: string, appId: string, appKey: string, userKey: string): Promise<ProxyOutcome> {
  const ts = Date.now()
  const signature = await sha256Hex(`${appKey}&${userKey}&GET&${path}&${ts}`)
  const params = new URLSearchParams({ x_a: appId, x_b: userKey, x_c: signature, x_d: String(ts) })
  return proxyJson(`${base}${path}?${params.toString()}`, { Accept: 'application/json' })
}

export async function syncD2L(baseUrl: string, appId: string, appKey: string, userKey: string): Promise<SchoolSyncResult> {
  const base = baseUrl.replace(/\/+$/, '')
  const whoami = await d2lGet(base, '/d2l/api/lp/1.0/users/whoami', appId, appKey, userKey)
  if (whoami.status === 0) return { assignments: [], error: 'Could not reach that school server. Check the URL and try again.' }
  if (!whoami.ok) return { assignments: [], error: `D2L responded with ${whoami.status}. Check your URL and Valence credentials.` }

  const enrollments = await d2lGet(base, '/d2l/api/lp/1.5/enrollments/myenrollments/', appId, appKey, userKey)
  if (!enrollments.ok) return { assignments: [], error: 'D2L could not load your enrollments. Your school may not have granted assignment access.' }
  const items = (enrollments.data as { Items?: Array<{ OrgUnit?: { Id?: number; Name?: string } }> } | null)?.Items || []
  if (!Array.isArray(items)) return { assignments: [], error: 'D2L returned an unexpected enrollments response.' }

  const assignments: Assignment[] = []
  for (const entry of items) {
    const orgUnitId = entry?.OrgUnit?.Id
    const courseName = entry?.OrgUnit?.Name || 'Course'
    if (!orgUnitId) continue
    const work = await d2lGet(base, `/d2l/api/le/1.4/${orgUnitId}/assignments/`, appId, appKey, userKey)
    if (!work.ok) continue
    const objects = (work.data as { Objects?: Array<Record<string, unknown>> } | null)?.Objects
    if (!Array.isArray(objects)) continue
    for (const item of objects) {
      const id = item.Id
      if (!id) continue
      const dueIso = typeof item.DueDate === 'string' ? item.DueDate : undefined
      assignments.push({
        id: `d2l-${orgUnitId}-${id}`,
        title: String(item.Name || 'Untitled assignment'),
        className: courseName,
        ...dueFields(dueIso),
        priority: priorityFor(dueIso),
        completed: false,
        source: 'D2L',
        notes: '',
        providerId: String(id),
        courseId: String(orgUnitId),
        description: typeof item.Instructions === 'string' ? stripHtml(item.Instructions) : undefined,
        updatedAt: new Date().toISOString(),
      })
    }
  }
  return { assignments }
}

/** Dispatch to the right connector for a stored school connection. */
export async function fetchSchoolAssignments(conn: SchoolConnection): Promise<SchoolSyncResult> {
  switch (conn.id) {
    case 'canvas':
      if (!conn.baseUrl || !conn.token) return { assignments: [], error: 'Canvas needs a school URL and an access token.' }
      return syncCanvas(conn.baseUrl, conn.token)
    case 'moodle':
      if (!conn.baseUrl || !conn.token) return { assignments: [], error: 'Moodle needs a school URL and a web service token.' }
      return syncMoodle(conn.baseUrl, conn.token)
    case 'd2l':
      if (!conn.baseUrl || !conn.appId || !conn.appKey || !conn.userKey) {
        return { assignments: [], error: 'D2L needs the base URL plus the app ID, app key, and user key issued by your school.' }
      }
      return syncD2L(conn.baseUrl, conn.appId, conn.appKey, conn.userKey)
    default:
      return { assignments: [], error: 'Unknown school portal.' }
  }
}
