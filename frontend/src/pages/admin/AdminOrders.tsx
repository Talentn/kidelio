import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Eye, ShoppingCart, Phone, PhoneCall, MapPin, User as UserIcon, Trash2, ImageOff, RefreshCw, Truck, Pencil, X, Check, Plus, Minus, Printer, History } from "lucide-react";
import { apiAdmin, apiV1 } from "../../lib/api";
import { ORDER_STATUSES, orderStatusLabel, orderStatusSelectClass, paymentMethodLabel } from "../../lib/orderStatus";
import { useLivePoll } from "../../hooks/useLivePoll";
import { AdminPage, Card, Modal, StatusBadge, useToast } from "../../components/admin/ui";

type OrderItem = {
  id: number;
  product_id?: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  size_label?: string;
  color_label?: string;
  product_slug?: string | null;
  product_available?: boolean;
  image_url?: string | null;
};

type PickerSize = { id: number; size: string; stock: number };
type PickerColor = { id: number; name: string; sizes: PickerSize[] };
type PickerProduct = {
  id: number;
  name: string;
  reference?: string | null;
  price: number;
  promo_price?: number | null;
  on_promo?: boolean;
  stock: number;
  active: boolean;
  image_urls?: string[];
  colors: PickerColor[];
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
  intigo_delivery_attempts?: number | null;
  intigo_can_open?: boolean;
  intigo_is_exchange?: boolean;
  intigo_city_id?: number | null;
  intigo_district_id?: number | null;
  items?: OrderItem[];
  user?: { id: number; name: string; email: string };
};

type IntigoCity = { id: number; name: string };
type IntigoDistrict = { id: number; name: string; city_id?: number };

type IntigoHistoryEntry = {
  type: string;
  timestamp: string;
  data?: Record<string, unknown>;
};

const INTIGO_EVENT_LABELS: Record<string, string> = {
  status_change: "Changement de statut",
  delivery_attempt: "Tentative de contact client",
  scan: "Scan du colis",
  address_change: "Changement d'adresse",
  phone_change: "Changement de téléphone",
  partner_action: "Action partenaire",
};

const INTIGO_DATA_LABELS: Record<string, string> = {
  status: "Statut",
  status_label: "Statut",
  status_code: "Code",
  reason: "Motif",
  result: "Résultat",
  outcome: "Résultat",
  phone: "Téléphone",
  note: "Note",
  notes: "Notes",
  message: "Message",
  agent: "Agent",
  driver: "Livreur",
  attempt: "N° tentative",
  attempt_number: "N° tentative",
  channel: "Canal",
};

const INTIGO_EVENT_STYLES: Record<string, string> = {
  status_change: "bg-blue-100 text-blue-600",
  delivery_attempt: "bg-amber-100 text-amber-700",
  scan: "bg-slate-100 text-slate-500",
  address_change: "bg-violet-100 text-violet-600",
  phone_change: "bg-violet-100 text-violet-600",
  partner_action: "bg-slate-100 text-slate-500",
};

/** Flattens the free-form event data into a readable "clé : valeur" line. */
function intigoEventDetails(data?: Record<string, unknown>): string {
  if (!data) return "";
  return Object.entries(data)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => {
      const label = INTIGO_DATA_LABELS[k] ?? k.replace(/_/g, " ");
      return `${label} : ${typeof v === "object" ? JSON.stringify(v) : String(v)}`;
    })
    .join(" · ");
}

function isContactAttemptEvent(event: IntigoHistoryEntry): boolean {
  if (event.type === "delivery_attempt") return true;
  // Relance / IVR callbacks sometimes arrive as partner_action.
  const blob = JSON.stringify(event.data ?? {}).toLowerCase();
  return event.type === "partner_action" && /relance|appel|call|ivr|contact|tentative/.test(blob);
}

/** tel: link for a stored phone; 8-digit local numbers get Tunisia's +216 prefix. */
function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return /^\d{8}$/.test(digits) ? `tel:+216${digits}` : `tel:${digits}`;
}

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

/** Product/variant picker used to add an article to an existing order. */
function AddItemPicker({ adding, onAdd, onCancel }: {
  adding: boolean;
  onAdd: (payload: { product_id: number; color_label?: string; size_label?: string; quantity: number }) => void;
  onCancel: () => void;
}) {
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [productId, setProductId] = useState<number | null>(null);
  const [colorName, setColorName] = useState("");
  const [sizeName, setSizeName] = useState("");
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let cancelled = false;
    apiAdmin<{ products: PickerProduct[] }>("/products")
      .then((d) => { if (!cancelled) setProducts((d.products ?? []).filter((p) => p.active)); })
      .catch(() => { if (!cancelled) setProducts([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || (p.reference ?? "").toLowerCase().includes(q))
      .slice(0, 30);
  }, [products, query]);

  const product = products.find((p) => p.id === productId) ?? null;
  const color = product?.colors.find((c) => c.name === colorName) ?? null;
  const size = color?.sizes.find((s) => s.size === sizeName) ?? null;
  const unitPrice = product ? (product.on_promo && product.promo_price ? product.promo_price : product.price) : 0;
  const maxStock = size ? size.stock
    : color ? color.sizes.reduce((sum, s) => sum + s.stock, 0) || product?.stock || 0
    : product?.stock ?? 0;

  const canAdd = !!product
    && (product.colors.length === 0 || !!color)
    && (!color || color.sizes.length === 0 || !!size)
    && qty >= 1;

  const selectClass = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-brand-300 outline-none";

  return (
    <div className="border border-brand-100 bg-brand-50/40 rounded-xl p-4 space-y-3">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setProductId(null); setColorName(""); setSizeName(""); }}
          placeholder={loading ? "Chargement des produits..." : "Rechercher un produit (nom ou référence)..."}
          disabled={loading}
          className={`${selectClass} pl-9`}
        />
      </div>

      {!product && (
        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
          {matches.length === 0 && !loading ? (
            <p className="p-3 text-sm text-slate-400">Aucun produit trouvé.</p>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setProductId(p.id); setColorName(""); setSizeName(""); setQty(1); }}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
              >
                {p.image_urls?.[0] ? (
                  <img src={p.image_urls[0]} alt="" className="w-9 h-9 rounded-lg object-cover bg-slate-100 flex-shrink-0" loading="lazy" />
                ) : (
                  <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0"><ImageOff size={14} className="text-slate-300" /></span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800 truncate">{p.name}</span>
                  <span className="block text-xs text-slate-400">
                    {(p.on_promo && p.promo_price ? p.promo_price : p.price)} TND{p.reference ? ` · ${p.reference}` : ""}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {product && (
        <>
          <div className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2">
            <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
            <button type="button" onClick={() => setProductId(null)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex-shrink-0">
              Changer
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            {product.colors.length > 0 && (
              <select value={colorName} onChange={(e) => { setColorName(e.target.value); setSizeName(""); }} className={selectClass}>
                <option value="">Couleur...</option>
                {product.colors.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            )}
            {color && color.sizes.length > 0 && (
              <select value={sizeName} onChange={(e) => setSizeName(e.target.value)} className={selectClass}>
                <option value="">Taille...</option>
                {color.sizes.map((s) => (
                  <option key={s.id} value={s.size} disabled={s.stock <= 0}>
                    {s.size} {s.stock <= 0 ? "(rupture)" : `(stock : ${s.stock})`}
                  </option>
                ))}
              </select>
            )}
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className={selectClass}
              aria-label="Quantité"
            />
          </div>
          <p className="text-xs text-slate-500">
            {Number(unitPrice).toFixed(3)} TND × {qty} = <span className="font-semibold">{(Number(unitPrice) * qty).toFixed(3)} TND</span>
            {maxStock > 0 && <span className="text-slate-400"> — stock disponible : {maxStock}</span>}
          </p>
        </>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canAdd || adding}
          onClick={() => product && onAdd({
            product_id: product.id,
            color_label: colorName || undefined,
            size_label: sizeName || undefined,
            quantity: qty,
          })}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          <Check size={15} />
          {adding ? "Ajout..." : "Ajouter à la commande"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={adding}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          <X size={15} />
          Fermer
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
  const [printingBordereau, setPrintingBordereau] = useState(false);
  const [savingFlag, setSavingFlag] = useState<string | null>(null);
  const [relancing, setRelancing] = useState(false);
  const [editingShipping, setEditingShipping] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [itemBusy, setItemBusy] = useState<number | "add" | null>(null);
  const [intigoHistory, setIntigoHistory] = useState<IntigoHistoryEntry[] | null>(null);
  const [showIntigoHistory, setShowIntigoHistory] = useState(false);
  const [loadingIntigoHistory, setLoadingIntigoHistory] = useState(false);

  useEffect(() => {
    setIntigoHistory(null);
    setShowIntigoHistory(false);
    apiAdmin<{ order: Order }>(`/orders/${id}`).then((d) => setOrder(d.order)).catch(() => {});
  }, [id]);

  const toggleIntigoHistory = async () => {
    if (showIntigoHistory) {
      setShowIntigoHistory(false);
      return;
    }
    setShowIntigoHistory(true);
    if (intigoHistory) return;
    setLoadingIntigoHistory(true);
    try {
      const data = await apiAdmin<{ history: IntigoHistoryEntry[] }>(`/orders/${id}/intigo_history`);
      setIntigoHistory(data.history ?? []);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur Intigo", "error");
      setShowIntigoHistory(false);
    } finally {
      setLoadingIntigoHistory(false);
    }
  };

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

  const printBordereau = async () => {
    setPrintingBordereau(true);
    try {
      const data = await apiAdmin<{ url: string }>(`/orders/${id}/bordereau`, { method: "POST" });
      window.open(data.url, "_blank", "noopener");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur Intigo", "error");
    } finally {
      setPrintingBordereau(false);
    }
  };

  const toggleIntigoFlag = async (field: "intigo_can_open" | "intigo_is_exchange", value: boolean) => {
    setSavingFlag(field);
    try {
      const data = await apiAdmin<{ order: Order; intigo_warnings?: string[] | null }>(`/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      setOrder(data.order);
      onOrderPatched(data.order);
      if (data.intigo_warnings && data.intigo_warnings.length > 0) {
        data.intigo_warnings.forEach((w) => notify(w, "error"));
      } else if (order?.intigo_nid) {
        notify("Option mise à jour sur Intigo");
      }
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setSavingFlag(null);
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

  const applyItemsResponse = (data: { order: Order; intigo_warnings?: string[] | null }) => {
    setOrder(data.order);
    onOrderPatched(data.order);
    if (data.intigo_warnings && data.intigo_warnings.length > 0) {
      data.intigo_warnings.forEach((w) => notify(w, "error"));
    }
  };

  const addItem = async (payload: { product_id: number; color_label?: string; size_label?: string; quantity: number }) => {
    setItemBusy("add");
    try {
      const data = await apiAdmin<{ order: Order; intigo_warnings?: string[] | null }>(`/orders/${id}/add_item`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      applyItemsResponse(data);
      notify("Article ajouté à la commande");
      setShowItemPicker(false);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setItemBusy(null);
    }
  };

  const changeItemQty = async (item: OrderItem, quantity: number) => {
    if (quantity < 1) return;
    setItemBusy(item.id);
    try {
      const data = await apiAdmin<{ order: Order; intigo_warnings?: string[] | null }>(`/orders/${id}/update_item`, {
        method: "PATCH",
        body: JSON.stringify({ item_id: item.id, quantity }),
      });
      applyItemsResponse(data);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setItemBusy(null);
    }
  };

  const removeItem = async (item: OrderItem) => {
    if (!window.confirm(`Retirer « ${item.product_name} » de la commande ?\nLe stock sera remis en inventaire.`)) return;
    setItemBusy(item.id);
    try {
      const data = await apiAdmin<{ order: Order; intigo_warnings?: string[] | null }>(`/orders/${id}/remove_item`, {
        method: "DELETE",
        body: JSON.stringify({ item_id: item.id }),
      });
      applyItemsResponse(data);
      notify("Article retiré — stock remis en inventaire");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setItemBusy(null);
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

  const itemsLocked = !!order && ["delivered", "cancelled", "refunded"].includes(order.status);

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
              {order.guest_phone && (
                <a
                  href={telHref(order.guest_phone)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline mt-1"
                  title="Appeler le client"
                >
                  <Phone size={13} /> {order.guest_phone}
                </a>
              )}
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
                    {order.intigo_delivery_attempts != null && (
                      <p
                        className={`flex items-center gap-1.5 text-xs font-semibold mt-1 ${
                          order.intigo_delivery_attempts > 0 ? "text-amber-700" : "text-slate-400"
                        }`}
                      >
                        <PhoneCall size={12} />
                        {order.intigo_delivery_attempts} tentative{order.intigo_delivery_attempts > 1 ? "s" : ""} de contact client
                        <span className="font-medium text-slate-400">(max 5)</span>
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
                    onClick={printBordereau}
                    disabled={printingBordereau}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Printer size={15} />
                    {printingBordereau ? "Génération..." : "Imprimer le bordereau"}
                  </button>
                )}
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
                {order.intigo_nid && (
                  <button
                    type="button"
                    onClick={toggleIntigoHistory}
                    disabled={loadingIntigoHistory}
                    className={`inline-flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-xl transition-colors disabled:opacity-50 ${
                      showIntigoHistory
                        ? "text-brand-700 bg-brand-50 border border-brand-200"
                        : "text-slate-700 bg-white border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <History size={15} />
                    {loadingIntigoHistory ? "Chargement..." : "Historique"}
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

            {/* Parcel options — pushed to Intigo (modifiable while the parcel is in pickup) */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 pt-3 border-t border-slate-200/70">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={order.intigo_can_open ?? true}
                  disabled={savingFlag !== null}
                  onChange={(e) => toggleIntigoFlag("intigo_can_open", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-300"
                />
                <span className={savingFlag === "intigo_can_open" ? "opacity-50" : ""}>
                  Le client peut ouvrir le colis
                </span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={order.intigo_is_exchange ?? false}
                  disabled={savingFlag !== null}
                  onChange={(e) => toggleIntigoFlag("intigo_is_exchange", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-300"
                />
                <span className={savingFlag === "intigo_is_exchange" ? "opacity-50" : ""}>
                  Colis d'échange
                </span>
              </label>
              {order.intigo_nid && (
                <span className="text-[11px] text-slate-400">
                  Modifiable sur Intigo uniquement avant l'enlèvement du colis.
                </span>
              )}
            </div>

            {/* Intigo parcel timeline (statuts, tentatives de contact client, scans…) */}
            {showIntigoHistory && (
              <div className="mt-3 pt-3 border-t border-slate-200/70">
                <h4 className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-2">
                  <History size={14} /> Historique du colis
                  {(() => {
                    const contactCount = (intigoHistory ?? []).filter(isContactAttemptEvent).length;
                    if (contactCount === 0) return null;
                    return (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        {contactCount} contact{contactCount > 1 ? "s" : ""} client
                      </span>
                    );
                  })()}
                </h4>
                {loadingIntigoHistory ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 rounded-lg" />)}
                  </div>
                ) : !intigoHistory || intigoHistory.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucun événement pour ce colis.</p>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {intigoHistory.map((event, i) => {
                      const details = intigoEventDetails(event.data);
                      const isAttempt = isContactAttemptEvent(event);
                      return (
                        <div
                          key={`${event.timestamp}-${i}`}
                          className={`flex items-start gap-2.5 rounded-lg px-3 py-2 ${
                            isAttempt ? "bg-amber-50/70 border border-amber-100" : "bg-white border border-slate-100"
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isAttempt
                                ? INTIGO_EVENT_STYLES.delivery_attempt
                                : (INTIGO_EVENT_STYLES[event.type] ?? "bg-slate-100 text-slate-500")
                            }`}
                          >
                            {isAttempt ? <PhoneCall size={13} /> : <Truck size={13} />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800">
                                {isAttempt && event.type !== "delivery_attempt"
                                  ? "Tentative de contact client"
                                  : (INTIGO_EVENT_LABELS[event.type] ?? event.type)}
                              </span>
                              <time className="text-xs text-slate-400 whitespace-nowrap">
                                {new Date(event.timestamp).toLocaleString("fr-FR")}
                              </time>
                            </div>
                            {details && (
                              <p className="text-xs text-slate-500 mt-0.5 break-words">{details}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-900 text-sm">Articles</h3>
              {!itemsLocked && !showItemPicker && (
                <button
                  type="button"
                  onClick={() => setShowItemPicker(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 px-2 py-1 rounded-lg transition-colors"
                >
                  <Plus size={13} /> Ajouter un article
                </button>
              )}
            </div>
            {showItemPicker && (
              <div className="mb-3">
                <AddItemPicker adding={itemBusy === "add"} onAdd={addItem} onCancel={() => setShowItemPicker(false)} />
              </div>
            )}
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              {order.items?.map((it) => (
                <div key={it.id} className="flex justify-between items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0">
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
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {!itemsLocked && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={itemBusy === it.id || it.quantity <= 1}
                          onClick={() => changeItemQty(it, it.quantity - 1)}
                          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center transition-colors"
                          aria-label="Diminuer la quantité"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-slate-800">{it.quantity}</span>
                        <button
                          type="button"
                          disabled={itemBusy === it.id}
                          onClick={() => changeItemQty(it, it.quantity + 1)}
                          className="w-7 h-7 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 flex items-center justify-center transition-colors"
                          aria-label="Augmenter la quantité"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    )}
                    <span className="font-bold text-slate-900 text-sm w-16 text-right">{(Number(it.unit_price) * it.quantity).toFixed(3)}</span>
                    {!itemsLocked && (
                      <button
                        type="button"
                        disabled={itemBusy === it.id || (order.items?.length ?? 0) <= 1}
                        onClick={() => removeItem(it)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition-colors"
                        aria-label={`Retirer ${it.product_name}`}
                        title={(order.items?.length ?? 0) <= 1 ? "Dernier article — supprimez plutôt la commande" : "Retirer l'article"}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {itemsLocked && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                Articles non modifiables ({orderStatusLabel(order.status)}).
              </p>
            )}
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
                      {o.guest_phone && (
                        <a
                          href={telHref(o.guest_phone)}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-brand-600 hover:text-brand-700 hover:underline"
                          title="Appeler le client"
                        >
                          {o.guest_phone}
                        </a>
                      )}
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
                          {o.intigo_delivery_attempts != null && o.intigo_delivery_attempts > 0 && (
                            <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                              <PhoneCall size={11} />
                              {o.intigo_delivery_attempts} contact{o.intigo_delivery_attempts > 1 ? "s" : ""}
                            </span>
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
