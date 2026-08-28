import { useMemo, useState } from 'react'
import { ArrowLeft, ChevronRight, ExternalLink, GraduationCap, Key, Link2, RefreshCw, Server, Shield, Unplug } from 'lucide-react'
import type { Assignment, SchoolConnection } from '../types'
import { PageHeader } from '../components/ui'
import { formatRelative } from '../utils'

export type PortalInfo = {
  key: string
  name: string
  short: string
  tagline: string
  description: string
  features: string[]
  docsUrl: string
  docsLabel: string
  color: string
  baseUrl?: string
  apiNote?: string
  helpText?: string
}

const SOURCE: Record<string, Assignment['source']> = { canvas: 'Canvas', d2l: 'D2L', moodle: 'Moodle' }

export function Portal({
  portal,
  conn,
  onConnect,
  onDisconnect,
  onSync,
  syncing,
  assignments,
}: {
  portal: PortalInfo
  conn?: SchoolConnection
  onConnect: (config: Partial<SchoolConnection>) => void
  onDisconnect: () => void
  onSync: () => void
  syncing: boolean
  assignments: Assignment[]
}) {
  const [baseUrl, setBaseUrl] = useState(conn?.baseUrl || '')
  const [token, setToken] = useState(conn?.token || '')
  const [appId, setAppId] = useState(conn?.appId || '')
  const [appKey, setAppKey] = useState(conn?.appKey || '')
  const [userKey, setUserKey] = useState(conn?.userKey || '')
  const [selected, setSelected] = useState<string | null>(null)

  const isD2L = portal.key === 'd2l'
  const isMoodle = portal.key === 'moodle'
  const connected = Boolean(conn?.connected)
  const source = SOURCE[portal.key]

  const classes = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>()
    for (const a of assignments) {
      const key = a.courseId || a.className
      const existing = map.get(key) || { key, name: a.className, count: 0 }
      existing.count += 1
      map.set(key, existing)
    }
    return [...map.values()]
  }, [assignments])

  const selectedClass = selected ? classes.find((c) => c.key === selected) : undefined
  const classAssignments = selectedClass
    ? assignments
        .filter((a) => (a.courseId || a.className) === selectedClass.key)
        .sort((a, b) => a.dueInDays - b.dueInDays)
    : []

  const connect = () => {
    const config: Partial<SchoolConnection> = { name: portal.name }
    if (isD2L) {
      config.baseUrl = baseUrl.trim()
      config.appId = appId.trim()
      config.appKey = appKey.trim()
      config.userKey = userKey.trim()
    } else {
      config.baseUrl = baseUrl.trim()
      config.token = token.trim()
    }
    onConnect(config)
  }

  const canConnect = isD2L
    ? Boolean(baseUrl.trim() && appId.trim() && appKey.trim() && userKey.trim())
    : Boolean(baseUrl.trim() && token.trim())

  if (!connected) {
    return (
      <div className="page portal-page">
        <PageHeader eyebrow="SCHOOL INTEGRATION" title={portal.name} subtitle={portal.tagline} />

        <div className="integration-banner card">
          <div className="portal-logo" style={{ background: portal.color }}>
            {portal.short}
          </div>
          <div>
            <strong>{portal.name}</strong>
            <p>{portal.description}</p>
          </div>
          <span className="status-badge warning">Not connected</span>
        </div>

        <div className="portal-grid">
          <div className="card portal-card">
            <p className="eyebrow">WHAT IT SYNCES</p>
            <ul className="portal-features">
              {portal.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="muted portal-auto-note">
              <RefreshCw size={13} /> While connected, {portal.name} assignments are pulled automatically every 5 minutes and merged into your Assignments — no manual work needed.
            </p>
          </div>

          <div className="card portal-card">
            <p className="eyebrow">CONNECT YOUR SCHOOL</p>
            <div className="portal-status">
              <GraduationCap size={22} />
              <h3>Connect your school</h3>
              <p>Enter the details below to connect. StudyFlow reads your courses and assignments — you stay in control and can disconnect anytime.</p>
              <div className="portal-form">
                <label>
                  School URL
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={portal.baseUrl || 'https://your-school.instructure.com'}
                    type="url"
                  />
                </label>
                {isD2L ? (
                  <>
                    <label>Valence App ID (from your school)<input value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="app-id" /></label>
                    <label>Valence App Key (from your school)<input value={appKey} onChange={(e) => setAppKey(e.target.value)} placeholder="app-key" type="password" /></label>
                    <label>Valence User Key<input value={userKey} onChange={(e) => setUserKey(e.target.value)} placeholder="user-key" type="password" /></label>
                  </>
                ) : (
                  <label>
                    {isMoodle ? 'Web service token' : 'Access token'}
                    <input value={token} onChange={(e) => setToken(e.target.value)} placeholder={isMoodle ? 'Generate in Moodle → Preferences → Web services' : 'Create in Canvas → Account → Settings → New Access Token'} type="password" />
                  </label>
                )}
                {portal.helpText && <p className="muted portal-help-text">{portal.helpText}</p>}
              </div>
              {conn?.lastError && !connected && <p className="portal-error"><strong>Connection issue:</strong> {conn.lastError}</p>}
              <div className="portal-actions">
                <button className="primary" onClick={connect} disabled={!canConnect}><Link2 size={15} /> Connect {portal.short}</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card portal-help">
          <p className="eyebrow">GET YOUR CREDENTIALS</p>
          <p>
            {portal.name} uses a personal API token from your own account — StudyFlow never asks for your password. Follow the official guide to create one:
          </p>
          <a className="primary" href={portal.docsUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> {portal.docsLabel}
          </a>
        </div>

        <div className="portal-technical card">
          <p className="eyebrow">TECHNICAL DETAILS</p>
          <div className="portal-tech-grid">
            <div className="tech-item">
              <Server size={16} />
              <div>
                <strong>API Type</strong>
                <span>REST / JSON</span>
              </div>
            </div>
            <div className="tech-item">
              <Key size={16} />
              <div>
                <strong>Authentication</strong>
                <span>{isD2L ? 'Valence (signed requests)' : isMoodle ? 'Web service token' : 'Bearer access token'}</span>
              </div>
            </div>
            <div className="tech-item">
              <Shield size={16} />
              <div>
                <strong>Access Level</strong>
                <span>Read-only (courses, assignments)</span>
              </div>
            </div>
            <div className="tech-item">
              <RefreshCw size={16} />
              <div>
                <strong>Sync Frequency</strong>
                <span>Every 5 minutes</span>
              </div>
            </div>
          </div>
          {portal.apiNote && <p className="muted api-note">{portal.apiNote}</p>}
        </div>
      </div>
    )
  }

  // Connected — render the portal the way its native app does: a course grid,
  // then per-course assignments with due dates, points, and status.
  return (
    <div className="page classroom-page">
      <PageHeader
        eyebrow="SCHOOL INTEGRATION"
        title={portal.name}
        subtitle={portal.tagline}
        action={<button className="secondary" onClick={onDisconnect}><Unplug size={15} /> Disconnect</button>}
      />
      <div className="classroom-toolbar card">
        <div className="classroom-brand">
          <div className="portal-logo" style={{ background: portal.color }}>{portal.short}</div>
          <div>
            <strong>{portal.name}</strong>
            <small>{conn?.baseUrl || 'Connected'}</small>
          </div>
        </div>
        <div className="classroom-toolbar-right">
          <span className={`status-badge ${syncing ? 'syncing' : conn?.lastError ? 'error' : 'success'}`}>
            {syncing ? 'Syncing…' : conn?.lastError ? 'Sync issue' : 'Connected'}
          </span>
          <button className="secondary small" onClick={onSync} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? 'spin' : ''} /> Sync now
          </button>
          <div className="sync-control">
            <span>Auto-syncs every 5 minutes</span>
          </div>
        </div>
      </div>

      {conn?.lastError && (
        <div className="error-banner failed">
          <div>
            <strong>Sync failed</strong>
            <p>{conn.lastError}</p>
          </div>
          <button className="secondary small" onClick={onSync}>Try again</button>
        </div>
      )}

      {!selected ? (
        <>
          <p className="last-synced">Last synced {conn?.lastSyncAt ? formatRelative(conn.lastSyncAt) : 'just now'}</p>
          <div className="summary-chips">
            <span className="chip"><strong>{classes.length}</strong> course{classes.length === 1 ? '' : 's'}</span>
            <span className="chip"><strong>{assignments.length}</strong> assignment{assignments.length === 1 ? '' : 's'}</span>
          </div>

          <div className="gclass-section-label"><strong>Your courses</strong><span>{classes.length} course{classes.length === 1 ? '' : 's'}</span></div>
          {classes.length ? (
            <div className="gclass-grid">
              {classes.map((c) => (
                <div className="gclass-card" key={c.key} onClick={() => setSelected(c.key)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setSelected(c.key) }}>
                  <div className="gclass-card-header" style={{ background: portal.color }}>
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
            <div className="empty-card"><GraduationCap size={28} /><h2>No courses yet</h2><p>Your {portal.name} courses will appear here after the first successful sync.</p></div>
          )}
        </>
      ) : (
        selectedClass && (
          <div className="gclass-detail">
            <button className="back-link" onClick={() => setSelected(null)}><ArrowLeft size={15} /> All courses</button>
            <div className="gclass-detail-header" style={{ background: portal.color }}>
              <div className="gclass-detail-avatar">{selectedClass.name.charAt(0)}</div>
              <div>
                <h2>{selectedClass.name}</h2>
                <span>{selectedClass.count} assignment{selectedClass.count > 1 ? 's' : ''} · synced from {portal.name}</span>
              </div>
            </div>
            <div className="gclass-stream">
              {classAssignments.length ? classAssignments.map((a) => (
                <div className="gclass-post card" key={a.id}>
                  <span className="gclass-avatar" style={{ background: portal.color }}>{selectedClass.name.charAt(0)}</span>
                  <div className="gclass-post-main">
                    <div className="gclass-post-head">
                      <strong>{a.title}</strong>
                      {a.alternateLink && (
                        <a href={a.alternateLink} target="_blank" rel="noreferrer" aria-label={`Open ${a.title} in ${portal.name}`} onClick={(e) => e.stopPropagation()}>
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
                <div className="empty-card"><GraduationCap size={28} /><h2>Nothing here yet</h2><p>Assignments for this course will show up here after the next sync.</p></div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  )
}
