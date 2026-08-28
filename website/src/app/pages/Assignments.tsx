import { useMemo, useState } from 'react'
import { GraduationCap, Plus, RefreshCw } from 'lucide-react'
import type { Assignment, StudentProfile } from '../types'
import type { ClassroomController } from '../google/useClassroom'
import { formatRelative } from '../utils'
import { AssignmentRow, Empty, PageHeader, StudentCard } from '../components/ui'

type Filter = 'all' | 'today' | 'tomorrow' | 'week' | 'overdue' | 'completed'
type Sort = 'due' | 'priority' | 'duration' | 'class'

export function Assignments({
  assignments,
  toggleComplete,
  startFocus,
  onOpenDetails,
  setShowAdd,
  profile,
  userName,
  classroom,
  onOpenClassroom,
}: {
  assignments: Assignment[]
  toggleComplete: (id: string) => void
  startFocus: (a: Assignment) => void
  onOpenDetails: (id: string) => void
  setShowAdd: (v: boolean) => void
  profile: StudentProfile
  userName: string
  classroom: ClassroomController
  onOpenClassroom: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('due')

  const filtered = useMemo(() => {
    let list = [...assignments]
    switch (filter) {
      case 'today':
        list = list.filter((a) => a.dueInDays === 0)
        break
      case 'tomorrow':
        list = list.filter((a) => a.dueInDays === 1)
        break
      case 'week':
        list = list.filter((a) => a.dueInDays >= 0 && a.dueInDays < 7)
        break
      case 'overdue':
        list = list.filter((a) => a.dueInDays < 0 && !a.completed)
        break
      case 'completed':
        list = list.filter((a) => a.completed)
        break
    }
    const rank = { Critical: 0, High: 1, Medium: 2, Low: 3 }
    switch (sort) {
      case 'due':
        list.sort((a, b) => a.dueInDays - b.dueInDays || rank[a.priority] - rank[b.priority])
        break
      case 'priority':
        list.sort((a, b) => rank[a.priority] - rank[b.priority] || a.dueInDays - b.dueInDays)
        break
      case 'duration':
        list.sort((a, b) => (a.estimatedMinutes ?? 0) - (b.estimatedMinutes ?? 0) || a.dueInDays - b.dueInDays)
        break
      case 'class':
        list.sort((a, b) => a.className.localeCompare(b.className) || a.dueInDays - b.dueInDays)
        break
    }
    return list
  }, [assignments, filter, sort])

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'week', label: 'This week' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'completed', label: 'Completed' },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="YOUR WORKLOAD"
        title="Assignments"
        subtitle="Everything you need to finish, in one place."
        action={
          <div className="header-actions">
            <button
              className="secondary classroom-sync-button"
              onClick={() => (classroom.session ? classroom.runSync() : onOpenClassroom())}
              disabled={classroom.syncing}
              title={classroom.session ? 'Sync Google Classroom now' : 'Connect Google Classroom to sync assignments'}
            >
              <GraduationCap size={15} />
              {classroom.syncing ? 'Syncing…' : classroom.session ? 'Sync Classroom' : 'Connect Classroom'}
              {classroom.syncing && <RefreshCw size={13} className="spin" />}
            </button>
            <button className="primary" onClick={() => setShowAdd(true)}><Plus size={17} /> Add task</button>
          </div>
        }
      />
      <StudentCard profile={profile} fallbackName={userName} />
      {(classroom.session || classroom.error) && (
        <div className={`classroom-sync-status ${classroom.status === 'syncing' ? 'syncing' : ''}`}>
          <span className="sync-dot" />
          <span>
            {classroom.status === 'syncing'
              ? 'Syncing Google Classroom…'
              : classroom.error
                ? 'Classroom sync needs attention'
                : 'Google Classroom synced'}
            {classroom.lastSyncedAt && !classroom.syncing && ` · last synced ${formatRelative(classroom.lastSyncedAt)}`}
            {classroom.session && ' · auto-syncs every 5 minutes'}
          </span>
          {classroom.error && <span className="sync-error-text">{classroom.error}</span>}
        </div>
      )}
      <div className="filter-row">
        {filters.map((f) => (
          <button key={f.key} className={`filter ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label}
            {f.key === 'all' && <span>{assignments.length}</span>}
          </button>
        ))}
        <div className="sort">
          Sort:{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort assignments">
            <option value="due">Due date</option>
            <option value="priority">Priority</option>
            <option value="duration">Duration</option>
            <option value="class">Class</option>
          </select>
        </div>
      </div>
      <div className="assignment-list large">
        {filtered.map((a) => (
          <AssignmentRow key={a.id} assignment={a} toggleComplete={toggleComplete} startFocus={startFocus} onOpen={onOpenDetails} />
        ))}
      </div>
      {!filtered.length && (
        <Empty
          title="No assignments here"
          text="Try a different filter, or create a task yourself."
          action={<button className="secondary" onClick={() => setShowAdd(true)}><Plus size={15} /> Create task</button>}
        />
      )}
      <div className="details-hint"><span>Tip:</span> click any assignment for details, notes, and actions.</div>
    </div>
  )
}
