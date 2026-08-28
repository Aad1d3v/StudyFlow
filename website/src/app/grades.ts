import type { GradeClass } from './types'

/** Standard percentage → letter grade scale. */
export function gradeToLetter(p: number): string {
  if (p >= 97) return 'A+'
  if (p >= 93) return 'A'
  if (p >= 90) return 'A-'
  if (p >= 87) return 'B+'
  if (p >= 83) return 'B'
  if (p >= 80) return 'B-'
  if (p >= 77) return 'C+'
  if (p >= 73) return 'C'
  if (p >= 70) return 'C-'
  if (p >= 67) return 'D+'
  if (p >= 63) return 'D'
  if (p >= 60) return 'D-'
  return 'F'
}

const GPA_MAP: Record<string, number> = {
  'A+': 4.0, A: 4.0, 'A-': 3.7, 'B+': 3.3, B: 3.0, 'B-': 2.7,
  'C+': 2.3, C: 2.0, 'C-': 1.7, 'D+': 1.3, D: 1.0, 'D-': 0.7, F: 0,
}

export function gpaFor(p: number): number {
  return GPA_MAP[gradeToLetter(p)] ?? 0
}

export function clampPercent(v: number): number {
  if (Number.isNaN(v)) return 0
  return Math.min(100, Math.max(0, Math.round(v * 10) / 10))
}

export type Judgment = {
  decided: number // fraction 0-1
  remaining: number // fraction 0-1
  current: number
  target: number
  needed: number | null // % needed on remaining work (null = fully decided / no data)
  secured: boolean // target already guaranteed
  achievable: boolean // target reachable with ≤100% on remaining work
  verdict: 'no-data' | 'secured' | 'on-track' | 'needs-work' | 'at-risk'
  message: string
}

/**
 * The judger: given the current grade, the target grade, and how much of the
 * grade is already decided, work out exactly what's needed on the remaining
 * work. target = decided·current + remaining·needed  ⇒  needed = (target −
 * decided·current) / remaining.
 */
export function judgeClass(c: GradeClass): Judgment {
  const decided = clampPercent(c.decidedPercent ?? 0) / 100
  const remaining = Math.max(0, 1 - decided)
  const current = c.current
  const target = c.target

  if (current === undefined || target === undefined || current === null || target === null) {
    return {
      decided,
      remaining,
      current: current ?? 0,
      target: target ?? 0,
      needed: null,
      secured: false,
      achievable: true,
      verdict: 'no-data',
      message: 'Enter your current grade and a target grade to see what you need on the rest of the semester.',
    }
  }

  if (remaining <= 0) {
    const secured = current >= target
    return {
      decided: 1,
      remaining: 0,
      current,
      target,
      needed: null,
      secured,
      achievable: secured,
      verdict: secured ? 'secured' : 'at-risk',
      message: secured
        ? `Your grade is already decided at ${current.toFixed(0)}% — above your ${target.toFixed(0)}% target.`
        : `Your grade is already decided at ${current.toFixed(0)}% — below your ${target.toFixed(0)}% target. No work remains to change it.`,
    }
  }

  const needed = (target - decided * current) / remaining
  const achieved = clampPercent(needed)
  if (needed <= 0) {
    return {
      decided,
      remaining,
      current,
      target,
      needed: 0,
      secured: true,
      achievable: true,
      verdict: 'secured',
      message: `You're already on pace — ${current.toFixed(0)}% today holds a ${target.toFixed(0)}% finish even if the remaining ${Math.round(remaining * 100)}% dips.`,
    }
  }
  if (needed > 100) {
    return {
      decided,
      remaining,
      current,
      target,
      needed: achieved,
      secured: false,
      achievable: false,
      verdict: 'at-risk',
      message: `Even 100% on the remaining ${Math.round(remaining * 100)}% of your grade can't reach ${target.toFixed(0)}%. Consider extra credit or talking to your teacher.`,
    }
  }
  const verdict: Judgment['verdict'] = achieved >= 90 ? 'needs-work' : 'on-track'
  return {
    decided,
    remaining,
    current,
    target,
    needed: achieved,
    secured: false,
    achievable: true,
    verdict,
    message: `Score ${achieved.toFixed(0)}% or better on the remaining ${Math.round(remaining * 100)}% of your grade to finish at ${target.toFixed(0)}%.`,
  }
}

export type ReportRow = {
  cls: GradeClass
  letter: string
  judgment: Judgment
}

export type GradeReport = {
  rows: ReportRow[]
  average: number | null // mean of current grades (only classes with a current grade)
  gpa: number | null
  letter: string | null
  onTrack: number
  atRisk: number
  needsWork: number
  summary: string
}

/** Report-card style analysis across every class. */
export function buildReport(classes: GradeClass[]): GradeReport {
  const rows: ReportRow[] = classes.map((cls) => {
    const judgment = judgeClass(cls)
    return { cls, letter: cls.current !== undefined ? gradeToLetter(cls.current) : '—', judgment }
  })
  const withCurrent = rows.filter((r) => r.cls.current !== undefined)
  const average = withCurrent.length
    ? clampPercent(withCurrent.reduce((sum, r) => sum + (r.cls.current ?? 0), 0) / withCurrent.length)
    : null
  const gpa = average !== null ? Math.round(gpaFor(average) * 100) / 100 : null
  const letter = average !== null ? gradeToLetter(average) : null

  const onTrack = rows.filter((r) => r.judgment.verdict === 'secured' || r.judgment.verdict === 'on-track').length
  const atRisk = rows.filter((r) => r.judgment.verdict === 'at-risk').length
  const needsWork = rows.filter((r) => r.judgment.verdict === 'needs-work').length

  let summary: string
  if (rows.length === 0) {
    summary = 'Add classes and your current grades to generate a report-card analysis.'
  } else if (average === null) {
    summary = 'Enter a current grade for at least one class to see your overall average and GPA.'
  } else {
    const trend = atRisk > 0 ? ' Some classes need attention before the end of the term.' : ' You are on track across the board — keep locking in.'
    summary = `Across ${rows.length} class${rows.length === 1 ? '' : 'es'}, your current average is ${average.toFixed(1)}% (${letter}) — about a ${gpa?.toFixed(2)} GPA.${trend}`
  }

  return { rows, average, gpa, letter, onTrack, atRisk, needsWork, summary }
}
