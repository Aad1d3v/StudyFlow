import { useState } from 'react'
import { Check, Loader2, Mail, Send, X } from 'lucide-react'
import { authApi } from '../auth/api'

export function ContactForm({
  userName,
  userEmail,
  onClose,
}: {
  userName: string
  userEmail: string
  onClose: () => void
}) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim() || sending) return
    setSending(true)
    setError('')
    try {
      await authApi.sendContact(subject.trim(), message.trim())
      setStatus('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message. Try again.')
      setStatus('error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal contact-modal" onMouseDown={(e) => e.stopPropagation()}>
      {status === 'sent' ? (
        <div className="contact-success">
          <div className="contact-success-icon"><Check size={26} /></div>
          <h2>Message sent</h2>
          <p>Thanks — Aadidev Prasanth has received your message and will get back to you at <strong>{userEmail}</strong>.</p>
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      ) : (
        <>
          <div className="modal-head">
            <div>
              <p className="eyebrow">CONTACT SUPPORT</p>
              <h2>Have a problem? Contact</h2>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>
          <form onSubmit={submit}>
            <div className="contact-from">
              <Mail size={14} />
              <span>From: <strong>{userName}</strong> · {userEmail}</span>
            </div>
            <label>Problem title
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Classroom sync stopped working" maxLength={140} required />
            </label>
            <label>What's the problem?
              <textarea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell me what happened, what you expected, and any steps you already tried." maxLength={5000} required />
            </label>
            {status === 'error' && <p className="form-error">{error}</p>}
            <button className="primary full" type="submit" disabled={!subject.trim() || !message.trim() || sending}>
              {sending ? <Loader2 size={16} className="spin" /> : <Send size={15} />} {sending ? 'Sending…' : 'Send message'}
            </button>
            <small className="muted contact-note">Your message goes straight to the StudyFlow team with your account email attached.</small>
          </form>
        </>
      )}
    </div>
  )
}
