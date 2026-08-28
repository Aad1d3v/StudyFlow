import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Loader2, Sparkles, Square, Trash2 } from 'lucide-react'
import type { Assignment } from '../types'
import type { AiMessage } from '../ai/useAiChat'
import { useAiChat } from '../ai/useAiChat'
import { PageHeader } from '../components/ui'

const QUICK_PROMPTS = [
  'What should I work on right now?',
  'Plan my evening',
  'What am I behind on?',
  'How much work do I have this week?',
  'Break this assignment into steps',
]

export function AIAssistant({ assignments, sessions }: { assignments: Assignment[]; sessions: { title: string; className: string; durationSeconds: number; completed: boolean }[] }) {
  const { messages, loading, send, stop, clear } = useAiChat(assignments, sessions)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    send(text)
  }

  const handleQuickPrompt = (prompt: string) => {
    if (loading) return
    send(prompt)
  }

  return (
    <div className="page ai-page">
      <PageHeader eyebrow="YOUR COPILOT" title="AI Assistant" subtitle="Ask anything about your workload — powered by OpenAI OSS 20B via Groq." />
      <div className="ai-layout">
        <div className="ai-chat card">
          <div className="ai-chat-head">
            <div className="ai-avatar"><Sparkles size={17} /></div>
            <div><strong>StudyFlow Assistant</strong><small>Powered by Groq · OpenAI OSS 20B</small></div>
            {messages.length > 0 && (
              <button className="text-button small" onClick={clear} title="Clear conversation"><Trash2 size={14} /></button>
            )}
          </div>

          <div className="ai-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="ai-welcome">
                <div className="ai-avatar large"><Sparkles size={24} /></div>
                <h3>What can I help you with?</h3>
                <p className="muted">I can see your {assignments.length} {assignments.length === 1 ? 'assignment' : 'assignments'} and your focus history. Ask me anything about your workload.</p>
                <div className="ai-quick-prompts">
                  {QUICK_PROMPTS.map((p) => (
                    <button key={p} className="secondary" onClick={() => handleQuickPrompt(p)} disabled={loading}>{p}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m: AiMessage) => (
              <div key={m.id} className={`ai-message ${m.role}`}>
                {m.role === 'assistant' && <div className="ai-avatar mini"><Sparkles size={13} /></div>}
                <div className="ai-bubble">
                  <div className="ai-bubble-content" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-message assistant">
                <div className="ai-avatar mini"><Sparkles size={13} /></div>
                <div className="ai-bubble typing">
                  <Loader2 size={16} className="spin" /> Thinking…
                </div>
              </div>
            )}
          </div>

          <form className="ai-input-bar" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }}
              placeholder="Ask about your workload…"
              rows={1}
              disabled={loading}
            />
            {loading ? (
              <button type="button" className="icon-button stop" onClick={stop} aria-label="Stop"><Square size={15} fill="currentColor" /></button>
            ) : (
              <button type="submit" className="icon-button primary" disabled={!input.trim()} aria-label="Send"><ArrowUp size={18} /></button>
            )}
          </form>
        </div>

        <div className="ai-side card">
          <Sparkles size={20} />
          <h3>Grounded in your data</h3>
          <p>Recommendations use your real deadlines, priorities, and durations. AI never invents grades, teacher instructions, or calendar events.</p>
          <div className="ai-stats">
            <div><strong>{assignments.filter((a) => !a.completed).length}</strong><small>Open tasks</small></div>
            <div><strong>{sessions.length}</strong><small>Focus sessions</small></div>
          </div>
          <div className="status-badge success">Groq · OpenAI OSS 20B</div>
        </div>
      </div>
    </div>
  )
}
