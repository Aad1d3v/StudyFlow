import type { Assignment } from '../types'
import { ApiError, authApi } from '../auth/api'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiChatResponse = {
  reply: string
  error?: string
}

function buildWorkloadContext(assignments: Assignment[], sessions: { title: string; className: string; durationSeconds: number; completed: boolean }[]): string {
  const incomplete = assignments.filter((a) => !a.completed)
  const completed = assignments.filter((a) => a.completed)
  const now = new Date().toISOString()

  const taskLines = incomplete.map(
    (a) => `- "${a.title}" (${a.className}) — due ${a.dueLabel}, priority ${a.priority}, estimated ${a.estimatedMinutes || 'unknown'} minutes${a.description ? `, description: ${a.description.slice(0, 100)}` : ''}`,
  )

  const recentSessions = sessions.slice(-5).map(
    (s) => `- "${s.title}" (${s.className}) — ${Math.round(s.durationSeconds / 60)} minutes, ${s.completed ? 'completed' : 'stopped'}`,
  )

  return `Current date: ${now}\nUpcoming assignments (${incomplete.length}):\n${taskLines.length ? taskLines.join('\n') : '(none)'}\n\nRecently completed: ${completed.length} total\nRecent focus sessions:\n${recentSessions.length ? recentSessions.join('\n') : '(none)'}`
}

function buildAssignmentHelpContext(assignment: Assignment | undefined): string {
  if (!assignment) {
    return 'No specific assignment selected — answer as a general study helper.'
  }
  const lines = [
    `Assignment: "${assignment.title}"`,
    `Class/Course: ${assignment.className}`,
    `Due: ${assignment.dueLabel}`,
    `Priority: ${assignment.priority}`,
    assignment.estimatedMinutes ? `Estimated time: ${assignment.estimatedMinutes} minutes` : null,
    assignment.description ? `Official description: ${assignment.description}` : null,
    assignment.notes ? `Student notes: ${assignment.notes}` : null,
    assignment.completed ? 'Status: marked complete by the student' : 'Status: not completed',
  ].filter(Boolean)
  const attachments = assignment.attachments ?? []
  if (attachments.length) {
    lines.push('Attached files:')
    for (const att of attachments) {
      const text = att.text ? `\n--- content of ${att.name} ---\n${att.text.slice(0, 3000)}\n--- end ---` : ''
      lines.push(`- ${att.name} (${Math.round(att.size / 1024)} KB, ${att.type})${text}`)
    }
  }
  return lines.join('\n')
}

/**
 * The AI model runs on the StudyFlow backend (Groq, OpenAI OSS 20B). The API
 * key never ships in the desktop app — the frontend only sends the chat
 * history and workload context, and the backend calls the provider.
 */
export async function sendAiMessage(
  messages: ChatMessage[],
  assignments: Assignment[],
  sessions: { title: string; className: string; durationSeconds: number; completed: boolean }[],
  signal?: AbortSignal,
): Promise<AiChatResponse> {
  const context = buildWorkloadContext(assignments, sessions)

  try {
    const { answer } = await authApi.chat(messages, context, signal)
    return { reply: answer }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { reply: '', error: 'Request cancelled.' }
    }
    if (e instanceof ApiError && e.status === 401) {
      return { reply: '', error: 'Your session expired. Sign in again from the account menu.' }
    }
    return { reply: '', error: 'Could not reach the AI service. Check your connection and try again.' }
  }
}

/**
 * Assignment Help: same backend, but the context is the specific assignment
 * (description, notes, and attached file contents) instead of the whole
 * workload. Chat history is persisted per account by the page.
 */
export async function sendAssignmentHelpMessage(
  messages: ChatMessage[],
  assignment: Assignment | undefined,
  signal?: AbortSignal,
): Promise<AiChatResponse> {
  const context = buildAssignmentHelpContext(assignment)
  try {
    const { answer } = await authApi.chat(messages, context, signal)
    return { reply: answer }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { reply: '', error: 'Request cancelled.' }
    }
    if (e instanceof ApiError && e.status === 401) {
      return { reply: '', error: 'Your session expired. Sign in again from the account menu.' }
    }
    return { reply: '', error: 'Could not reach the AI service. Check your connection and try again.' }
  }
}
