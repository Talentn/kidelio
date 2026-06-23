import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, RefreshCw, Search, ChevronRight,
  Plus, Pencil, Trash2, ArrowLeftRight, LogIn, LogOut,
} from "lucide-react";
import { apiAdmin } from "../../lib/api";
import { useLivePoll } from "../../hooks/useLivePoll";
import {
  ACTIVITY_ACTION_LABELS,
  activityActionLabel,
  activityEntityLabel,
  userRoleLabel,
  userRoleStyle,
} from "../../lib/orderStatus";
import {
  ACTIVITY_ENTITY_TYPES,
  activityEntityFilterLabel,
  activityLogSummary,
} from "../../lib/activitySummary";
import { formatAdminRelative } from "../../lib/adminDatetime";
import { AdminPage, Card, Modal } from "../../components/admin/ui";

const ACTION_ICONS: Record<string, typeof Plus> = {
  CREATE: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
  STATUS_CHANGE: ArrowLeftRight,
  LOGIN: LogIn,
  LOGOUT: LogOut,
};

const ACTION_ICON_STYLES: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-600",
  UPDATE: "bg-blue-100 text-blue-600",
  DELETE: "bg-red-100 text-red-600",
  STATUS_CHANGE: "bg-purple-100 text-purple-600",
  LOGIN: "bg-slate-100 text-slate-500",
  LOGOUT: "bg-slate-100 text-slate-500",
};

/** Human day bucket label: "Aujourd'hui", "Hier" or a full date. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Aujourd'hui";
  if (sameDay(d, yesterday)) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

type LogUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

type Log = {
  id: number;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  changes: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: LogUser;
};

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  STATUS_CHANGE: "bg-purple-100 text-purple-700",
  LOGIN: "bg-slate-100 text-slate-600",
  LOGOUT: "bg-slate-100 text-slate-600",
};

const FIELD_LABELS: Record<string, string> = {
  status: "Statut",
  name: "Nom",
  email: "E-mail",
  role: "Rôle",
  price: "Prix",
  promo_price: "Prix promo",
  stock: "Stock",
  active: "Actif",
  featured: "Mis en avant",
  on_promo: "En promotion",
  slug: "Slug",
  reference: "Référence",
  description: "Description",
  category_id: "Catégorie",
  age_group: "Tranche d'âge",
  payment_method: "Paiement",
  notes: "Notes",
  total: "Total",
  subtotal: "Sous-total",
  shipping_cost: "Livraison",
  discount_amount: "Réduction",
  quantity: "Quantité",
  code: "Code",
  discount_type: "Type de réduction",
  discount_value: "Valeur réduction",
  min_order_amount: "Commande min.",
  max_discount: "Réduction max.",
  usage_limit: "Limite d'utilisation",
  used_count: "Utilisations",
  expires_at: "Expiration",
  position: "Position",
  hex: "Couleur",
  size: "Taille",
  read: "Lu",
  phone: "Téléphone",
  title: "Titre",
  link_url: "Lien",
  images: "Images",
  image: "Image",
  colors_order: "Ordre des couleurs",
  fidelity_points: "Points fidélité",
  message: "Message",
};

function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatChanges(changes: Record<string, unknown>): { field: string; before: string; after: string }[] {
  const rows: { field: string; before: string; after: string }[] = [];

  for (const [key, raw] of Object.entries(changes)) {
    const label = FIELD_LABELS[key] ?? key.replace(/_/g, " ");
    if (Array.isArray(raw) && raw.length === 2) {
      rows.push({
        field: label,
        before: formatChangeValue(raw[0]),
        after: formatChangeValue(raw[1]),
      });
    } else {
      rows.push({
        field: label,
        before: "—",
        after: formatChangeValue(raw),
      });
    }
  }

  return rows;
}

function LogDetailModal({ log, onClose }: { log: Log; onClose: () => void }) {
  const changeRows = formatChanges(log.changes ?? {});
  const dateStr = new Date(log.created_at).toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "medium",
  });

  return (
    <Modal open onClose={onClose} title="Détail de l'activité" size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ACTION_STYLES[log.action] ?? "bg-slate-100 text-slate-600"}`}>
            {activityActionLabel(log.action)}
          </span>
          <span className="text-sm text-slate-500">{dateStr}</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Utilisateur</p>
            {log.user ? (
              <>
                <p className="font-semibold text-slate-900">{log.user.name}</p>
                <p className="text-sm text-slate-600">{log.user.email}</p>
                <p className="text-xs text-slate-500">ID #{log.user.id}</p>
                <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${userRoleStyle(log.user.role)}`}>
                  {userRoleLabel(log.user.role)}
                </span>
              </>
            ) : (
              <p className="text-slate-500 text-sm">Utilisateur inconnu ou supprimé</p>
            )}
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Entité concernée</p>
            <p className="font-semibold text-slate-900">{activityEntityLabel(log.entity_type)}</p>
            {log.entity_name && <p className="text-sm text-slate-700">{log.entity_name}</p>}
            {log.entity_id && <p className="text-xs text-slate-500">ID {log.entity_id}</p>}
          </div>
        </div>

        {changeRows.length > 0 ? (
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Modifications</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs">
                    <th className="text-left font-bold px-3 py-2">Champ</th>
                    <th className="text-left font-bold px-3 py-2">Avant</th>
                    <th className="text-left font-bold px-3 py-2">Après</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {changeRows.map((row) => (
                    <tr key={row.field}>
                      <td className="px-3 py-2 font-medium text-slate-700">{row.field}</td>
                      <td className="px-3 py-2 text-slate-500 break-all">{row.before}</td>
                      <td className="px-3 py-2 text-slate-800 font-medium break-all">{row.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
            {activityLogSummary(log)}
          </p>
        )}

        {(log.ip_address || log.user_agent) && (
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Connexion</p>
            {log.ip_address && (
              <p className="text-slate-700">
                <span className="text-slate-500">IP :</span> {log.ip_address}
              </p>
            )}
            {log.user_agent && (
              <p className="text-slate-600 text-xs break-all leading-relaxed">
                <span className="text-slate-500 font-medium">Navigateur :</span> {log.user_agent}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ActivityLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Log | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");

  const load = useCallback((silent = false) => {
    if (!silent) setRefreshing(true);
    const qs = new URLSearchParams({ limit: "500" });
    if (entityFilter) qs.set("entity_type", entityFilter);
    if (actionFilter) qs.set("event", actionFilter);

    return apiAdmin<{ logs: Log[] }>(`/activity-logs?${qs}`)
      .then((d) => {
        setLogs(d.logs);
        setLoading(false);
      })
      .catch(() => setLoading(false))
      .finally(() => setRefreshing(false));
  }, [entityFilter, actionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useLivePoll(() => load(true), [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((log) => {
      if (roleFilter && log.user?.role !== roleFilter) return false;
      if (!q) return true;
      const summary = activityLogSummary(log);
      const haystack = [
        log.user?.name,
        log.user?.email,
        log.entity_name,
        log.entity_type,
        log.action,
        activityActionLabel(log.action),
        activityEntityLabel(log.entity_type),
        userRoleLabel(log.user?.role),
        summary,
        JSON.stringify(log.changes ?? {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, search, roleFilter]);

  // Static list so picking an action (which filters server-side) never makes the
  // other options disappear from the dropdown.
  const actionOptions = useMemo(() => Object.keys(ACTIVITY_ACTION_LABELS), []);

  // Group the filtered logs into day buckets for a scannable timeline.
  const grouped = useMemo(() => {
    const buckets: { label: string; logs: Log[] }[] = [];
    let current: { label: string; logs: Log[] } | null = null;
    for (const log of filtered) {
      const label = dayLabel(log.created_at);
      if (!current || current.label !== label) {
        current = { label, logs: [] };
        buckets.push(current);
      }
      current.logs.push(log);
    }
    return buckets;
  }, [filtered]);

  return (
    <AdminPage
      title="Journal d'activité"
      subtitle="Toutes les actions admin : commandes, produits, stock, catégories, promos, messages, utilisateurs"
      actions={
        <button
          type="button"
          onClick={() => load()}
          disabled={refreshing}
          className="btn-secondary btn-sm inline-flex items-center gap-2"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Actualiser
        </button>
      }
    >
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Rechercher (nom, commande, statut, stock…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="input py-2 w-full lg:w-auto text-sm"
        >
          <option value="">Toutes les entités</option>
          {ACTIVITY_ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {activityEntityFilterLabel(t)}
            </option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input py-2 w-full lg:w-auto text-sm"
        >
          <option value="">Tous les rôles</option>
          <option value="admin">Administrateur</option>
          <option value="employee">Employé</option>
          <option value="client">Client</option>
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="input py-2 w-full lg:w-auto text-sm"
        >
          <option value="">Toutes les actions</option>
          {actionOptions.map((a) => (
            <option key={a} value={a}>
              {activityActionLabel(a)}
            </option>
          ))}
        </select>
      </div>

      {!loading && logs.length > 0 && (
        <p className="text-xs text-slate-500 mb-3">
          {filtered.length} entrée{filtered.length !== 1 ? "s" : ""} affichée{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== logs.length ? ` sur ${logs.length}` : ""} — mise à jour automatique
        </p>
      )}

      {loading ? (
        <Card className="p-4 space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-14 rounded-xl" />
          ))}
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-16">
          <Activity size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-500">
            {logs.length === 0
              ? "Aucune activité enregistrée. Effectuez une action admin puis actualisez."
              : "Aucun résultat pour ces filtres."}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.label}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
                {group.label}
                <span className="ml-2 font-medium normal-case tracking-normal text-slate-300">
                  {group.logs.length}
                </span>
              </h2>
              <Card className="divide-y divide-slate-100 overflow-hidden">
                {group.logs.map((log) => {
                  const Icon = ACTION_ICONS[log.action] ?? Activity;
                  return (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setSelected(log)}
                      className="w-full flex items-center gap-3 px-3 sm:px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${ACTION_ICON_STYLES[log.action] ?? "bg-slate-100 text-slate-500"}`}
                      >
                        <Icon size={16} />
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-800 text-sm truncate">
                            {log.user?.name ?? "Utilisateur inconnu"}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${userRoleStyle(log.user?.role)}`}
                          >
                            {userRoleLabel(log.user?.role)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          <span className="font-medium text-slate-600">
                            {activityActionLabel(log.action)} · {activityEntityLabel(log.entity_type)}
                          </span>
                          {log.entity_name ? <span className="text-slate-400"> — {log.entity_name}</span> : null}
                        </p>
                        <p className="text-xs text-slate-400 truncate mt-0.5">{activityLogSummary(log)}</p>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <time className="text-xs text-slate-400 whitespace-nowrap hidden sm:block">
                          {formatAdminRelative(log.created_at)}
                        </time>
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
                    </button>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      )}

      {selected && <LogDetailModal log={selected} onClose={() => setSelected(null)} />}
    </AdminPage>
  );
}
