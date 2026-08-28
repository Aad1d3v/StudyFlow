import { CalendarDays } from 'lucide-react'
import { PageHeader } from '../components/ui'

export function Calendar({ classroomStatus }: { classroomStatus: string }) {
  return (
    <div className="page">
      <PageHeader
        eyebrow="GOOGLE INTEGRATION"
        title="Calendar"
        subtitle="Keep commitments and study time visible together."
        action={<button className="secondary"><CalendarDays size={16} /> Connect Calendar</button>}
      />
      <div className="integration-banner card">
        <div className="integration-logo calendar-logo">31</div>
        <div><strong>Google Calendar</strong><p>Official Calendar synchronization will be enabled when Google OAuth is configured.</p></div>
        <span className="status-badge">{classroomStatus === 'synced' ? 'Classroom connected' : 'Not connected'}</span>
      </div>
      <div className="empty-card">
        <CalendarDays size={32} />
        <h2>Your calendar will appear here</h2>
        <p>Local planned sessions are already available in Planner. We will never invent events or claim a connection before one exists.</p>
      </div>
    </div>
  )
}
