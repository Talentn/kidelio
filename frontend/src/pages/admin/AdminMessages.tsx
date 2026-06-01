import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail, MailOpen, Phone, Clock, Search,
  User, MessageSquare, Filter, X,
} from "lucide-react";
import { apiAdmin } from "../../lib/api";
import { useLivePoll } from "../../hooks/useLivePoll";
import { AdminPage, Card, Modal, useToast } from "../../components/admin/ui";

type Message = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  message: string;
  read: boolean;
  created_at: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)     return "À l'instant";
  if (diff < 3600)   return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `Il y a ${Math.floor(diff / 3600)} h`;
  return `Il y a ${Math.floor(diff / 86400)} j`;
}

/* ─── Detail modal ────────────────────────────────────────────────────── */
function MessageModal({ msg, onClose }: { msg: Message; onClose: () => void }) {
  return (
    <Modal open title={`Message de ${msg.name}`} onClose={onClose} size="md">
      <div className="space-y-5">
        {/* Sender info */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center flex-shrink-0">
            <User size={22} className="text-brand-600" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-lg leading-tight">{msg.name}</p>
            <a href={`mailto:${msg.email}`} className="text-sm text-brand-600 hover:underline font-medium break-all">
              {msg.email}
            </a>
            {msg.phone && (
              <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                <Phone size={13} className="flex-shrink-0" />
                <a href={`tel:${msg.phone}`} className="hover:underline">{msg.phone}</a>
              </div>
            )}
          </div>
          <div className="ml-auto text-right text-xs text-slate-400 flex-shrink-0">
            <p className="font-semibold">{timeAgo(msg.created_at)}</p>
            <p className="mt-0.5">{formatDate(msg.created_at)}</p>
          </div>
        </div>

        {/* Message body */}
        <div className="bg-slate-50 rounded-2xl p-4 ring-1 ring-slate-200">
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
          <a
            href={`mailto:${msg.email}?subject=Réponse à votre message — Kidelio`}
            className="btn-primary btn-sm"
          >
            <Mail size={15} /> Répondre par e-mail
          </a>
          {msg.phone && (
            <a href={`tel:${msg.phone}`} className="btn-secondary btn-sm">
              <Phone size={15} /> Appeler
            </a>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ─── Message row ─────────────────────────────────────────────────────── */
function MessageRow({
  msg, onClick,
}: { msg: Message; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-4 px-4 py-4 border-b border-slate-100 last:border-0 transition-colors hover:bg-slate-50 ${
        !msg.read ? "bg-brand-50/60" : ""
      }`}
    >
      {/* Read/unread dot */}
      <div className="mt-1 flex-shrink-0">
        {msg.read
          ? <MailOpen size={18} className="text-slate-300" />
          : <Mail size={18} className="text-brand-500" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className={`text-sm leading-tight truncate ${msg.read ? "font-semibold text-slate-700" : "font-bold text-slate-900"}`}>
            {msg.name}
          </p>
          {!msg.read && (
            <span className="flex-shrink-0 w-2 h-2 rounded-full bg-brand-500" />
          )}
        </div>
        <p className="text-xs text-slate-500 truncate">{msg.email}</p>
        <p className={`text-sm mt-1 line-clamp-2 ${msg.read ? "text-slate-400" : "text-slate-600"}`}>
          {msg.message}
        </p>
      </div>

      {/* Date */}
      <div className="flex-shrink-0 text-right">
        <p className="text-xs text-slate-400 font-medium whitespace-nowrap">{timeAgo(msg.created_at)}</p>
        {msg.phone && <Phone size={11} className="text-slate-300 mt-1 ml-auto" />}
      </div>
    </button>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────── */
export function AdminMessages() {
  const { notify } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<"all" | "unread" | "read">("all");
  const [open,     setOpen]     = useState<Message | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    apiAdmin<{ messages: Message[] }>("/contact-messages")
      .then((d) => {
        setMessages((prev) => {
          const incoming = d.messages.filter((m) => !prev.some((p) => p.id === m.id));
          if (silent && incoming.length > 0) {
            const label = incoming.length === 1
              ? `Nouveau message de ${incoming[0].name}`
              : `${incoming.length} nouveaux messages`;
            notify(label);
          }
          return d.messages;
        });
      })
      .finally(() => { if (!silent) setLoading(false); });
  }, [notify]);

  useEffect(() => { load(); }, [load]);
  useLivePoll(() => load(true), [load], { interval: 5_000 });

  const markRead = async (msg: Message) => {
    if (!msg.read) {
      await apiAdmin(`/contact-messages/${msg.id}`, { method: "PATCH" }).catch(() => {});
      setMessages((ms) => ms.map((m) => m.id === msg.id ? { ...m, read: true } : m));
    }
    setOpen({ ...msg, read: true });
  };

  const filtered = useMemo(() =>
    messages.filter((m) => {
      const text = `${m.name} ${m.email} ${m.message}`.toLowerCase();
      if (search && !text.includes(search.toLowerCase())) return false;
      if (filter === "unread") return !m.read;
      if (filter === "read")   return m.read;
      return true;
    }),
    [messages, search, filter]
  );

  const unreadCount = messages.filter((m) => !m.read).length;

  return (
    <AdminPage
      title="Messages clients"
      subtitle={unreadCount > 0 ? `${unreadCount} message${unreadCount > 1 ? "s" : ""} non lu${unreadCount > 1 ? "s" : ""}` : "Tous les messages ont été lus"}
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total",      value: messages.length,   icon: MessageSquare, color: "text-slate-500",   bg: "bg-slate-50",   ring: "ring-slate-200" },
          { label: "Non lus",    value: unreadCount,        icon: Mail,          color: "text-brand-600",   bg: "bg-brand-50",   ring: "ring-brand-200" },
          { label: "Lus",        value: messages.length - unreadCount, icon: MailOpen, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
        ].map(({ label, value, icon: Icon, color, bg, ring }) => (
          <div key={label} className={`${bg} ring-1 ${ring} rounded-2xl p-4 flex items-center gap-3`}>
            <span className={color}><Icon size={22} strokeWidth={1.8} /></span>
            <div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10"
            placeholder="Rechercher par nom, e-mail ou contenu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["all", "unread", "read"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={`chip ${filter === k ? "chip-active" : ""}`}
            >
              {k === "all" ? "Tous" : k === "unread" ? "Non lus" : "Lus"}
            </button>
          ))}
          {search && (
            <button type="button" onClick={() => setSearch("")} className="chip">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 rounded w-1/3" />
                  <div className="skeleton h-3 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            {filter === "unread"
              ? <><MailOpen size={42} className="text-slate-200 mx-auto mb-3" /><p className="font-semibold text-slate-400">Aucun message non lu.</p></>
              : <><MessageSquare size={42} className="text-slate-200 mx-auto mb-3" /><p className="font-semibold text-slate-400">Aucun message trouvé.</p></>}
          </div>
        ) : (
          <div>
            {filtered.map((m) => (
              <MessageRow key={m.id} msg={m} onClick={() => markRead(m)} />
            ))}
          </div>
        )}
      </Card>

      {open && <MessageModal msg={open} onClose={() => setOpen(null)} />}
    </AdminPage>
  );
}
