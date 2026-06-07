import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Send, X, Circle, User, Archive, UserPlus } from 'lucide-react'
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
  const [queue, setQueue]             = useState<Room[]>([])
  const [activeRooms, setActiveRooms] = useState<Room[]>([])
  const [activeRoom, setActiveRoom]   = useState<Room | null>(null)
  const [msgs, setMsgs]               = useState<ChatMsg[]>([])
  const [input, setInput]             = useState('')
  const [connected, setConnected]     = useState(false)
  const [joined, setJoined]           = useState(false)
  const [sending, setSending]         = useState(false)
  const [joining, setJoining]         = useState(false)
  const wsRef           = useRef<WebSocket | null>(null)
  const activeRoomRef   = useRef<string | null>(null)
  const msgsByRoom      = useRef<Record<string, ChatMsg[]>>({})
  const bottomRef       = useRef<HTMLDivElement>(null)

  useEffect(() => {
    activeRoomRef.current = activeRoom?.id ?? null
  }, [activeRoom])

  const cacheMsgs = (roomId: string, next: ChatMsg[]) => {
    msgsByRoom.current[roomId] = next
    if (activeRoomRef.current === roomId) setMsgs(next)
  }

  const refreshInbox = () =>
    goGet<{ queued: Room[]; active: Room[] }>('/chat/admin/queue')
      .then(data => {
        setQueue(data.queued || [])
        setActiveRooms(data.active || [])
      })
      .catch(() => {})

  const loadRoomMessages = (roomId: string) => {
    goGet<{ messages: ChatMsg[] }>(`/chat/rooms/${roomId}/messages`)
      .then(data => {
        const list = data.messages || []
        msgsByRoom.current[roomId] = list
        if (activeRoomRef.current === roomId) setMsgs(list)
      })
      .catch(() => {})
  }

  // Inbox — poll when WebSocket is off or failed to connect
  useEffect(() => {
    refreshInbox()
    if (goWsEnabled() && connected) return
    if (!goWsEnabled()) setConnected(true)
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') refreshInbox()
    }, import.meta.env.PROD ? 5000 : 3000)
    return () => clearInterval(id)
  }, [connected])

  useEffect(() => {
    if (!goWsEnabled()) return
    const ws = new WebSocket(goWsUrl('/chat/admin/ws'))
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onerror = () => ws.close()
    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
    }

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      switch (data.type) {
        case 'inbox_snapshot':
          setQueue(data.queued || [])
          setActiveRooms(data.active || [])
          break
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
        case 'active_add':
          if (data.room) {
            setActiveRooms(prev => {
              if (prev.find(r => r.id === data.room.id)) return prev
              return [data.room, ...prev]
            })
          }
          break
        case 'active_remove':
          if (data.room_id) {
            setActiveRooms(prev => prev.filter(r => r.id !== data.room_id))
            delete msgsByRoom.current[data.room_id]
            if (data.room_id === activeRoomRef.current) {
              setJoined(false)
            }
          }
          break
        case 'message': {
          const roomId = data.room_id || data.message?.room_id
          if (!roomId || !data.message) break
          const next = appendMsg(msgsByRoom.current[roomId] || [], data.message)
          cacheMsgs(roomId, next)
          break
        }
        case 'room_closed': {
          const closedId = data.room_id || data.message?.room_id
          setQueue(prev => prev.filter(r => r.id !== closedId))
          setActiveRooms(prev => prev.filter(r => r.id !== closedId))
          if (data.message && closedId) {
            const next = appendMsg(msgsByRoom.current[closedId] || [], data.message)
            cacheMsgs(closedId, next)
          }
          if (closedId === activeRoomRef.current) {
            setJoined(false)
            setActiveRoom(prev => prev ? { ...prev, status: 'closed' } : null)
          }
          break
        }
      }
    }
    return () => ws.close()
  }, [])

  // Poll active room messages when WebSocket is unavailable or disconnected
  useEffect(() => {
    if (!joined || !activeRoom || (goWsEnabled() && connected)) return
    const roomId = activeRoom.id
    const pollMs = import.meta.env.PROD ? 5000 : 2500
    const ac = new AbortController()

    const refresh = () => {
      if (document.visibilityState === 'hidden') return
      goGet<{ messages: ChatMsg[] }>(`/chat/rooms/${roomId}/messages`, ac.signal)
        .then(data => {
          if (activeRoomRef.current === roomId && data.messages?.length) {
            cacheMsgs(roomId, data.messages)
          }
        })
        .catch(() => {})
    }
    refresh()
    const id = setInterval(refresh, pollMs)
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
      ac.abort()
    }
  }, [joined, activeRoom, connected])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const selectRoom = (room: Room, isActive: boolean) => {
    if (activeRoom?.id && activeRoom.id !== room.id) {
      msgsByRoom.current[activeRoom.id] = msgs
    }
    setActiveRoom(room)
    activeRoomRef.current = room.id
    setJoined(isActive)
    const cached = msgsByRoom.current[room.id]
    if (cached?.length) {
      setMsgs(cached)
    } else {
      setMsgs([])
      loadRoomMessages(room.id)
    }
  }

  const joinSelectedRoom = async () => {
    if (!activeRoom || joined || joining) return
    const room = activeRoom
    setJoining(true)
    try {
      const data = await goPost<{ room: Room; messages: ChatMsg[] }>(
        `/chat/admin/rooms/${room.id}/join`,
        {}
      )
      if (activeRoomRef.current !== room.id) return
      setQueue(prev => prev.filter(r => r.id !== room.id))
      setActiveRooms(prev => {
        const rest = prev.filter(r => r.id !== room.id)
        return [data.room, ...rest]
      })
      const list = data.messages || []
      msgsByRoom.current[room.id] = list
      setActiveRoom(data.room)
      setMsgs(list)
      setJoined(true)
    } catch {
      if (activeRoomRef.current === room.id) setJoined(false)
    } finally {
      setJoining(false)
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
        const next = appendMsg(msgsByRoom.current[roomId] || [], data.message)
        cacheMsgs(roomId, next)
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
    setActiveRooms(prev => prev.filter(r => r.id !== id))
    delete msgsByRoom.current[id]
    setActiveRoom(null)
    setMsgs([])
    setJoined(false)
    activeRoomRef.current = null
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const canSend = joined && !!activeRoom && activeRoom.status !== 'closed' && !!input.trim() && !sending
  const needsJoin = !!activeRoom && activeRoom.status === 'queued' && !joined

  const roomButton = (room: Room, isActive: boolean) => (
    <button
      key={room.id}
      onClick={() => selectRoom(room, isActive)}
      className={`w-full px-4 py-3 transition-colors text-left ${
        activeRoom?.id === room.id ? 'bg-brand-50' : 'hover:bg-brand-50/60'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
          <User size={14} className="text-brand-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{room.user_name}</p>
          <p className="text-[11px] text-gray-400 truncate">{room.user_email || 'Invité'}</p>
        </div>
        <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          isActive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {isActive ? 'En cours' : 'En attente'}
        </span>
      </div>
      <p className="text-[11px] text-gray-400 mt-1 ml-10">
        {new Date(room.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </button>
  )

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

        {/* Inbox panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="font-bold text-sm text-gray-700">Conversations</p>
            <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {queue.length + activeRooms.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeRooms.length > 0 && (
              <div>
                <p className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-gray-50">
                  Mes conversations ({activeRooms.length})
                </p>
                <div className="divide-y divide-gray-50">
                  {activeRooms.map(room => roomButton(room, true))}
                </div>
              </div>
            )}
            <div>
              <p className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-gray-50">
                File d'attente ({queue.length})
              </p>
              <div className="divide-y divide-gray-50">
                {queue.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    <MessageCircle size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Aucune conversation en attente</p>
                  </div>
                ) : queue.map(room => roomButton(room, false))}
              </div>
            </div>
          </div>
        </div>

        {/* Chat panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          {!activeRoom ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageCircle size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Sélectionnez une conversation</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={14} className="text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{activeRoom.user_name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {activeRoom.user_email || 'Invité'}
                      {needsJoin && ' · Cliquez sur Rejoindre pour répondre'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {needsJoin && (
                    <button
                      onClick={joinSelectedRoom}
                      disabled={joining}
                      className="flex items-center gap-1.5 text-xs bg-brand-500 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors"
                    >
                      <UserPlus size={14} />
                      {joining ? 'Connexion...' : 'Rejoindre'}
                    </button>
                  )}
                  {joined && activeRoom.status !== 'closed' && (
                    <button
                      onClick={closeRoom}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 font-semibold transition-colors"
                    >
                      <X size={14} /> Clôturer
                    </button>
                  )}
                </div>
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

              {activeRoom.status === 'closed' ? (
                <div className="border-t border-gray-100 p-4 text-center text-xs text-gray-400">
                  Conversation clôturée
                </div>
              ) : joined && (
                <div className="border-t border-gray-100 p-3 flex gap-2">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Répondre..."
                    disabled={sending}
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
