import type { Assignment, PlanBlock, PlanResult } from './types'
import { dateKey, fmtMinutes, priorityRank, startOfDay } from './utils'

export type PlannerOptions = {
  days: number
  weekdayStart: number
  weekdayEnd: number
  weekendStart: number
  weekendEnd: number
  sessionMax: number
  breakMinutes: number
}

export const DEFAULT_PLANNER_OPTIONS: PlannerOptions = {
  days: 7,
  weekdayStart: 16 * 60, // 4:00 PM
  weekdayEnd: 21 * 60, // 9:00 PM
  weekendStart: 10 * 60, // 10:00 AM
  weekendEnd: 18 * 60, // 6:00 PM
  sessionMax: 50, // minutes of focus before a break
  breakMinutes: 10,
}

type Interval = { start: number; end: number }

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

function studyWindow(day: Date, opts: PlannerOptions, now: Date): [number, number] {
  const [start, end] = isWeekend(day)
    ? [opts.weekendStart, opts.weekendEnd]
    : [opts.weekdayStart, opts.weekdayEnd]
  const isToday = dateKey(day) === dateKey(now)
  if (isToday) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    return [Math.max(start, nowMinutes + 10), end]
  }
  return [start, end]
}

function freeIntervals(occupied: Interval[], windowStart: number, windowEnd: number): Interval[] {
  const sorted = [...occupied].sort((a, b) => a.start - b.start)
  const gaps: Interval[] = []
  let cursor = windowStart
  for (const block of sorted) {
    if (block.end <= cursor) continue
    if (block.start > cursor) gaps.push({ start: cursor, end: Math.min(block.start, windowEnd) })
    cursor = Math.max(cursor, block.end)
    if (cursor >= windowEnd) break
  }
  if (cursor < windowEnd) gaps.push({ start: cursor, end: windowEnd })
  return gaps.filter((g) => g.end > g.start)
}

function fit(gaps: Interval[], minutes: number): Interval | undefined {
  return gaps.find((g) => g.end - g.start >= minutes)
}

function addOccupied(map: Map<string, Interval[]>, key: string, start: number, end: number): void {
  const list = map.get(key) || []
  list.push({ start, end })
  map.set(key, list)
}

function dueDay(assignment: Assignment, today: Date, opts: PlannerOptions): Date {
  if (assignment.dueDateIso) {
    const d = new Date(assignment.dueDateIso)
    if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const days = assignment.dueInDays >= 99 ? opts.days - 1 : Math.max(0, assignment.dueInDays)
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days)
}

function insertBreaks(blocks: PlanBlock[], opts: PlannerOptions, windowStart: number, windowEnd: number): PlanBlock[] {
  const byDay = new Map<string, PlanBlock[]>()
  for (const b of blocks) {
    const list = byDay.get(b.date) || []
    list.push(b)
    byDay.set(b.date, list)
  }
  const out: PlanBlock[] = []
  for (const [, dayBlocks] of byDay) {
    dayBlocks.sort((a, b) => a.startMinutes - b.startMinutes)
    dayBlocks.forEach((b, i) => {
      out.push(b)
      const end = b.startMinutes + b.durationMinutes
      if (b.kind === 'focus' && b.durationMinutes >= opts.sessionMax) {
        const next = dayBlocks[i + 1]
        const breakEnd = end + opts.breakMinutes
        const fits = breakEnd <= windowEnd && (!next || next.startMinutes >= breakEnd)
        if (fits) {
          out.push({
            id: `${b.id}:break`,
            title: 'Break',
            date: b.date,
            startMinutes: end,
            durationMinutes: opts.breakMinutes,
            kind: 'break',
          })
        }
      }
    })
  }
  return out
}

/**
 * Deterministic auto-plan. Never schedules past a deadline, never overlaps,
 * inserts breaks, and reports overload honestly when work exceeds availability.
 */
export function buildPlan(
  assignments: Assignment[],
  opts: PlannerOptions = DEFAULT_PLANNER_OPTIONS,
  now: Date = new Date(),
): PlanResult {
  const today = startOfDay(now)
  const work = assignments.filter((a) => !a.completed)
  const sorted = [...work].sort(
    (a, b) => a.dueInDays - b.dueInDays || priorityRank(b.priority) - priorityRank(a.priority),
  )

  const occupied = new Map<string, Interval[]>()
  const blocks: PlanBlock[] = []
  const unscheduled: string[] = []
  let totalWork = 0

  for (const assignment of sorted) {
    const minutes = assignment.estimatedMinutes ?? 30
    totalWork += minutes
    const deadline = dueDay(assignment, today, opts)
    let placed = false

    for (let offset = 0; offset < opts.days; offset++) {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
      if (day.getTime() > deadline.getTime()) break
      const key = dateKey(day)
      const [start, end] = studyWindow(day, opts, now)
      const gaps = freeIntervals(occupied.get(key) || [], start, end)
      const slot = fit(gaps, minutes)
      if (slot) {
        const block: PlanBlock = {
          id: `plan:${assignment.id}:${key}:${slot.start}`,
          title: assignment.title,
          className: assignment.className,
          date: key,
          startMinutes: slot.start,
          durationMinutes: minutes,
          kind: 'focus',
          assignmentId: assignment.id,
        }
        addOccupied(occupied, key, slot.start, slot.start + minutes)
        blocks.push(block)
        placed = true
        break
      }
    }
    if (!placed) unscheduled.push(assignment.title)
  }

  const withBreaks = insertBreaks(blocks, opts, 0, 24 * 60)

  let availableMinutes = 0
  for (let offset = 0; offset < opts.days; offset++) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset)
    const [start, end] = studyWindow(day, opts, now)
    availableMinutes += Math.max(0, end - start)
  }

  const overloaded = totalWork > availableMinutes
  const message = overloaded
    ? `You have about ${fmtMinutes(totalWork)} of work, but only ${fmtMinutes(availableMinutes)} of study time available in the next ${opts.days} days.`
    : undefined

  return {
    blocks: withBreaks.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes),
    workMinutes: totalWork,
    availableMinutes,
    overloaded,
    unscheduled,
    message,
  }
}
