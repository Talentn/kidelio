import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Send, X, Circle, User, Archive } from 'lucide-react'
import { AdminPage } from '../../components/admin/ui'
import { goWsUrl, goGet, goPost, goWsEnabled } from '../../lib/goApi'
import { chatAgentLabel } from '../../lib/chatDisplay'

type ChatMsg = {
  id: string
  room_id: string
  sender_type: 'user' | 'agent' | 'system'
  sender_name: string
  content: string
  created_at: string
}

type Room = {
  id: string
  user_name: string
  user_email: string
  status: string
  agent_name: string
  created_at: string
}

function appendMsg(prev: ChatMsg[], msg: ChatMsg) {
  if (!msg?.id || prev.some(m => m.id === msg.id)) return prev
  return [...prev, msg]
}

export function AdminChat() {
  const [queue, setQueue]         = useState<Room[]>([])
  const [activeRoom, setActiveRoom] = useState<Room | null>(null)
  const [msgs, setMsgs]           = useState<ChatMsg[]>([])
  const [input, setInput]         = useState('')
  const [connected, setConnected] = useState(false)
  const [joined, setJoined]       = useState(false)
  const [sending, setSending]     = useState(false)
  const wsRef         = useRef<WebSocket | null>(null)
  const activeRoomRef = useRef<string | null>(null)
  const bottomRef     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    activeRoomRef.current = activeRoom?.id ?? null
  }, [activeRoom])

  const refreshQueue = () =>
    goGet<{ rooms: Room[] }>('/chat/admin/queue')
      .then(data => setQueue(data.rooms || []))
      .catch(() => {})

  // Queue snapshot — poll when WebSocket is off (shared nginx cannot upgrade WS)
  useEffect(() => {
    refreshQueue()
    if (goWsEnabled()) return
    setConnected(true)
    const id = setInterval(refreshQueue, 3000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!goWsEnabled()) return
    const ws = new WebSocket(goWsUrl('/chat/admin/ws'))
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      switch (data.type) {
        case 'queue_snapshot':
          setQueue(data.rooms || [])
          break
        case 'queue_update':
          setQueue(prev => {
            if (prev.find(r => r.id === data.room.id)) return prev
            return [data.room, ...prev]
          })
          break
        case 'queue_remove':
          if (data.room_id) {
            setQueue(prev => prev.filter(r => r.id !== data.room_id))
          }
          break
        case 'message': {
          const roomId = data.room_id || data.message?.room_id
          if (roomId && activeRoomRef.current && roomId !== activeRoomRef.current) break
          if (data.message) setMsgs(prev => appendMsg(prev, data.message))
          break
        }
        case 'room_closed': {
          const closedId = data.room_id || data.message?.room_id
          setQueue(prev => prev.filter(r => r.id !== closedId))
          if (closedId && closedId === activeRoomRef.current) {
            setActiveRoom(null)
            setMsgs([])
            setJoined(false)
            activeRoomRef.current = null
          }
          if (data.message && closedId === activeRoomRef.current) {
            setMsgs(prev => appendMsg(prev, data.message))
          }
          break
        }
      }
    }
    return () => ws.close()
  }, [])

  // Poll active room messages when WebSocket is unavailable
  useEffect(() => {
    if (!joined || !activeRoom || goWsEnabled()) return
    const roomId = activeRoom.id
    const refresh = () =>
      goGet<{ messages: ChatMsg[] }>(`/chat/rooms/${roomId}/messages`)
        .then(data => {
          if (activeRoomRef.current === roomId && data.messages?.length) {
            setMsgs(data.messages)
          }
        })
        .catch(() => {})
    refresh()
    const id = setInterval(refresh, 2500)
    return () => clearInterval(id)
  }, [joined, activeRoom])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const joinRoom = async (room: Room) => {
    setActiveRoom({ ...room, status: 'active' })
    setMsgs([])
    setJoined(false)
    activeRoomRef.current = room.id
    setQueue(prev => prev.filter(r => r.id !== room.id))

    try {
      const data = await goPost<{ room: Room; messages: ChatMsg[] }>(
        `/chat/admin/rooms/${room.id}/join`,
        {}
      )
      if (activeRoomRef.current === room.id) {
        setActiveRoom(data.room)
        setMsgs(data.messages || [])
        setJoined(true)
      }
    } catch {
      if (activeRoomRef.current === room.id) {
        setActiveRoom(null)
        setJoined(false)
        activeRoomRef.current = null
      }
    }
  }

  const send = async () => {
    const text = input.trim()
    const roomId = activeRoomRef.current
    if (!text || !roomId || !joined || sending) return

    setInput('')
    setSending(true)
    try {
      const data = await goPost<{ message: ChatMsg }>(
        `/chat/admin/rooms/${roomId}/messages`,
        { content: text }
      )
      if (data.message) {
        setMsgs(prev => appendMsg(prev, data.message))
      }
    } catch {
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  const closeRoom = async () => {
    const id = activeRoomRef.current
    if (!id) return

    try {
      await goPost(`/chat/admin/rooms/${id}/close`, {})
    } catch { /* still reset UI */ }

    setQueue(prev => prev.filter(r => r.id !== id))
    setActiveRoom(null)
    setMsgs([])
    setJoined(false)
    activeRoomRef.current = null
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const canSend = joined && !!activeRoom && !!input.trim() && !sending

  return (
    <AdminPage
      title="Chat Support"
      subtitle="Gérez les conversations clients en temps réel"
      actions={
        <div className="flex items-center gap-3">
          <Link
            to="/admin/chat-archives"
            className="btn-sm btn-secondary flex items-center gap-1.5"
          >
            <Archive size={14} /> Archives
          </Link>
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            <Circle size={7} fill="currentColor" />
            {connected ? 'Connecté' : 'Déconnecté'}
          </span>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-13rem)]">

        {/* Queue panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="font-bold text-sm text-gray-700">File d'attente</p>
            <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2 py-0.5 rounded-full">{queue.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {queue.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <MessageCircle size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Aucune conversation en attente</p>
              </div>
            ) : queue.map(room => (
              <button
                key={room.id}
                onClick={() => joinRoom(room)}
                className="w-full px-4 py-3 hover:bg-brand-50 transition-colors text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={14} className="text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{room.user_name}</p>
                    <p className="text-[11px] text-gray-400 truncate">{room.user_email || 'Invité'}</p>
                  </div>
                  <span className="flex-shrink-0 text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">
                    En attente
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 ml-10">
                  {new Date(room.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          {!activeRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageCircle size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Sélectionnez une conversation dans la file</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
                    <User size={14} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{activeRoom.user_name}</p>
                    <p className="text-[11px] text-gray-400">
                      {activeRoom.user_email || 'Invité'}
                      {!joined && ' · Connexion à la conversation...'}
                    </p>
                  </div>
                </div>
                {activeRoom.status !== 'closed' && (
                  <button
                    onClick={closeRoom}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 font-semibold transition-colors"
                  >
                    <X size={14} /> Clôturer
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {msgs.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-8">Chargement des messages...</p>
                ) : msgs.map(m => (
                  <div key={m.id} className={`flex ${m.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}>
                    {m.sender_type === 'system' ? (
                      <p className="text-[11px] text-gray-400 text-center w-full italic py-1">{m.content}</p>
                    ) : (
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                        m.sender_type === 'agent'
                          ? 'bg-brand-500 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}>
                        {(m.sender_type === 'user' || m.sender_type === 'agent') && (
                          <p className={`text-[10px] font-bold mb-0.5 ${
                            m.sender_type === 'agent' ? 'text-white/80' : 'text-brand-600'
                          }`}>
                            {m.sender_type === 'user' ? m.sender_name : chatAgentLabel(m.sender_type, m.sender_name)}
                          </p>
                        )}
                        {m.content}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {activeRoom.status !== 'closed' && (
                <div className="border-t border-gray-100 p-3 flex gap-2">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={joined ? 'Répondre...' : 'Connexion...'}
                    disabled={!joined || sending}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={!canSend}
                    className="w-9 h-9 bg-brand-500 text-white rounded-xl flex items-center justify-center hover:bg-brand-600 disabled:opacity-40 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminPage>
  )
}
