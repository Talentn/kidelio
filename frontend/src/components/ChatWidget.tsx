import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Loader2, ChevronDown } from 'lucide-react'
import { goPost, goGet, goWsUrl, goWsEnabled } from '../lib/goApi'
import { chatAgentLabel } from '../lib/chatDisplay'
import { useAuth } from '../context/AuthContext'

type Msg = {
  id: string
  sender_type: 'user' | 'agent' | 'system'
  sender_name: string
  content: string
  created_at: string
}

function mergeMsgs(prev: Msg[], incoming: Msg[]) {
  if (!incoming.length) return prev
  const seen = new Set(prev.map(m => m.id))
  const added = incoming.filter(m => !seen.has(m.id))
  return added.length ? [...prev, ...added] : prev
}

export function ChatWidget() {
  const { user } = useAuth()
  const [open, setOpen]       = useState(false)
  const [step, setStep]       = useState<'form' | 'chat'>('form')
  const [roomId, setRoomId]   = useState('')
  const [name, setName]       = useState(user?.name || '')
  const [email, setEmail]     = useState(user?.email || '')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState('')
  const [msgs, setMsgs]       = useState<Msg[]>([])
  const [input, setInput]     = useState('')
  const [wsLive, setWsLive] = useState(false)
  const [sending, setSending] = useState(false)
  const [position, setPosition]   = useState<number | null>(null)
  const [roomStatus, setRoomStatus] = useState<string | null>(null)
  const wsRef    = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pendingId = useRef(0)
  const pollMs = import.meta.env.PROD ? 5000 : 2500

  const beginNewChat = () => {
    wsRef.current?.close()
    sessionStorage.removeItem('chat_room_id')
    setRoomId('')
    setStep('form')
    setMsgs([])
    setRoomStatus(null)
    setPosition(null)
    setInput('')
  }

  const markRoomClosed = (closeMsg?: Msg) => {
    setRoomStatus('closed')
    setPosition(null)
    sessionStorage.removeItem('chat_room_id')
    wsRef.current?.close()
    if (closeMsg) setMsgs(prev => mergeMsgs(prev, [closeMsg]))
  }

  const refreshMessages = (room: string, signal?: AbortSignal) =>
    goGet<{ messages: Msg[]; room?: { status: string }; queue_position?: number }>(
      `/chat/rooms/${room}/messages`,
      signal
    )
      .then(data => {
        if (data.messages?.length) setMsgs(data.messages)
        if (data.room?.status === 'closed') {
          markRoomClosed()
          return
        }
        if (data.room?.status) {
          setRoomStatus(data.room.status)
          if (data.room.status === 'active') setPosition(null)
        }
        if (typeof data.queue_position === 'number' && data.room?.status === 'queued') {
          setPosition(data.queue_position)
        }
        if (data.messages?.some(m => m.sender_type === 'agent')) {
          setPosition(null)
          setRoomStatus('active')
        }
      })
      .catch(() => {})

  // Restore existing session
  useEffect(() => {
    const saved = sessionStorage.getItem('chat_room_id')
    if (saved) {
      setRoomId(saved)
      setStep('chat')
      refreshMessages(saved)
    }
  }, [])

  // Poll only while the chat panel is open (avoids background load on every page visit)
  useEffect(() => {
    if (!roomId || step !== 'chat' || !open || wsLive || roomStatus === 'closed') return

    const ac = new AbortController()
    let visible = document.visibilityState !== 'hidden'

    const tick = () => {
      if (visible) refreshMessages(roomId, ac.signal)
    }

    const onVisibility = () => {
      visible = document.visibilityState !== 'hidden'
      if (visible) tick()
    }

    tick()
    const id = setInterval(tick, pollMs)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
      ac.abort()
    }
  }, [roomId, step, open, wsLive, pollMs, roomStatus])

  // WebSocket only while chat panel is open (avoids hanging connections in background)
  useEffect(() => {
    if (!roomId || !open || !goWsEnabled() || roomStatus === 'closed') return
    setWsLive(false)
    const ws = new WebSocket(goWsUrl(`/chat/ws/${roomId}`))
    wsRef.current = ws
    const connectTimer = window.setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) ws.close()
    }, 5000)

    ws.onopen = () => {
      window.clearTimeout(connectTimer)
      setWsLive(true)
    }
    ws.onerror = () => ws.close()
    ws.onclose = () => {
      window.clearTimeout(connectTimer)
      setWsLive(false)
    }
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'history') {
        setMsgs(data.messages || [])
      } else if (data.type === 'message') {
        setMsgs(prev => mergeMsgs(prev, [data.message]))
      } else if (data.type === 'agent_joined') {
        setPosition(null)
        setRoomStatus('active')
      } else if (data.type === 'queue_position') {
        setPosition(data.position)
        setRoomStatus('queued')
      } else if (data.type === 'room_closed') {
        markRoomClosed(data.message)
      }
    }
    return () => {
      window.clearTimeout(connectTimer)
      ws.close()
    }
  }, [roomId, open, roomStatus])

  useEffect(() => {
    if (!open) return
    const container = bottomRef.current?.parentElement
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
  }, [msgs, open])

  const startChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setStarting(true)
    setStartError('')
    try {
      const res = await goPost<{ room_id: string }>('/chat/rooms', { name, email })
      sessionStorage.setItem('chat_room_id', res.room_id)
      setRoomId(res.room_id)
      setStep('chat')
      setPosition(null)
      setRoomStatus('queued')
      refreshMessages(res.room_id)
    } catch {
      setStartError('Impossible de démarrer le chat. Réessayez dans un instant.')
    } finally {
      setStarting(false)
    }
  }

  const send = async () => {
    const content = input.trim()
    if (!content || !roomId || sending || roomStatus === 'closed') return

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', content }))
      setInput('')
      return
    }

    const tempId = `pending-${++pendingId.current}`
    const optimistic: Msg = {
      id: tempId,
      sender_type: 'user',
      sender_name: name || 'Vous',
      content,
      created_at: new Date().toISOString(),
    }
    setInput('')
    setMsgs(prev => [...prev, optimistic])
    setSending(true)

    try {
      const data = await goPost<{ message: Msg }>(`/chat/rooms/${roomId}/messages`, { content })
      setMsgs(prev => prev.map(m => (m.id === tempId ? data.message : m)))
    } catch {
      setMsgs(prev => prev.filter(m => m.id !== tempId))
      markRoomClosed()
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {/* Floating button — lifted above mobile bottom nav so it doesn't cover Panier */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed right-4 z-[400] w-14 h-14 bg-brand-500 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-brand-600 transition-all hover:scale-105 bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6 md:right-6"
        aria-label="Chat support"
      >
        {open ? <ChevronDown size={22} /> : <MessageCircle size={22} />}
        {!open && msgs.length === 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white" />
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed right-4 z-[400] w-[340px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 animate-slide-up bottom-[calc(7.75rem+env(safe-area-inset-bottom,0px))] md:bottom-24 md:right-4">
          {/* Header */}
          <div className="bg-brand-500 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">Support Kidelio 🐰</p>
              <p className="text-[11px] text-white/80">
                {step === 'form' ? 'Généralement répond en quelques minutes' :
                  roomStatus === 'closed' ? 'Conversation terminée' :
                  position ? `File d'attente : #${position}` :
                  roomStatus === 'queued' ? 'En attente d\'un conseiller...' :
                  '✓ Connecté'}
              </p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X size={18} />
            </button>
          </div>

          {step === 'form' ? (
            /* Start form */
            <form onSubmit={startChat} className="p-4 space-y-3">
              <p className="text-sm text-gray-600">Bonjour ! Comment pouvons-nous vous aider ?</p>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Votre prénom *"
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
              />
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                placeholder="Email (optionnel)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
              />
              {startError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {startError}
                </p>
              )}
              <button
                type="submit"
                disabled={starting}
                className="w-full bg-brand-500 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-brand-600 transition-colors flex items-center justify-center gap-2"
              >
                {starting ? <Loader2 size={15} className="animate-spin" /> : null}
                Démarrer la conversation
              </button>
            </form>
          ) : (
            /* Chat view */
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[260px] max-h-[360px]">
                {msgs.map(m => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.sender_type === 'system' ? (
                      <p className="text-[11px] text-gray-400 text-center w-full italic">{m.content}</p>
                    ) : (
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                          m.sender_type === 'user'
                            ? 'bg-brand-500 text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                        }`}
                      >
                        {m.sender_type === 'agent' && (
                          <p className="text-[10px] font-bold text-brand-600 mb-0.5">
                            {chatAgentLabel(m.sender_type, m.sender_name)}
                          </p>
                        )}
                        {m.content}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {roomStatus === 'closed' ? (
                <div className="border-t border-gray-100 p-3 space-y-2">
                  <p className="text-xs text-center text-gray-500">
                    Cette conversation est terminée.
                  </p>
                  <button
                    type="button"
                    onClick={beginNewChat}
                    className="w-full bg-brand-500 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-brand-600 transition-colors"
                  >
                    Démarrer une nouvelle conversation
                  </button>
                </div>
              ) : (
                <div className="border-t border-gray-100 p-2 flex gap-2">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Écrivez un message..."
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={!input.trim() || !roomId || sending}
                    className="w-9 h-9 bg-brand-500 text-white rounded-xl flex items-center justify-center hover:bg-brand-600 disabled:opacity-40 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
