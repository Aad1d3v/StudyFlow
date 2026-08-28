import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Loader2, MessageSquareText, Plus, Sparkles, Square, Trash2, X } from 'lucide-react'
import type { Assignment, HelpChat, HelpMessage } from '../types'
import type { ChatMessage } from '../ai/groq'
import { sendAssignmentHelpMessage } from '../ai/groq'
import { PageHeader } from '../components/ui'
import { formatRelative } from '../utils'

export function AssignmentHelp({
  assignments,
  chats,
  setChats,
}: {
  assignments: Assignment[]
  chats: HelpChat[]
  setChats: React.Dispatch<React.SetStateAction<HelpChat[]>>
}) {
  const [activeId, setActiveId] = useState<string | null>(chats[0]?.id ?? null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newAssignmentId, setNewAssignmentId] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Mirror of chats so the async send path can read the latest list.
  const chatsRef = useRef(chats)
  chatsRef.current = chats

  const sorted = [...chats].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  const active = chats.find((c) => c.id === activeId) ?? null
  const activeAssignment = active?.assignmentId ? assignments.find((a) => a.id === active.assignmentId) : undefined

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [active?.messages, loading])

  const patchChat = (id: string, patch: (chat: HelpChat) => HelpChat) => {
    setChats((prev) => prev.map((c) => (c.id === id ? patch(c) : c)))
  }

  const sendTo = async (chatId: string, text: string) => {
    const chat = chatsRef.current.find((c) => c.id === chatId)
    if (!chat) return
    const userMsg: HelpMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() }
    patchChat(chatId, (c) => ({ ...c, messages: [...c.messages, userMsg], updatedAt: new Date().toISOString() }))
    setLoading(true)

    const history: ChatMessage[] = [...chat.messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
    const controller = new AbortController()
    abortRef.current = controller

    const assignment = chat.assignmentId ? assignments.find((a) => a.id === chat.assignmentId) : undefined
    const { reply, error } = await sendAssignmentHelpMessage(history, assignment, controller.signal)
    const replyMsg: HelpMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: error && !reply ? `⚠️ ${error}` : reply,
      timestamp: Date.now(),
    }
    patchChat(chatId, (c) => ({ ...c, messages: [...c.messages, replyMsg], updatedAt: new Date().toISOString() }))
    setLoading(false)
    abortRef.current = null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!active || loading) return
    const text = input.trim()
    if (!text) return
    setInput('')
    sendTo(active.id, text)
  }

  const createChat = () => {
    const assignmentId = newAssignmentId || assignments.find((a) => !a.completed)?.id || ''
    const assignment = assignments.find((a) => a.id === assignmentId)
    const chat: HelpChat = {
      id: crypto.randomUUID(),
      title: assignment ? assignment.title : 'General question',
      assignmentId: assignment ? assignment.id : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    }
    setChats((prev) => [...prev, chat])
    setActiveId(chat.id)
    const question = newQuestion.trim()
    setShowNew(false)
    setNewQuestion('')
    setNewAssignmentId('')
    if (question) {
      // Wait one tick so the chat exists in chatsRef before sending.
      window.setTimeout(() => sendTo(chat.id, question), 0)
    }
  }

  const deleteChat = (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (activeId === id) setActiveId(null)
  }

  return (
    <div className="page help-page">
      <PageHeader
        eyebrow="AI TUTOR"
        title="Assignment Help"
        subtitle="Ask for help on any assignment — the AI reads its description, your notes, and the files you attached."
        action={
          <button className="primary" onClick={() => setShowNew(true)}>
            <Plus size={15} /> New chat
          </button>
        }
      />
      <div className="help-layout">
        <aside className="help-chats card">
          <div className="help-chats-head">
            <MessageSquareText size={14} />
            <strong>Chat history</strong>
            <span>{chats.length}</span>
          </div>
          {sorted.length === 0 ? (
            <div className="help-chats-empty">
              <p>No chats yet. Start one to get help with an assignment.</p>
            </div>
          ) : (
            <ul className="help-chat-list">
              {sorted.map((c) => (
                <li key={c.id}>
                  <button className={`help-chat-item ${c.id === activeId ? 'active' : ''}`} onClick={() => setActiveId(c.id)}>
                    <span className="help-chat-title">{c.title}</span>
                    <span className="help-chat-preview">{c.messages.length ? c.messages[c.messages.length - 1].content.slice(0, 60) : 'No messages yet'}</span>
                    <span className="help-chat-time">{formatRelative(c.updatedAt)}</span>
                  </button>
                  <button className="help-chat-delete" onClick={() => deleteChat(c.id)} aria-label={`Delete chat ${c.title}`}>
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="help-chat card">
          {!active ? (
            <div className="help-chat-empty">
              <div className="ai-avatar large"><Sparkles size={24} /></div>
              <h3>Start an assignment help chat</h3>
              <p className="muted">Pick an assignment and ask anything — how to start, what the prompt is asking, how to structure it, or a step-by-step plan. Text files you attach to an assignment are readable by the AI.</p>
              <button className="primary" onClick={() => setShowNew(true)}><Plus size={15} /> New chat</button>
            </div>
          ) : (
            <>
              <div className="help-chat-head">
                <div>
                  <strong>{active.title}</strong>
                  <small>
                    {activeAssignment
                      ? `${activeAssignment.className} · Due ${activeAssignment.dueLabel}${activeAssignment.attachments?.length ? ` · ${activeAssignment.attachments.length} file${activeAssignment.attachments.length > 1 ? 's' : ''} attached` : ''}`
                      : 'General question'}
                  </small>
                </div>
                <button className="text-button small" onClick={() => deleteChat(active.id)} title="Delete this chat"><Trash2 size={14} /></button>
              </div>
              <div className="ai-messages" ref={scrollRef}>
                {active.messages.length === 0 && (
                  <div className="ai-welcome">
                    <div className="ai-avatar large"><Sparkles size={24} /></div>
                    <h3>How can I help with this?</h3>
                    <p className="muted">Ask me to explain the assignment, break it into steps, suggest an outline, or review your plan.</p>
                  </div>
                )}
                {active.messages.map((m: HelpMessage) => (
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
                    <div className="ai-bubble typing"><Loader2 size={16} className="spin" /> Thinking…</div>
                  </div>
                )}
              </div>
              <form className="ai-input-bar" onSubmit={handleSubmit}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e) } }}
                  placeholder={`Ask about "${active.title}"…`}
                  rows={1}
                  disabled={loading}
                />
                {loading ? (
                  <button type="button" className="icon-button stop" onClick={() => abortRef.current?.abort()} aria-label="Stop"><Square size={15} fill="currentColor" /></button>
                ) : (
                  <button type="submit" className="icon-button primary" disabled={!input.trim()} aria-label="Send"><ArrowUp size={18} /></button>
                )}
              </form>
            </>
          )}
        </div>
      </div>

      {showNew && (
        <div className="modal-backdrop" onMouseDown={() => setShowNew(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div><p className="eyebrow">AI TUTOR</p><h2>New help chat</h2></div>
              <button className="icon-button" onClick={() => setShowNew(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <label>Assignment
              <select value={newAssignmentId} onChange={(e) => setNewAssignmentId(e.target.value)}>
                <option value="">General question (no assignment)</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>{a.title} · {a.className}{a.completed ? ' · done' : ''}</option>
                ))}
              </select>
            </label>
            <label>Your question (optional)<textarea rows={4} value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} placeholder="e.g. Can you explain what this prompt is asking and help me outline a response?" /></label>
            <button className="primary full" onClick={createChat}><Sparkles size={15} /> Start chat</button>
          </div>
        </div>
      )}
    </div>
  )
}
