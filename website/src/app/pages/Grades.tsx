import { useState } from 'react'
import { Award, BarChart3, BookOpen, ClipboardList, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { Assignment, GradeClass } from '../types'
import { PageHeader } from '../components/ui'
import { buildReport, clampPercent, gradeToLetter, judgeClass } from '../grades'

type GradesTab = 'Classes' | 'Report'

const verdictLabel: Record<string, string> = {
  secured: 'Target secured',
  'on-track': 'On track',
  'needs-work': 'Needs work',
  'at-risk': 'At risk',
  'no-data': 'Add grades',
}

export function Grades({
  classes,
  setClasses,
  assignments,
}: {
  classes: GradeClass[]
  setClasses: React.Dispatch<React.SetStateAction<GradeClass[]>>
  assignments: Assignment[]
}) {
  const [tab, setTab] = useState<GradesTab>('Classes')
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [teacher, setTeacher] = useState('')
  const [current, setCurrent] = useState('')
  const [target, setTarget] = useState('90')

  const addClass = () => {
    if (!name.trim()) return
    setClasses((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        teacher: teacher.trim() || undefined,
        current: current === '' ? undefined : clampPercent(Number(current)),
        target: target === '' ? undefined : clampPercent(Number(target)),
        decidedPercent: 60,
      },
    ])
    setName('')
    setTeacher('')
    setCurrent('')
    setTarget('90')
    setShowAdd(false)
  }

  const update = (id: string, patch: Partial<GradeClass>) =>
    setClasses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  const remove = (id: string) => setClasses((prev) => prev.filter((c) => c.id !== id))

  const importFromAssignments = () => {
    const names = Array.from(new Set(assignments.map((a) => a.className).filter(Boolean)))
    if (!names.length) return
    setClasses((prev) => {
      const existing = new Set(prev.map((c) => c.name.toLowerCase()))
      const added = names
        .filter((n) => !existing.has(n.toLowerCase()))
        .map((n) => ({ id: crypto.randomUUID(), name: n, decidedPercent: 60 }))
      return [...prev, ...added]
    })
  }

  const report = buildReport(classes)

  return (
    <div className="page grades-page">
      <PageHeader
        eyebrow="GRADES & TARGETS"
        title="Grades"
        subtitle="Track where you are, set where you want to be, and let the judger tell you exactly what the rest of the term requires."
      />

      <div className="grades-tabs">
        <button className={tab === 'Classes' ? 'active' : ''} onClick={() => setTab('Classes')}><ClipboardList size={15} /> Classes</button>
        <button className={tab === 'Report' ? 'active' : ''} onClick={() => setTab('Report')}><BarChart3 size={15} /> Report</button>
      </div>

      {tab === 'Classes' && (
        <>
          <div className="grades-toolbar">
            <button className="secondary small" onClick={() => setShowAdd((v) => !v)}><Plus size={14} /> Add class</button>
            <button className="secondary small" onClick={importFromAssignments} disabled={!assignments.length}><RefreshCw size={14} /> Import from assignments</button>
            <span className="muted">{classes.length} class{classes.length === 1 ? '' : 'es'}</span>
          </div>

          {showAdd && (
            <div className="card grade-add-form">
              <div className="form-grid">
                <label>Class name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. AP Biology" autoFocus /></label>
                <label>Teacher (optional)<input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="e.g. Ms. Rivera" /></label>
                <label>Current grade %<input type="number" min="0" max="100" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="88" /></label>
                <label>Target grade %<input type="number" min="0" max="100" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="90" /></label>
              </div>
              <div className="grades-add-actions">
                <button className="primary" onClick={addClass}><Plus size={15} /> Add class</button>
                <button className="secondary" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </div>
          )}

          {classes.length === 0 && !showAdd ? (
            <div className="empty-card">
              <Award size={28} />
              <h2>No classes yet</h2>
              <p>Add your classes, or import them from the class names in your assignments. Set a target grade and the judger will tell you what you need on the remaining work.</p>
              <button className="primary" onClick={() => setShowAdd(true)}><Plus size={15} /> Add your first class</button>
            </div>
          ) : (
            <div className="grade-grid">
              {classes.map((c) => {
                const j = judgeClass(c)
                return (
                  <div className="grade-card card" key={c.id}>
                    <div className="grade-card-head">
                      <div>
                        <strong>{c.name}</strong>
                        <small>{c.teacher || 'No teacher set'}</small>
                      </div>
                      <button className="icon-button" onClick={() => remove(c.id)} aria-label={`Remove ${c.name}`}><Trash2 size={15} /></button>
                    </div>
                    <div className="grade-inputs">
                      <label>Current %<input type="number" min="0" max="100" value={c.current ?? ''} placeholder="—" onChange={(e) => update(c.id, { current: e.target.value === '' ? undefined : clampPercent(Number(e.target.value)) })} /></label>
                      <label>Target %<input type="number" min="0" max="100" value={c.target ?? ''} placeholder="—" onChange={(e) => update(c.id, { target: e.target.value === '' ? undefined : clampPercent(Number(e.target.value)) })} /></label>
                      <div className="grade-letter"><small>Now</small><strong>{c.current !== undefined ? gradeToLetter(c.current) : '—'}</strong></div>
                    </div>
                    <div className="grade-decided">
                      <div className="grade-decided-row">
                        <small>Grade already decided</small>
                        <strong>{c.decidedPercent ?? 0}%</strong>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={c.decidedPercent ?? 0}
                        onChange={(e) => update(c.id, { decidedPercent: Number(e.target.value) })}
                        aria-label={`How much of ${c.name} is already decided`}
                      />
                    </div>
                    <div className={`judge-banner ${j.verdict}`}>
                      <span className="judge-verdict">{verdictLabel[j.verdict]}</span>
                      <p>{j.message}</p>
                      {j.needed !== null && (
                        <strong className={j.achievable ? '' : 'judge-impossible'}>
                          {j.secured ? '✓ Target secured' : `Need ${Math.round(j.needed)}%`}
                        </strong>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'Report' && (
        <div className="grade-report">
          <div className="report-hero card">
            <div>
              <p className="kicker">REPORT CARD ANALYSIS</p>
              <h2>{report.average !== null ? `${report.average.toFixed(1)}%` : '—'}</h2>
              <p>Overall average</p>
            </div>
            <div className="report-hero-stats">
              <div><strong>{report.letter ?? '—'}</strong><small>Letter grade</small></div>
              <div><strong>{report.gpa !== null ? report.gpa.toFixed(2) : '—'}</strong><small>GPA (4.0)</small></div>
              <div><strong>{report.onTrack}</strong><small>On track</small></div>
              <div><strong className={report.atRisk ? 'at-risk-text' : ''}>{report.atRisk}</strong><small>At risk</small></div>
            </div>
          </div>

          {classes.length > 0 ? (
            <>
              <div className="card report-table-card">
                <table className="report-table">
                  <thead>
                    <tr><th>Class</th><th>Current</th><th>Target</th><th>Letter</th><th>Need on remaining</th><th>Verdict</th></tr>
                  </thead>
                  <tbody>
                    {report.rows.map(({ cls, letter, judgment }) => (
                      <tr key={cls.id}>
                        <td><strong>{cls.name}</strong>{cls.teacher && <small>{cls.teacher}</small>}</td>
                        <td>{cls.current !== undefined ? `${cls.current.toFixed(0)}%` : '—'}</td>
                        <td>{cls.target !== undefined ? `${cls.target.toFixed(0)}%` : '—'}</td>
                        <td className="report-letter">{letter}</td>
                        <td>{judgment.needed !== null ? `${Math.round(judgment.needed)}%` : '—'}</td>
                        <td><span className={`report-verdict ${judgment.verdict}`}>{verdictLabel[judgment.verdict]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card report-summary">
                <BookOpen size={18} />
                <p>{report.summary}</p>
              </div>
            </>
          ) : (
            <div className="empty-card">
              <BarChart3 size={28} />
              <h2>Nothing to analyze yet</h2>
              <p>Add classes and enter your current grades — StudyFlow will build a report-card style analysis with your average, GPA, and what each class needs.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
