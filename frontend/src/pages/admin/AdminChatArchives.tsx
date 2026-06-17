import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, MessageCircle, Search, Trash2, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { AdminPage, useToast } from '../../components/admin/ui'
import { goDelete, goGet } from '../../lib/goApi'
import { chatAgentLabel } from '../../lib/chatDisplay'

type ChatMsg = {
  id: string
  room_id: string
  sender_type: 'user' | 'agent' | 'system'
  sender_name: string
  content: string
  created_at: string
}

type ArchivedRoom = {
  id: string
  user_name: string
  user_email: string
  status: string
  agent_name: string
  created_at: string
  updated_at: string
  message_count: number
}

const PAGE_SIZE = 30

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AdminChatArchives() {
  const { notify } = useToast()
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [rooms, setRooms] = useState<ArchivedRoom[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ArchivedRoom | null>(null)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadArchives = useCallback((q: string, off: number) => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(off),
    })
    if (q.trim()) params.set('q', q.trim())
    goGet<{ rooms: ArchivedRoom[]; total: number }>(`/chat/admin/archives?${params}`)
      .then(data => {
        setRooms(data.rooms || [])
        setTotal(data.total || 0)
      })
      .catch(() => {
        setRooms([])
        setTotal(0)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setSearch(query)
      setOffset(0)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [query])

  useEffect(() => {
    loadArchives(search, offset)
  }, [search, offset, loadArchives])

  const openRoom = async (room: ArchivedRoom) => {
    setSelected(room)
    setMsgs([])
    setDetailLoading(true)
    try {
      const data = await goGet<{ room: ArchivedRoom; messages: ChatMsg[] }>(
        `/chat/admin/rooms/${room.id}`,
      )
      setSelected(data.room)
      setMsgs(data.messages || [])
    } catch {
      setSelected(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const deleteRoom = async () => {
    if (!selected) return
    const roomId = selected.id
    if (!window.confirm(
      `Supprimer définitivement la conversation avec ${selected.user_name} ?\n\nCette action est irréversible.`,
    )) return

    setDeleting(true)
    try {
      await goDelete(`/chat/admin/rooms/${roomId}`)
      notify('Conversation supprimée')
      setSelected(null)
      setMsgs([])
      const nextTotal = Math.max(0, total - 1)
      setTotal(nextTotal)
      if (offset >= nextTotal && offset > 0) {
        setOffset(Math.max(0, offset - PAGE_SIZE))
      } else {
        loadArchives(search, offset)
      }
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, selected])

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const canPrev = offset > 0
  const canNext = offset + PAGE_SIZE < total

  return (
    <AdminPage
      title="Archives chat"
      subtitle="Consultez les conversations clôturées"
      actions={
        <Link
          to="/admin/chat"
          className="btn-sm btn-secondary flex items-center gap-1.5"
        >
          <MessageCircle size={14} /> Chat en direct
        </Link>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-13rem)]">

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm text-gray-700">Conversations</p>
              <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">
                {total}
              </span>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Client, e-mail, agent..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="py-12 text-center text-gray-400 text-xs">Chargement...</div>
            ) : rooms.length === 0 ? (
              <div className="py-12 text-center text-gray-400">
                <Archive size={28} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Aucune conversation archivée</p>
              </div>
            ) : rooms.map(room => (
              <button
                key={room.id}
                type="button"
                onClick={() => openRoom(room)}
                className={`w-full px-4 py-3 text-left transition-colors ${
                  selected?.id === room.id ? 'bg-brand-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User size={14} className="text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{room.user_name}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {room.agent_name ? 'Agent : Support' : 'Sans agent'}
                      {room.message_count > 0 && ` · ${room.message_count} msg`}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-1 ml-10">
                  Clôturée {formatDate(room.updated_at)}
                </p>
              </button>
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => setOffset(o => Math.max(0, o - PAGE_SIZE))}
                className="flex items-center gap-1 disabled:opacity-40 hover:text-brand-600"
              >
                <ChevronLeft size={14} /> Préc.
              </button>
              <span>{page} / {pageCount}</span>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => setOffset(o => o + PAGE_SIZE)}
                className="flex items-center gap-1 disabled:opacity-40 hover:text-brand-600"
              >
                Suiv. <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Transcript */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <Archive size={40} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Sélectionnez une conversation archivée</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User size={14} className="text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">{selected.user_name}</p>
                      <p className="text-[11px] text-gray-400">
                        {selected.user_email || 'Invité'}
                        {selected.agent_name && ' · Agent : Support'}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        Ouverte {formatDate(selected.created_at)} · Clôturée {formatDate(selected.updated_at)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={deleteRoom}
                    disabled={deleting}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
                    title="Supprimer cette conversation"
                  >
                    <Trash2 size={14} />
                    {deleting ? 'Suppression...' : 'Supprimer'}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {detailLoading ? (
                  <p className="text-center text-xs text-gray-400 py-8">Chargement des messages...</p>
                ) : msgs.length === 0 ? (
                  <p className="text-center text-xs text-gray-400 py-8">Aucun message</p>
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
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        <p className={`text-[9px] mt-1 ${
                          m.sender_type === 'agent' ? 'text-white/70' : 'text-gray-400'
                        }`}>
                          {new Date(m.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </AdminPage>
  )
}
