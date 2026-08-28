import { useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, ExternalLink, GraduationCap, LogOut, RefreshCw } from 'lucide-react'
import type { Assignment } from '../types'
import type { ClassroomController } from '../google/useClassroom'
import { formatRelative } from '../utils'
import { PageHeader } from '../components/ui'

const CLASS_COLORS = ['#4285F4', '#0F9D58', '#F4B400', '#DB4437', '#AB47BC', '#00ACC1', '#5F6368']

function colorFor(key: string): string {
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return CLASS_COLORS[hash % CLASS_COLORS.length]
}

function SyncStatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    synced: { label: 'Synced', tone: 'success' },
    syncing: { label: 'Syncing…', tone: 'syncing' },
    failed: { label: 'Sync failed', tone: 'error' },
    'auth-required': { label: 'Reconnect needed', tone: 'warning' },
    offline: { label: 'Offline', tone: 'warning' },
    'signed-out': { label: 'Not connected', tone: 'muted' },
    unconfigured: { label: 'Not configured', tone: 'muted' },
  }
  const info = map[status] || map['signed-out']
  return <span className={`status-badge ${info.tone}`}>{info.label}</span>
}

type ClassInfo = { name: string; count: number }

export function Classroom({
  classroom,
  classroomAssignments,
}: {
  classroom: ClassroomController
  classroomAssignments: Assignment[]
}) {
  const { status, session, syncing, error, summary, lastSyncedAt, progress, autoSync, setAutoSync, connect, disconnect, runSync } = classroom
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<'stream' | 'classwork' | 'people'>('stream')
  const connected = status === 'synced' || status === 'syncing' || status === 'failed' || status === 'auth-required' || status === 'offline'

  const classes = useMemo(() => {
    const map = new Map<string, ClassInfo>()
    for (const a of classroomAssignments) {
      const key = a.courseId || a.className
      const existing = map.get(key) || { name: a.className, count: 0 }
      existing.count += 1
      map.set(key, existing)
    }
    return [...map.entries()].map(([key, info]) => ({ key, ...info }))
  }, [classroomAssignments])

  const selectedClass = selected ? classes.find((c) => c.key === selected) : undefined
  const classAssignments = selectedClass
    ? classroomAssignments
        .filter((a) => (a.courseId || a.className) === selectedClass.key)
        .sort((a, b) => a.dueInDays - b.dueInDays)
    : []

  return (
    <div className="page classroom-page">
      <PageHeader
        eyebrow="GOOGLE INTEGRATION"
        title="Classroom"
        subtitle="Your classes and coursework, synced from Google Classroom."
        action={session ? <button className="secondary" onClick={disconnect}><LogOut size={15} /> Disconnect</button> : undefined}
      />
      <div className="classroom-toolbar card">
        <div className="classroom-brand">
          <div className="classroom-logo"><GraduationCap size={20} /></div>
          <div><strong>Google Classroom</strong><small>{session ? `Connected as ${session.email}` : 'Not connected'}</small></div>
        </div>
        <div className="classroom-toolbar-right">
          <SyncStatusChip status={status} />
          <button className="secondary small" onClick={() => runSync()} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? 'spin' : ''} /> Sync now
          </button>
          <div className="sync-control">
            <span>Auto-sync every 5 minutes</span>
            <button className={`toggle ${autoSync ? 'on' : ''}`} onClick={() => setAutoSync(!autoSync)} aria-label="Toggle five minute auto-sync"><i /></button>
          </div>
        </div>
      </div>

      {status === 'unconfigured' && (
        <div className="classroom-empty card">
          <div className="classroom-empty-icon"><GraduationCap size={28} /></div>
          <h2>Google integration is not configured</h2>
          <p>To connect a real Classroom account, create a Google Cloud project, enable the Classroom API, and create an OAuth client ID for <strong>http://localhost:1420</strong>. Then set <code>VITE_GOOGLE_CLIENT_ID</code> in your environment and restart.</p>
          <ol className="config-steps">
            <li>Create a project at console.cloud.google.com and enable the Google Classroom API.</li>
            <li>Configure the OAuth consent screen with your school account.</li>
            <li>Create an OAuth client ID of type “Web application” and add <code>http://localhost:1420</code> as an authorized JavaScript origin.</li>
            <li>Copy the client ID into <code>.env.local</code> as <code>VITE_GOOGLE_CLIENT_ID=…</code>.</li>
          </ol>
          <small>Development Mode is enabled. Nothing is faked — sync starts only after a real connection.</small>
        </div>
      )}

      {status === 'signed-out' && (
        <div className="classroom-empty card">
          <div className="classroom-empty-icon"><GraduationCap size={28} /></div>
          <h2>Connect your Classroom to get started</h2>
          <p>StudyFlow will import your real classes and coursework through the official Google Classroom API. Only these permissions are requested:</p>
          <ul className="permission-list">
            <li><Check size={14} /> See a list of your classes</li>
            <li><Check size={14} /> See coursework assigned to you, with due dates</li>
            <li><Check size={14} /> See whether each assignment is turned in</li>
            <li><Check size={14} /> See your name and email to label your account</li>
          </ul>
          <button className="primary" onClick={connect}><GraduationCap size={16} /> Connect Google Classroom</button>
          <small>Gmail and Google Drive stay disconnected. You can disconnect or delete your data at any time.</small>
        </div>
      )}

      {status === 'syncing' && (
        <div className="sync-progress card">
          {progress.map((p) => (
            <div key={p.id} className={`sync-step ${p.state}`}>
              {p.state === 'active' ? <span className="spinner" /> : p.state === 'done' ? <Check size={13} /> : <span className="step-dot" />}
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      )}

      {(status === 'failed' || status === 'auth-required' || status === 'offline') && error && (
        <div className={`error-banner ${status}`}>
          <div>
            <strong>{status === 'offline' ? "You're offline" : status === 'auth-required' ? 'Reconnection needed' : 'Sync failed'}</strong>
            <p>{error}</p>
          </div>
          {status === 'auth-required' ? (
            <button className="primary small" onClick={connect}>Reconnect Google</button>
          ) : (
            <button className="secondary small" onClick={() => runSync()}>Try again</button>
          )}
        </div>
      )}

      {connected && !selected && (
        <>
          {lastSyncedAt && (
            <p className="last-synced">
              Last synced {formatRelative(lastSyncedAt)}
              {summary && summary.restricted > 0 ? ` · ${summary.restricted} class${summary.restricted > 1 ? 'es' : ''} restricted by your school` : ''}
            </p>
          )}
          {summary && (
            <div className="summary-chips">
              <span className="chip"><strong>{summary.courses}</strong> classes</span>
              <span className="chip"><strong>{summary.assignments}</strong> assignments</span>
              <span className="chip accent"><strong>+{summary.added}</strong> new</span>
              <span className="chip"><strong>{summary.updated}</strong> updated</span>
            </div>
          )}

          <div className="gclass-section-label"><strong>Your classes</strong><span>{classes.length} class{classes.length === 1 ? '' : 'es'}</span></div>
          {classes.length ? (
            <div className="gclass-grid">
              {classes.map((c) => (
                <div className="gclass-card" key={c.key} onClick={() => setSelected(c.key)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSelected(c.key) }}>
                  <div className="gclass-card-header" style={{ background: colorFor(c.key) }}>
                    <strong>{c.name}</strong>
                  </div>
                  <div className="gclass-card-body">
                    <span>{c.count} assignment{c.count > 1 ? 's' : ''}</span>
                    <ChevronRight size={16} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-card"><GraduationCap size={28} /><h2>No classes imported</h2><p>When Classroom sync finds courses, they will appear here as class cards — just like the Classroom app.</p></div>
          )}
        </>
      )}

      {connected && selected && selectedClass && (
        <div className="gclass-detail">
          <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={15} /> All classes</button>
          <div className="gclass-detail-header" style={{ background: colorFor(selectedClass.key) }}>
            <div className="gclass-detail-avatar">{selectedClass.name.charAt(0)}</div>
            <div>
              <h2>{selectedClass.name}</h2>
              <span>{selectedClass.count} assignment{selectedClass.count > 1 ? 's' : ''} · synced from Google Classroom</span>
            </div>
          </div>
          <div className="classroom-tabs">
            <button className={`classroom-tab ${tab === 'stream' ? 'active' : ''}`} onClick={() => setTab('stream')}>Stream</button>
            <button className={`classroom-tab ${tab === 'classwork' ? 'active' : ''}`} onClick={() => setTab('classwork')}>Classwork</button>
            <button className={`classroom-tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>People</button>
          </div>

          {tab === 'stream' && (
            <div className="gclass-stream">
              {classAssignments.length ? classAssignments.map((a) => (
                <div className="gclass-post card" key={a.id}>
                  <span className="gclass-avatar" style={{ background: colorFor(selectedClass.key) }}>{selectedClass.name.charAt(0)}</span>
                  <div className="gclass-post-main">
                    <div className="gclass-post-head">
                      <strong>{a.title}</strong>
                      {a.alternateLink && (
                        <a href={a.alternateLink} target="_blank" rel="noreferrer" aria-label={`Open ${a.title} in Classroom`} onClick={(e) => e.stopPropagation()}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    <span className={`gclass-due ${a.dueInDays < 0 ? 'overdue' : ''}`}>
                      {a.dueInDays < 0 ? 'Missing' : 'Due'} {a.dueLabel}
                    </span>
                    {a.description && <p className="gclass-post-text">{a.description}</p>}
                    <div className="gclass-post-footer">
                      <span className={`submit-badge ${a.submissionState?.startsWith('TURNED_IN') ? 'turned-in' : ''}`}>
                        {a.submissionState?.startsWith('TURNED_IN') ? 'Turned in' : a.completed ? 'Done locally' : 'Not turned in'}
                      </span>
                      {a.maxPoints !== undefined && <span className="gclass-meta">{a.maxPoints} pts</span>}
                      {a.estimatedMinutes && <span className="gclass-meta">{a.estimatedMinutes} min est.</span>}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="empty-card"><GraduationCap size={28} /><h2>Nothing in the stream yet</h2><p>Published assignments for this class will show up here as posts.</p></div>
              )}
            </div>
          )}

          {tab === 'classwork' && (
            <div className="gclass-stream">
              {classAssignments.length ? classAssignments.map((a) => (
                <div className="gclass-post card" key={a.id}>
                  <span className="gclass-avatar" style={{ background: colorFor(selectedClass.key) }}>{selectedClass.name.charAt(0)}</span>
                  <div className="gclass-post-main">
                    <div className="gclass-post-head">
                      <strong>{a.title}</strong>
                      {a.alternateLink && (
                        <a href={a.alternateLink} target="_blank" rel="noreferrer" aria-label={`Open ${a.title} in Classroom`} onClick={(e) => e.stopPropagation()}>
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    <span className={`gclass-due ${a.dueInDays < 0 ? 'overdue' : ''}`}>
                      {a.dueInDays < 0 ? 'Missing' : 'Due'} {a.dueLabel}
                    </span>
                    <div className="gclass-post-footer">
                      <span className={`submit-badge ${a.submissionState?.startsWith('TURNED_IN') ? 'turned-in' : ''}`}>
                        {a.submissionState?.startsWith('TURNED_IN') ? 'Turned in' : 'Not turned in'}
                      </span>
                      {a.maxPoints !== undefined && <span className="gclass-meta">{a.maxPoints} pts</span>}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="empty-card"><GraduationCap size={28} /><h2>No classwork yet</h2><p>Published assignments for this class will be listed here.</p></div>
              )}
            </div>
          )}

          {tab === 'people' && (
            <div className="gclass-people card">
              <GraduationCap size={22} />
              <h3>People</h3>
              <p>
                StudyFlow uses student permissions, which do not include class rosters — so classmates and teachers are not
                listed here. You are enrolled in this class as a student, and your coursework is synced.
              </p>
              <span className="status-badge success">Enrolled as student</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
