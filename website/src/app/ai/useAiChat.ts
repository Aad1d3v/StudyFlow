import { useCallback, useRef, useState } from 'react'
import type { Assignment } from '../types'
import type { ChatMessage } from './groq'
import { sendAiMessage } from './groq'

export type AiMessage = { id: string; role: 'user' | 'assistant'; content: string; timestamp: number }

export function useAiChat(assignments: Assignment[], sessions: { title: string; className: string; durationSeconds: number; completed: boolean }[]) {
  const [messages, setMessages] = useState<AiMessage[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async (text: string) => {
    const userMsg: AiMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    const history: ChatMessage[] = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }))
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const { reply, error } = await sendAiMessage(history, assignments, sessions, controller.signal)
      if (error && !reply) {
        const errorMsg: AiMessage = { id: crypto.randomUUID(), role: 'assistant', content: `⚠️ ${error}`, timestamp: Date.now() }
        setMessages((prev) => [...prev, errorMsg])
      } else if (reply) {
        const aiMsg: AiMessage = { id: crypto.randomUUID(), role: 'assistant', content: reply, timestamp: Date.now() }
        setMessages((prev) => [...prev, aiMsg])
      }
    } catch {
      const errorMsg: AiMessage = { id: crypto.randomUUID(), role: 'assistant', content: '⚠️ Could not reach the AI service.', timestamp: Date.now() }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }, [messages, assignments, sessions])

  const stop = useCallback(() => { abortRef.current?.abort() }, [])
  const clear = useCallback(() => { setMessages([]) }, [])

  return { messages, loading, send, stop, clear }
}
