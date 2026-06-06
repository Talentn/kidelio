import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Eye, ShoppingCart, Phone, MapPin, User as UserIcon } from "lucide-react";
import { apiAdmin } from "../../lib/api";
import { ORDER_STATUSES, orderStatusLabel, orderStatusSelectClass, paymentMethodLabel } from "../../lib/orderStatus";
import { useLivePoll } from "../../hooks/useLivePoll";
import { AdminPage, Card, Modal, StatusBadge, useToast } from "../../components/admin/ui";

type OrderItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  size_label?: string;
  color_label?: string;
};

type Order = {
  id: number;
  order_number: string;
  status: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  subtotal?: number;
  shipping_cost?: number;
  discount_amount?: number;
  total: number;
  payment_method?: string;
  created_at?: string;
  shipping_governorate?: string;
  shipping_delegation?: string;
  shipping_address?: string;
  items?: OrderItem[];
  user?: { id: number; name: string; email: string };
};

function OrderDetail({ id, onClose, onStatusChange }: { id: number; onClose: () => void; onStatusChange: (id: number, status: string) => void }) {
  const { notify } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    apiAdmin<{ order: Order }>(`/orders/${id}`).then((d) => setOrder(d.order)).catch(() => {});
  }, [id]);

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await apiAdmin(`/orders/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setOrder((o) => (o ? { ...o, status } : o));
      onStatusChange(id, status);
      notify("Statut mis à jour");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={order ? `Commande ${order.order_number}` : "Chargement..."} size="lg">
      {!order ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
      ) : (
        <div className="space-y-5">
          {/* Status control */}
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={order.status} />
            <select
              value={order.status}
              disabled={updating}
              onChange={(e) => updateStatus(e.target.value)}
              className={`py-2 w-auto text-sm font-semibold ${orderStatusSelectClass(order.status)}`}
            >
              {ORDER_STATUSES.map((s) => <option key={s} value={s}>{orderStatusLabel(s)}</option>)}
            </select>
          </div>

          {/* Customer */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-3"><UserIcon size={15} /> Client</h3>
              <p className="text-sm text-slate-700 font-semibold">{order.guest_name ?? order.user?.name ?? "—"}</p>
              {order.guest_phone && <p className="flex items-center gap-1.5 text-sm text-slate-500 mt-1"><Phone size={13} /> {order.guest_phone}</p>}
              {(order.guest_email || order.user?.email) && <p className="text-sm text-slate-500 mt-1">{order.guest_email ?? order.user?.email}</p>}
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-3"><MapPin size={15} /> Livraison</h3>
              <p className="text-sm text-slate-700">{order.shipping_governorate} {order.shipping_delegation && `· ${order.shipping_delegation}`}</p>
              {order.shipping_address && <p className="text-sm text-slate-500 mt-1">{order.shipping_address}</p>}
              <p className="text-xs text-slate-400 mt-2">Paiement : {paymentMethodLabel(order.payment_method)}</p>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-2">Articles</h3>
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              {order.items?.map((it, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{it.product_name}</p>
                    <p className="text-xs text-slate-400">
                      {[it.size_label, it.color_label].filter(Boolean).join(" · ")}
                      {(it.size_label || it.color_label) && " · "}
                      {Number(it.unit_price).toFixed(3)} TND × {it.quantity}
                    </p>
                  </div>
                  <span className="font-bold text-slate-900 text-sm">{(Number(it.unit_price) * it.quantity).toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Sous-total</span><span className="font-semibold">{Number(order.subtotal ?? 0).toFixed(3)} TND</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Livraison</span><span className="font-semibold">{Number(order.shipping_cost ?? 0).toFixed(3)} TND</span></div>
            {!!order.discount_amount && order.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600"><span>Réduction</span><span className="font-semibold">-{Number(order.discount_amount).toFixed(3)} TND</span></div>
            )}
            <div className="flex justify-between font-bold text-base border-t border-slate-200 pt-2 mt-1"><span>Total</span><span className="text-brand-600">{Number(order.total).toFixed(3)} TND</span></div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function AdminOrders() {
  const { notify } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    apiAdmin<{ orders: Order[] }>("/orders")
      .then((d) => {
        setOrders((prev) => {
          const incoming = d.orders.filter((o) => !prev.some((p) => p.id === o.id));
          if (silent && incoming.length > 0) {
            const label = incoming.length === 1
              ? `Nouvelle commande ${incoming[0].order_number}`
              : `${incoming.length} nouvelles commandes`;
            notify(label);
          }
          return d.orders;
        });
      })
      .finally(() => { if (!silent) setLoading(false); });
  }, [notify]);

  useEffect(() => { load(); }, [load]);
  useLivePoll(() => load(true), [load], { interval: 5_000 });

  const onStatusChange = (id: number, status: string) =>
    setOrders((os) => os.map((o) => (o.id === id ? { ...o, status } : o)));

  const updateStatusInline = async (order: Order, status: string) => {
    if (order.status === status) return;
    setUpdatingId(order.id);
    try {
      await apiAdmin(`/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      onStatusChange(order.id, status);
      notify("Statut mis à jour");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = useMemo(() => orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search && !`${o.order_number} ${o.guest_name ?? ""} ${o.guest_phone ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [orders, search, statusFilter]);

  return (
    <AdminPage title="Commandes" subtitle={`${orders.length} commande${orders.length > 1 ? "s" : ""}`}>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Rechercher (n°, nom, téléphone)..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-52" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Tous les statuts</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{orderStatusLabel(s)}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingCart size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="font-semibold text-slate-500">Aucune commande.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-bold px-4 py-3">N°</th>
                  <th className="text-left font-bold px-4 py-3">Client</th>
                  <th className="text-left font-bold px-4 py-3 hidden md:table-cell">Date</th>
                  <th className="text-left font-bold px-4 py-3">Total</th>
                  <th className="text-left font-bold px-4 py-3">Statut</th>
                  <th className="text-right font-bold px-4 py-3">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 cursor-pointer" onClick={() => setDetailId(o.id)}>{o.order_number}</td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => setDetailId(o.id)}>
                      <p className="font-semibold text-slate-800">{o.guest_name ?? o.user?.name ?? "—"}</p>
                      <p className="text-xs text-slate-400">{o.guest_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell cursor-pointer" onClick={() => setDetailId(o.id)}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 cursor-pointer" onClick={() => setDetailId(o.id)}>{Number(o.total).toFixed(3)} TND</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={o.status}
                        disabled={updatingId === o.id}
                        onChange={(e) => updateStatusInline(o, e.target.value)}
                        className={orderStatusSelectClass(o.status)}
                        aria-label={`Statut commande ${o.order_number}`}
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>{orderStatusLabel(s)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailId(o.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        aria-label="Voir le détail"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detailId && (
        <OrderDetail id={detailId} onClose={() => setDetailId(null)} onStatusChange={onStatusChange} />
      )}
    </AdminPage>
  );
}
