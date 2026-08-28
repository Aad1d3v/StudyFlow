import { CalendarRange, Download, LogOut, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { APP_CONFIG } from '../config'
import type { SchoolYear, StudentProfile, ThemeMode } from '../types'
import type { AuthUser } from '../auth/api'
import type { ClassroomController } from '../google/useClassroom'
import { PageHeader } from '../components/ui'

export function Settings({
  themeMode,
  setThemeMode,
  schoolYear,
  setSchoolYear,
  classroom,
  user,
  profile,
  setProfile,
  onSignOut,
  onLoadSample,
  onExport,
  onClearData,
  onReset,
}: {
  themeMode: ThemeMode
  setThemeMode: (m: ThemeMode) => void
  schoolYear: SchoolYear
  setSchoolYear: (s: SchoolYear) => void
  classroom: ClassroomController
  user: AuthUser
  profile: StudentProfile
  setProfile: (p: StudentProfile) => void
  onSignOut: () => void
  onLoadSample: () => void
  onExport: () => void
  onClearData: () => void
  onReset: () => void
}) {
  const cardName = profile.name?.trim() || user.name
  const cardInitials = cardName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'ST'
  return (
    <div className="page">
      <PageHeader eyebrow="PREFERENCES" title="Settings" subtitle="Make StudyFlow work the way you do." />
      <div className="settings-list card">
        <div className="setting-section">
          <p className="eyebrow">ACCOUNT</p>
          <div className="setting-row">
            <div><strong>{user.name}</strong><small>{user.email} · Your assignments, plans, and focus history sync to this account.</small></div>
            <button className="secondary small" onClick={onSignOut}><LogOut size={14} /> Sign out</button>
          </div>
        </div>

        <div className="setting-section">
          <p className="eyebrow">APPEARANCE</p>
          <div className="setting-row">
            <div><strong>Theme</strong><small>Follow your system, or pick light or dark.</small></div>
            <select value={themeMode} onChange={(e) => setThemeMode(e.target.value as ThemeMode)} aria-label="Theme">
              <option value="system">System default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>

        <div className="setting-section student-card-section">
          <p className="eyebrow">STUDENT CARD</p>
          <p className="setting-hint">Your name, school, and a short bio — shown as a student card on your dashboard.</p>
          <div className="student-card-layout">
            <div className="student-card-editor">
              <label>Name<input value={profile.name ?? ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder={user.name} /></label>
              <label>School<input value={profile.school ?? ''} onChange={(e) => setProfile({ ...profile, school: e.target.value })} placeholder="e.g. Lincoln High School" /></label>
              <label>Short bio<textarea value={profile.bio ?? ''} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder="e.g. Senior · loves chemistry, chess, and coffee" /></label>
            </div>
            <div className="student-card-preview">
              <div className="student-card-head">
                <span className="student-card-avatar">{cardInitials}</span>
                <div>
                  <small>STUDENT CARD</small>
                  <strong>{cardName}</strong>
                </div>
              </div>
              <div className="student-card-body">
                <div className="student-card-school">
                  <small>SCHOOL</small>
                  <strong>{profile.school?.trim() || 'Not set yet'}</strong>
                </div>
                <div className="student-card-bio">
                  <small>ABOUT</small>
                  <p>{profile.bio?.trim() || 'Write a short bio to introduce yourself.'}</p>
                </div>
                <span className="student-card-brand"><Sparkles size={11} /> {APP_CONFIG.name}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="setting-section">
          <p className="eyebrow">SCHOOL YEAR</p>
          <div className="setting-row school-year-row">
            <div>
              <strong><CalendarRange size={14} /> Your school year</strong>
              <small>The end date also unlocks your Letter to Yourself on the last day of the year.</small>
            </div>
            <div className="school-year-inputs">
              <label>Start<input type="date" value={schoolYear.start ?? ''} onChange={(e) => setSchoolYear({ ...schoolYear, start: e.target.value || undefined })} /></label>
              <label>End<input type="date" value={schoolYear.end ?? ''} onChange={(e) => setSchoolYear({ ...schoolYear, end: e.target.value || undefined })} /></label>
            </div>
          </div>
        </div>

        <div className="setting-section">
          <p className="eyebrow">GOOGLE</p>
          <div className="setting-row">
            <div><strong>Google Account</strong><small>{classroom.session ? `Connected as ${classroom.session.email}` : 'Connect Google Classroom from the Integrations section.'}</small></div>
            {classroom.session ? <button className="danger-link" onClick={classroom.disconnect}>Disconnect</button> : <span className="status-badge">Not connected</span>}
          </div>
        </div>

        <div className="setting-section">
          <p className="eyebrow">SYNCHRONIZATION</p>
          <div className="setting-row">
            <div><strong>Auto-sync</strong><small>Refresh Classroom every 5 minutes when connected.</small></div>
            <button className={`toggle ${classroom.autoSync ? 'on' : ''}`} onClick={() => classroom.setAutoSync(!classroom.autoSync)} aria-label="Toggle auto-sync"><i /></button>
          </div>
        </div>

        <div className="setting-section">
          <p className="eyebrow">DATA</p>
          {APP_CONFIG.isDevelopment && (
            <div className="setting-row">
              <div><strong>Load sample data</strong><small>Development only — fills the app with clearly-labeled sample assignments. Never shown to signed-in users unless you ask for it.</small></div>
              <button className="secondary small" onClick={onLoadSample}>Load</button>
            </div>
          )}
          <div className="setting-row">
            <div><strong>Export data</strong><small>Download your assignments, sessions, and goals as JSON.</small></div>
            <button className="secondary small" onClick={onExport}><Download size={14} /> Export</button>
          </div>
          <div className="setting-row">
            <div><strong>Delete local data</strong><small>Remove assignments, tasks, sessions, and plans from this device.</small></div>
            <button className="danger-link" onClick={onClearData}><Trash2 size={13} /> Delete</button>
          </div>
          <div className="setting-row">
            <div><strong>Reset application</strong><small>Erase everything, including your account session and Google connection.</small></div>
            <button className="danger-link" onClick={onReset}><RotateCcw size={13} /> Reset</button>
          </div>
        </div>

        <div className="setting-section">
          <p className="eyebrow">ABOUT</p>
          <div className="setting-row">
            <div><strong>{APP_CONFIG.name}</strong><small>Version {APP_CONFIG.version} · {APP_CONFIG.isDevelopment ? 'Development build' : 'Production build'}</small><small>Made by Aadidev Prasanth</small></div>
            <span className="source-tag">Local first</span>
          </div>
        </div>
      </div>
    </div>
  )
}
