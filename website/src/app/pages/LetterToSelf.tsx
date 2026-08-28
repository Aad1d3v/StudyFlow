import { useMemo, useState } from 'react'
import { CalendarClock, Lock, Mail, PenLine, Unlock } from 'lucide-react'
import type { LetterToSelf, SchoolYear } from '../types'
import { PageHeader } from '../components/ui'
import { dateFromKey, dateKey, formatRelative } from '../utils'

function daysUntilReveal(revealDate: string, now: Date = new Date()): number {
  const reveal = dateFromKey(revealDate)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((reveal.getTime() - today.getTime()) / 86400000)
}

function defaultReveal(schoolYear: SchoolYear): string {
  if (schoolYear.end) return schoolYear.end
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return dateKey(d)
}

function formatReveal(revealDate: string): string {
  return dateFromKey(revealDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export function LetterToSelfPage({
  letters,
  setLetters,
  schoolYear,
}: {
  letters: LetterToSelf[]
  setLetters: React.Dispatch<React.SetStateAction<LetterToSelf[]>>
  schoolYear: SchoolYear
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const current = letters[letters.length - 1] ?? null
  const archived = letters.slice(0, -1).reverse()
  // The effective reveal date follows the school year end if one is set — so
  // updating the school year in Settings updates when the letter unlocks.
  const effectiveReveal = schoolYear.end || current?.revealDate || defaultReveal(schoolYear)
  const daysLeft = current ? daysUntilReveal(effectiveReveal) : null
  const ready = current && !current.openedAt && (daysLeft ?? 1) <= 0

  const seal = () => {
    const trimmed = content.trim()
    if (!trimmed) return
    const letter: LetterToSelf = {
      id: crypto.randomUUID(),
      title: title.trim() || 'Letter to my future self',
      content: trimmed,
      createdAt: new Date().toISOString(),
      revealDate: defaultReveal(schoolYear),
    }
    setLetters((prev) => [...prev, letter])
    setEditing(false)
    setTitle('')
    setContent('')
  }

  const open = () => {
    if (!current) return
    setLetters((prev) => prev.map((l) => (l.id === current.id ? { ...l, openedAt: new Date().toISOString() } : l)))
  }

  return (
    <div className="page letter-page">
      <PageHeader
        eyebrow="TIME CAPSULE"
        title="Letter to Yourself"
        subtitle="Write a note to your future self. It stays sealed — even from you — until the end of your school year."
        action={current && !editing ? <button className="secondary" onClick={() => { setEditing(true); setTitle(''); setContent('') }}><PenLine size={15} /> Write a new letter</button> : undefined}
      />

      {!current && !editing && (
        <div className="letter-hero card">
          <div className="letter-hero-icon"><Mail size={30} /></div>
          <h2>A letter only future-you can read</h2>
          <p>
            Write down your goals, worries, or hopes for the year — then seal it. It stays hidden until{' '}
            <strong>{formatReveal(defaultReveal(schoolYear))}</strong>
            {schoolYear.end ? ' (the end of your school year)' : ' — set your school year end date in Settings to control when it unlocks.'}
          </p>
          <button className="primary" onClick={() => setEditing(true)}><PenLine size={15} /> Write my letter</button>
        </div>
      )}

      {editing && (
        <div className="letter-editor card">
          <p className="eyebrow">WRITE FREELY — IT'S PRIVATE</p>
          <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Letter to my future self" /></label>
          <label>Your letter<textarea rows={12} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Dear future me,&#10;&#10;This year I want to…" autoFocus /></label>
          <div className="letter-editor-actions">
            <button className="secondary" onClick={() => setEditing(false)}>Cancel</button>
            <button className="primary" onClick={seal} disabled={!content.trim()}>
              <Lock size={15} /> Seal my letter
            </button>
          </div>
          <small className="muted">Once sealed, you won't be able to read it until {formatReveal(defaultReveal(schoolYear))}. Nothing is faked — the text is stored securely in your account and simply hidden until then.</small>
        </div>
      )}

      {current && !editing && (
        <div className={`letter-card card ${current.openedAt ? 'opened' : 'sealed'}`}>
          {current.openedAt ? (
            <>
              <div className="letter-opened-head">
                <div className="letter-hero-icon"><Unlock size={26} /></div>
                <div>
                  <h2>{current.title}</h2>
                  <small>Opened {formatRelative(current.openedAt)}</small>
                </div>
              </div>
              <div className="letter-content" style={{ whiteSpace: 'pre-wrap' }}>{current.content}</div>
              <p className="muted letter-end">— From you, {new Date(current.createdAt).toLocaleDateString()}</p>
            </>
          ) : ready ? (
            <>
              <div className="letter-opened-head">
                <div className="letter-hero-icon"><Unlock size={26} /></div>
                <div>
                  <h2>Your letter is ready</h2>
                  <small>Sealed on {new Date(current.createdAt).toLocaleDateString()} · {current.title}</small>
                </div>
              </div>
              <p>The school year is over — time to read what past-you wrote.</p>
              <button className="primary" onClick={open}><Unlock size={15} /> Open my letter</button>
            </>
          ) : (
            <>
              <div className="letter-sealed-head">
                <div className="letter-sealed-stamp"><Lock size={22} /></div>
                <div>
                  <h2>{current.title}</h2>
                  <span className="status-badge warning">Sealed</span>
                </div>
              </div>
              <div className="letter-blur" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => <span key={i} />)}
              </div>
              <div className="letter-countdown">
                <CalendarClock size={16} />
                <span>
                  Unlocks <strong>{formatReveal(effectiveReveal)}</strong>
                  {daysLeft !== null && daysLeft > 0 && <em> · {daysLeft} day{daysLeft === 1 ? '' : 's'} to go</em>}
                </span>
              </div>
              <small className="muted">You sealed this letter on {new Date(current.createdAt).toLocaleDateString()}. Its contents are hidden until the reveal date — even from you.</small>
            </>
          )}
        </div>
      )}

      {archived.length > 0 && (
        <div className="letter-archived">
          <p className="eyebrow">PAST LETTERS</p>
          {archived.map((l) => (
            <div className="card letter-archive-item" key={l.id}>
              <Mail size={15} />
              <strong>{l.title}</strong>
              <span>{l.openedAt ? `Opened ${new Date(l.openedAt).toLocaleDateString()}` : 'Sealed'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
