import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Eye, ShoppingCart, Phone, PhoneCall, MapPin, User as UserIcon, Trash2, ImageOff, RefreshCw, Truck, Pencil, X, Check } from "lucide-react";
import { apiAdmin, apiV1 } from "../../lib/api";
import { ORDER_STATUSES, orderStatusLabel, orderStatusSelectClass, paymentMethodLabel } from "../../lib/orderStatus";
import { useLivePoll } from "../../hooks/useLivePoll";
import { AdminPage, Card, Modal, StatusBadge, useToast } from "../../components/admin/ui";

type OrderItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  size_label?: string;
  color_label?: string;
  product_slug?: string | null;
  product_available?: boolean;
  image_url?: string | null;
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
  intigo_nid?: string | null;
  intigo_sent_at?: string | null;
  intigo_last_error?: string | null;
  intigo_status?: number | null;
  intigo_status_label?: string | null;
  intigo_synced_at?: string | null;
  intigo_city_id?: number | null;
  intigo_district_id?: number | null;
  items?: OrderItem[];
  user?: { id: number; name: string; email: string };
};

type IntigoCity = { id: number; name: string };
type IntigoDistrict = { id: number; name: string; city_id?: number };

function normalizePlace(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// Intigo status families: 1100 = annulé, 6xxx = retour, 2100 = échec livraison
// (relançable), 4xxx = en cours de livraison, 5xxx = livré.
const INTIGO_RELANCE_STATUS = 2100;

function intigoStatusTone(code?: number | null): string {
  if (code == null) return "bg-slate-100 text-slate-600";
  if (code === 1100 || (code >= 6000 && code < 7000)) return "bg-red-50 text-red-700";
  if (code === INTIGO_RELANCE_STATUS) return "bg-amber-50 text-amber-700";
  if (code >= 5000 && code < 6000) return "bg-emerald-50 text-emerald-700";
  if (code >= 4000 && code < 5000) return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function IntigoStatusBadge({ order }: { order: Order }) {
  if (!order.intigo_nid || !order.intigo_status_label) return null;
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-1 rounded-md ${intigoStatusTone(order.intigo_status)}`}>
      {order.intigo_status_label}
    </span>
  );
}

const intigoCancelled = (o: Order) =>
  o.intigo_status != null && (o.intigo_status === 1100 || (o.intigo_status >= 6000 && o.intigo_status < 7000));

/**
 * Edits the delivery info of an order using the same Intigo city/district
 * lists as the checkout, so names and IDs always match Intigo. If a parcel
 * already exists, the API pushes the change to Intigo (change-address /
 * change-phone) and returns warnings when Intigo refuses.
 */
function ShippingEditForm({ order, onSaved, onCancel }: {
  order: Order;
  onSaved: (order: Order, warnings?: string[] | null) => void;
  onCancel: () => void;
}) {
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const [cities, setCities] = useState<IntigoCity[]>([]);
  const [districts, setDistricts] = useState<IntigoDistrict[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(true);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [form, setForm] = useState({
    guest_name: order.guest_name ?? "",
    guest_phone: order.guest_phone ?? "",
    governorate: order.shipping_governorate ?? "",
    delegation: order.shipping_delegation ?? "",
    address: order.shipping_address ?? "",
    cityId: (order.intigo_city_id ?? null) as number | null,
    districtId: (order.intigo_district_id ?? null) as number | null,
  });

  useEffect(() => {
    let cancelled = false;
    apiV1<{ cities: IntigoCity[] }>("/shipping-regions/cities")
      .then((d) => { if (!cancelled) setCities(d.cities ?? []); })
      .catch(() => { if (!cancelled) setCities([]); })
      .finally(() => { if (!cancelled) setCitiesLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Preselect the city from the stored ID, or match the governorate name.
  useEffect(() => {
    if (cities.length === 0) return;
    setForm((f) => {
      if (f.cityId && cities.some((c) => c.id === f.cityId)) return f;
      const target = normalizePlace(f.governorate);
      const match = cities.find((c) => normalizePlace(c.name) === target)
        ?? cities.find((c) => normalizePlace(c.name).includes(target) || target.includes(normalizePlace(c.name)));
      return match ? { ...f, cityId: match.id, governorate: match.name } : f;
    });
  }, [cities]);

  useEffect(() => {
    if (!form.cityId) { setDistricts([]); return; }
    let cancelled = false;
    setDistrictsLoading(true);
    apiV1<{ districts: IntigoDistrict[] }>(`/shipping-regions/cities/${form.cityId}/districts`)
      .then((d) => { if (!cancelled) setDistricts(d.districts ?? []); })
      .catch(() => { if (!cancelled) setDistricts([]); })
      .finally(() => { if (!cancelled) setDistrictsLoading(false); });
    return () => { cancelled = true; };
  }, [form.cityId]);

  // Preselect the district from the stored ID, or match the delegation name.
  useEffect(() => {
    if (districts.length === 0) return;
    setForm((f) => {
      if (f.districtId && districts.some((d) => d.id === f.districtId)) return f;
      const target = normalizePlace(f.delegation);
      const match = districts.find((d) => normalizePlace(d.name) === target)
        ?? districts.find((d) => normalizePlace(d.name).includes(target) || target.includes(normalizePlace(d.name)));
      return match ? { ...f, districtId: match.id, delegation: match.name } : f;
    });
  }, [districts]);

  const citiesUnavailable = !citiesLoading && cities.length === 0;

  const selectCity = (cityId: number) => {
    const city = cities.find((c) => c.id === cityId);
    setForm((f) => ({
      ...f,
      cityId: cityId || null,
      governorate: city?.name ?? f.governorate,
      districtId: null,
      delegation: "",
    }));
  };

  const selectDistrict = (districtId: number) => {
    const district = districts.find((d) => d.id === districtId);
    setForm((f) => ({
      ...f,
      districtId: districtId || null,
      delegation: district?.name ?? f.delegation,
    }));
  };

  const save = async () => {
    if (!form.governorate.trim() || !form.delegation.trim() || !form.address.trim()) {
      notify("Gouvernorat, délégation et adresse sont requis", "error");
      return;
    }
    setSaving(true);
    try {
      const data = await apiAdmin<{ order: Order; intigo_warnings?: string[] | null }>(`/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          guest_name: form.guest_name,
          guest_phone: form.guest_phone,
          shipping_governorate: form.governorate,
          shipping_delegation: form.delegation,
          shipping_address: form.address,
          intigo_city_id: form.cityId,
          intigo_district_id: form.districtId,
        }),
      });
      onSaved(data.order, data.intigo_warnings);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-300 outline-none";

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Nom du destinataire</label>
          <input value={form.guest_name} onChange={(e) => setForm((f) => ({ ...f, guest_name: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Téléphone</label>
          <input value={form.guest_phone} onChange={(e) => setForm((f) => ({ ...f, guest_phone: e.target.value }))} className={inputClass} />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Gouvernorat (Intigo)</label>
          {citiesUnavailable ? (
            <input value={form.governorate} onChange={(e) => setForm((f) => ({ ...f, governorate: e.target.value, cityId: null }))} className={inputClass} />
          ) : (
            <select value={form.cityId ?? ""} onChange={(e) => selectCity(Number(e.target.value))} disabled={citiesLoading} className={inputClass}>
              <option value="">{citiesLoading ? "Chargement..." : "Choisir un gouvernorat"}</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Délégation (Intigo)</label>
          {citiesUnavailable ? (
            <input value={form.delegation} onChange={(e) => setForm((f) => ({ ...f, delegation: e.target.value, districtId: null }))} className={inputClass} />
          ) : (
            <select value={form.districtId ?? ""} onChange={(e) => selectDistrict(Number(e.target.value))} disabled={!form.cityId || districtsLoading} className={inputClass}>
              <option value="">
                {!form.cityId ? "Choisir d'abord un gouvernorat" : districtsLoading ? "Chargement..." : "Choisir une délégation"}
              </option>
              {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Adresse complète</label>
        <textarea rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={`${inputClass} resize-none`} />
      </div>
      {order.intigo_nid && (
        <p className="text-xs text-slate-400">
          Le colis Intigo <span className="font-mono">{order.intigo_nid}</span> sera mis à jour automatiquement.
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          <Check size={15} />
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          <X size={15} />
          Annuler
        </button>
      </div>
    </div>
  );
}

function OrderDetail({ id, onClose, onStatusChange, onDeleted, onOrderPatched }: {
  id: number;
  onClose: () => void;
  onStatusChange: (id: number, status: string) => void;
  onDeleted: (id: number) => void;
  onOrderPatched: (order: Order) => void;
}) {
  const { notify } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingIntigo, setSendingIntigo] = useState(false);
  const [syncingIntigo, setSyncingIntigo] = useState(false);
  const [relancing, setRelancing] = useState(false);
  const [editingShipping, setEditingShipping] = useState(false);

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

  const sendToIntigo = async () => {
    if (!order) return;
    const force = !!order.intigo_nid;
    if (force && !window.confirm(
      `Un colis Intigo existe déjà (${order.intigo_nid}).\nCréer un nouveau colis quand même ?`
    )) return;

    setSendingIntigo(true);
    try {
      const data = await apiAdmin<{ order: Order }>(`/orders/${id}/send_to_intigo`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      setOrder(data.order);
      onOrderPatched(data.order);
      notify(data.order.intigo_nid ? `Colis Intigo créé : ${data.order.intigo_nid}` : "Envoyé à Intigo");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur Intigo", "error");
      // Refresh to show last_error if partial update happened
      try {
        const d = await apiAdmin<{ order: Order }>(`/orders/${id}`);
        setOrder(d.order);
        onOrderPatched(d.order);
      } catch { /* ignore */ }
    } finally {
      setSendingIntigo(false);
    }
  };

  const syncIntigo = async () => {
    if (!order?.intigo_nid) return;
    setSyncingIntigo(true);
    try {
      const data = await apiAdmin<{ order: Order }>(`/orders/${id}/sync_intigo`, { method: "POST" });
      setOrder(data.order);
      onOrderPatched(data.order);
      if (data.order.status !== order.status) onStatusChange(id, data.order.status);
      notify(data.order.intigo_status_label
        ? `Statut Intigo : ${data.order.intigo_status_label}`
        : "Statut Intigo synchronisé");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur Intigo", "error");
    } finally {
      setSyncingIntigo(false);
    }
  };

  const relanceIntigo = async (acceptFee = false) => {
    if (!order?.intigo_nid) return;
    setRelancing(true);
    try {
      const data = await apiAdmin<{ order?: Order; message?: string; fee_required?: boolean }>(
        `/orders/${id}/relance_intigo`,
        { method: "POST", body: JSON.stringify({ accept_fee: acceptFee }) },
      );
      if (data.fee_required) {
        setRelancing(false);
        if (window.confirm(
          `Intigo demande des frais de relance pour ce colis.\n${data.message ?? ""}\n\nAccepter les frais et relancer ?`
        )) {
          await relanceIntigo(true);
        }
        return;
      }
      if (data.order) {
        setOrder(data.order);
        onOrderPatched(data.order);
        if (data.order.status !== order.status) onStatusChange(id, data.order.status);
      }
      notify(data.message ?? "Relance demandée — le client sera rappelé par Intigo");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur Intigo", "error");
    } finally {
      setRelancing(false);
    }
  };

  const deleteOrder = async () => {
    if (!order) return;
    if (!window.confirm(
      `Supprimer la commande ${order.order_number} ?\n\nLe stock sera remis en inventaire, le portefeuille et les stats seront ajustés.`
    )) return;

    setDeleting(true);
    try {
      await apiAdmin(`/orders/${id}`, { method: "DELETE" });
      notify("Commande supprimée");
      onDeleted(id);
      onClose();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setDeleting(false);
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
            <div className={`bg-slate-50 rounded-xl p-4 ${editingShipping ? "sm:col-span-2" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="flex items-center gap-2 font-bold text-slate-900 text-sm"><MapPin size={15} /> Livraison</h3>
                {!editingShipping && (
                  <button
                    type="button"
                    onClick={() => setEditingShipping(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Pencil size={13} /> Modifier
                  </button>
                )}
              </div>
              {editingShipping ? (
                <ShippingEditForm
                  order={order}
                  onCancel={() => setEditingShipping(false)}
                  onSaved={(updated, warnings) => {
                    setOrder(updated);
                    onOrderPatched(updated);
                    setEditingShipping(false);
                    if (warnings && warnings.length > 0) {
                      warnings.forEach((w) => notify(w, "error"));
                    } else {
                      notify(updated.intigo_nid
                        ? "Commande et colis Intigo mis à jour"
                        : "Commande mise à jour");
                    }
                  }}
                />
              ) : (
                <>
                  <p className="text-sm text-slate-700">{order.shipping_governorate} {order.shipping_delegation && `· ${order.shipping_delegation}`}</p>
                  {order.shipping_address && <p className="text-sm text-slate-500 mt-1">{order.shipping_address}</p>}
                  <p className="text-xs text-slate-400 mt-2">Paiement : {paymentMethodLabel(order.payment_method)}</p>
                </>
              )}
            </div>
          </div>

          {/* Intigo */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-2">
                  <Truck size={15} /> Intigo
                  <IntigoStatusBadge order={order} />
                </h3>
                {order.intigo_nid ? (
                  <>
                    <p className="text-sm text-slate-700">
                      NID : <span className="font-mono font-semibold">{order.intigo_nid}</span>
                      {order.intigo_sent_at && (
                        <span className="text-xs text-slate-400 ml-2">
                          {new Date(order.intigo_sent_at).toLocaleString("fr-FR")}
                        </span>
                      )}
                    </p>
                    {order.intigo_synced_at && (
                      <p className="text-xs text-slate-400 mt-1">
                        Synchronisé : {new Date(order.intigo_synced_at).toLocaleString("fr-FR")}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-amber-700 font-medium">Pas encore créé sur Intigo</p>
                )}
                {intigoCancelled(order) && (
                  <p className="text-xs text-red-700 font-semibold mt-1.5">
                    Colis annulé / retourné par Intigo — relancez la livraison ou recréez un colis.
                  </p>
                )}
                {order.intigo_status === INTIGO_RELANCE_STATUS && (
                  <p className="text-xs text-amber-700 font-semibold mt-1.5">
                    Échec de livraison — vous pouvez relancer la livraison (le client sera rappelé).
                  </p>
                )}
                {order.intigo_last_error && (
                  <p className="text-xs text-red-600 mt-1.5 break-words">{order.intigo_last_error}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {order.intigo_nid && (
                  <button
                    type="button"
                    onClick={syncIntigo}
                    disabled={syncingIntigo}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={15} className={syncingIntigo ? "animate-spin" : ""} />
                    {syncingIntigo ? "Sync..." : "Synchroniser"}
                  </button>
                )}
                {order.intigo_status === INTIGO_RELANCE_STATUS && (
                  <button
                    type="button"
                    onClick={() => relanceIntigo(false)}
                    disabled={relancing}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <PhoneCall size={15} />
                    {relancing ? "Relance..." : "Relancer la livraison"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={sendToIntigo}
                  disabled={sendingIntigo}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={15} className={sendingIntigo ? "animate-spin" : ""} />
                  {sendingIntigo
                    ? "Envoi..."
                    : order.intigo_nid
                      ? (intigoCancelled(order) ? "Recréer le colis" : "Renvoyer")
                      : "Créer sur Intigo"}
                </button>
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-2">Articles</h3>
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              {order.items?.map((it, i) => (
                <div key={i} className="flex justify-between items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    {it.image_url ? (
                      <img
                        src={it.image_url}
                        alt={it.product_name}
                        className="w-12 h-12 rounded-lg object-cover bg-slate-100 flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <ImageOff size={16} className="text-slate-300" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate">{it.product_name}</p>
                      <p className="text-xs text-slate-400">
                        {[it.size_label, it.color_label].filter(Boolean).join(" · ")}
                        {(it.size_label || it.color_label) && " · "}
                        {Number(it.unit_price).toFixed(3)} TND × {it.quantity}
                      </p>
                      {it.product_slug && it.product_available ? (
                        <a
                          href={`/produits/${it.product_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 mt-1"
                        >
                          <Eye size={13} /> Voir le produit
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">Produit indisponible</span>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-slate-900 text-sm flex-shrink-0">{(Number(it.unit_price) * it.quantity).toFixed(3)}</span>
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
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={deleteOrder}
              disabled={deleting}
              className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              <Trash2 size={16} />
              {deleting ? "Suppression..." : "Supprimer la commande"}
            </button>
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
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [sendingIntigoId, setSendingIntigoId] = useState<number | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

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

  const onDeleted = (id: number) =>
    setOrders((os) => os.filter((o) => o.id !== id));

  const onOrderPatched = (order: Order) =>
    setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, ...order } : o)));

  const sendToIntigoInline = async (order: Order) => {
    const force = !!order.intigo_nid;
    if (force && !window.confirm(
      `Un colis Intigo existe déjà (${order.intigo_nid}).\nCréer un nouveau colis quand même ?`
    )) return;

    setSendingIntigoId(order.id);
    try {
      const data = await apiAdmin<{ order: Order }>(`/orders/${order.id}/send_to_intigo`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      onOrderPatched(data.order);
      notify(data.order.intigo_nid ? `Colis Intigo : ${data.order.intigo_nid}` : "Envoyé à Intigo");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur Intigo", "error");
      try {
        const d = await apiAdmin<{ order: Order }>(`/orders/${order.id}`);
        onOrderPatched(d.order);
      } catch { /* ignore */ }
    } finally {
      setSendingIntigoId(null);
    }
  };

  const deleteOrderInline = async (order: Order) => {
    if (!window.confirm(
      `Supprimer ${order.order_number} ? Le stock et les stats seront remis à jour.`
    )) return;

    setDeletingId(order.id);
    try {
      await apiAdmin(`/orders/${order.id}`, { method: "DELETE" });
      onDeleted(order.id);
      if (detailId === order.id) setDetailId(null);
      notify("Commande supprimée");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const syncAllIntigo = async () => {
    setSyncingAll(true);
    try {
      const data = await apiAdmin<{ synced: number }>("/orders/sync_intigo_all", { method: "POST" });
      notify(data.synced > 0
        ? `${data.synced} colis synchronisé${data.synced > 1 ? "s" : ""} avec Intigo`
        : "Aucun colis à synchroniser");
      load(true);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur Intigo", "error");
    } finally {
      setSyncingAll(false);
    }
  };

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
    <AdminPage
      title="Commandes"
      subtitle={`${orders.length} commande${orders.length > 1 ? "s" : ""}`}
      actions={
        <button
          type="button"
          onClick={syncAllIntigo}
          disabled={syncingAll}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={syncingAll ? "animate-spin" : ""} />
          {syncingAll ? "Synchronisation..." : "Synchroniser Intigo"}
        </button>
      }
    >
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
                  <th className="text-left font-bold px-4 py-3 hidden lg:table-cell">Intigo</th>
                  <th className="text-right font-bold px-4 py-3">Actions</th>
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
                    <td className="px-4 py-3 hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
                      {o.intigo_nid ? (
                        <div className="space-y-1">
                          <span className="block font-mono text-xs text-slate-600">{o.intigo_nid}</span>
                          {o.intigo_status_label ? (
                            <IntigoStatusBadge order={o} />
                          ) : (
                            <span className="inline-block text-xs font-semibold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">Créé</span>
                          )}
                        </div>
                      ) : o.intigo_last_error ? (
                        <span className="text-xs text-red-600 font-medium" title={o.intigo_last_error}>Erreur</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailId(o.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          aria-label="Voir le détail"
                        >
                          <Eye size={16} />
                        </button>
                        {!o.intigo_nid && (
                          <button
                            type="button"
                            disabled={sendingIntigoId === o.id}
                            onClick={() => sendToIntigoInline(o)}
                            className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-40"
                            aria-label="Renvoyer à Intigo"
                            title="Renvoyer à Intigo"
                          >
                            <RefreshCw size={16} className={sendingIntigoId === o.id ? "animate-spin" : ""} />
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={deletingId === o.id}
                          onClick={() => deleteOrderInline(o)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                          aria-label="Supprimer la commande"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {detailId && (
        <OrderDetail
          id={detailId}
          onClose={() => setDetailId(null)}
          onStatusChange={onStatusChange}
          onDeleted={onDeleted}
          onOrderPatched={onOrderPatched}
        />
      )}
    </AdminPage>
  );
}
