import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Tag, Loader2 } from "lucide-react";
import { apiAdmin } from "../../lib/api";
import { AdminPage, Card, Modal, useToast } from "../../components/admin/ui";

type PromoCode = {
  id: number;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_type_label: string;
  discount_value: number;
  discount_label: string;
  min_order_amount?: number | null;
  max_discount?: number | null;
  usage_limit?: number | null;
  used_count: number;
  expires_at?: string | null;
  active: boolean;
  once_per_customer: boolean;
  show_on_products: boolean;
  usable: boolean;
  status_label: string;
  created_at: string;
};

type FormState = {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  min_order_amount: string;
  max_discount: string;
  usage_limit: string;
  expires_at: string;
  active: boolean;
  once_per_customer: boolean;
  show_on_products: boolean;
};

const emptyForm = (): FormState => ({
  code: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_amount: "",
  max_discount: "",
  usage_limit: "",
  expires_at: "",
  active: true,
  once_per_customer: false,
  show_on_products: false,
});

function toDatetimeLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PromoCodeForm({
  open,
  onClose,
  promo,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  promo: PromoCode | null;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm());

  useEffect(() => {
    if (!open) return;
    setError("");
    if (promo) {
      setForm({
        code: promo.code,
        discount_type: promo.discount_type,
        discount_value: String(promo.discount_value),
        min_order_amount: promo.min_order_amount != null ? String(promo.min_order_amount) : "",
        max_discount: promo.max_discount != null ? String(promo.max_discount) : "",
        usage_limit: promo.usage_limit != null ? String(promo.usage_limit) : "",
        expires_at: toDatetimeLocal(promo.expires_at),
        active: promo.active,
        once_per_customer: promo.once_per_customer,
        show_on_products: promo.show_on_products,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, promo]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    const body: Record<string, unknown> = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      active: form.active,
      once_per_customer: form.once_per_customer,
      show_on_products: form.show_on_products,
    };

    if (form.min_order_amount.trim()) body.min_order_amount = Number(form.min_order_amount);
    else body.min_order_amount = null;
    if (form.max_discount.trim() && form.discount_type === "percentage") {
      body.max_discount = Number(form.max_discount);
    } else {
      body.max_discount = null;
    }
    if (form.usage_limit.trim()) body.usage_limit = Number(form.usage_limit);
    else body.usage_limit = null;
    body.expires_at = form.expires_at ? new Date(form.expires_at).toISOString() : null;

    try {
      if (promo) {
        await apiAdmin(`/promo-codes/${promo.id}`, { method: "PATCH", body: JSON.stringify(body) });
        notify("Code promo mis à jour");
      } else {
        await apiAdmin("/promo-codes", { method: "POST", body: JSON.stringify(body) });
        notify("Code promo créé");
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={promo ? `Modifier ${promo.code}` : "Nouveau code promo"}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Code *</label>
            <input
              className="input font-mono uppercase tracking-widest"
              placeholder="KIDS10"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              required
            />
          </div>
          <div>
            <label className="input-label">Type de réduction *</label>
            <select
              className="input"
              value={form.discount_type}
              onChange={(e) =>
                setForm((f) => ({ ...f, discount_type: e.target.value as "percentage" | "fixed" }))
              }
            >
              <option value="percentage">Pourcentage (%)</option>
              <option value="fixed">Montant fixe (TND)</option>
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label">
              Valeur * {form.discount_type === "percentage" ? "(%)" : "(TND)"}
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              className="input"
              value={form.discount_value}
              onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="input-label">Montant minimum de commande (TND)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              className="input"
              placeholder="Optionnel"
              value={form.min_order_amount}
              onChange={(e) => setForm((f) => ({ ...f, min_order_amount: e.target.value }))}
            />
          </div>
        </div>

        {form.discount_type === "percentage" && (
          <div>
            <label className="input-label">Plafond de réduction (TND)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              className="input"
              placeholder="Optionnel — ex. plafond à 20 TND"
              value={form.max_discount}
              onChange={(e) => setForm((f) => ({ ...f, max_discount: e.target.value }))}
            />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Limite d&apos;utilisations</label>
            <input
              type="number"
              min="1"
              className="input"
              placeholder="Illimité si vide"
              value={form.usage_limit}
              onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
            />
            {promo && (
              <p className="text-xs text-slate-400 mt-1">
                Déjà utilisé : {promo.used_count} fois
              </p>
            )}
          </div>
          <div>
            <label className="input-label">Date d&apos;expiration</label>
            <input
              type="datetime-local"
              className="input"
              value={form.expires_at}
              onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
            />
            <p className="text-xs text-slate-400 mt-1">Laisser vide = pas d&apos;expiration</p>
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.show_on_products}
            onChange={(e) => setForm((f) => ({ ...f, show_on_products: e.target.checked }))}
            className="w-4 h-4 rounded accent-brand-500"
          />
          <span className="text-sm font-semibold text-slate-700">Afficher sur les fiches produit</span>
        </label>
        <p className="text-xs text-slate-400 -mt-2">
          Affiche le prix avec ce code et l&apos;applique automatiquement au checkout pour les clients éligibles.
        </p>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.once_per_customer}
            onChange={(e) => setForm((f) => ({ ...f, once_per_customer: e.target.checked }))}
            className="w-4 h-4 rounded accent-brand-500"
          />
          <span className="text-sm font-semibold text-slate-700">Une fois par client</span>
        </label>
        <p className="text-xs text-slate-400 -mt-2">
          Compte connecté, ou sinon téléphone / nom / adresse de livraison pour les invités.
        </p>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="w-4 h-4 rounded accent-brand-500"
          />
          <span className="text-sm font-semibold text-slate-700">Code actif</span>
        </label>

        {error && <p className="alert-error">{error}</p>}

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full font-semibold text-sm text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Annuler
          </button>
          <button type="submit" disabled={saving} className="btn-primary btn-sm">
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Enregistrement...
              </>
            ) : promo ? (
              "Mettre à jour"
            ) : (
              "Créer"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function statusStyle(label: string) {
  switch (label) {
    case "Actif":
      return "bg-emerald-100 text-emerald-700";
    case "Inactif":
      return "bg-slate-200 text-slate-600";
    case "Expiré":
      return "bg-amber-100 text-amber-700";
    case "Épuisé":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function AdminPromoCodes() {
  const { notify } = useToast();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiAdmin<{ promo_codes: PromoCode[] }>("/promo-codes")
      .then((d) => {
        setPromoCodes(d.promo_codes);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (promo: PromoCode) => {
    if (!window.confirm(`Supprimer le code « ${promo.code} » ?`)) return;
    try {
      await apiAdmin(`/promo-codes/${promo.id}`, { method: "DELETE" });
      notify("Code promo supprimé");
      load();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Suppression impossible", "error");
    }
  };

  return (
    <AdminPage
      title="Codes promo"
      subtitle={`${promoCodes.length} code${promoCodes.length > 1 ? "s" : ""}`}
      actions={
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="btn-primary btn-sm"
        >
          <Plus size={16} /> Nouveau code
        </button>
      }
    >
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-lg" />
            ))}
          </div>
        ) : promoCodes.length === 0 ? (
          <div className="text-center py-16">
            <Tag size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="font-semibold text-slate-500 mb-4">Aucun code promo.</p>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="btn-primary btn-sm"
            >
              <Plus size={16} /> Créer un code
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-bold px-4 py-3">Code</th>
                  <th className="text-left font-bold px-4 py-3">Réduction</th>
                  <th className="text-left font-bold px-4 py-3 hidden md:table-cell">Min. commande</th>
                  <th className="text-left font-bold px-4 py-3">Utilisations</th>
                  <th className="text-left font-bold px-4 py-3 hidden lg:table-cell">Expiration</th>
                  <th className="text-left font-bold px-4 py-3">Statut</th>
                  <th className="text-right font-bold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {promoCodes.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-bold font-mono tracking-wider text-slate-900">
                      {p.code}
                      {p.once_per_customer && (
                        <span className="block text-[10px] font-semibold text-violet-600 tracking-normal mt-0.5">
                          1× par client
                        </span>
                      )}
                      {p.show_on_products && (
                        <span className="block text-[10px] font-semibold text-sky-600 tracking-normal mt-0.5">
                          Fiche produit
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{p.discount_label}</p>
                      <p className="text-xs text-slate-400">{p.discount_type_label}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                      {p.min_order_amount != null
                        ? `${Number(p.min_order_amount).toFixed(3)} TND`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-semibold">
                      {p.used_count}
                      {p.usage_limit != null ? ` / ${p.usage_limit}` : " / ∞"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell whitespace-nowrap">
                      {p.expires_at
                        ? new Date(p.expires_at).toLocaleString("fr-FR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "Aucune"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${statusStyle(p.status_label)}`}
                      >
                        {p.status_label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                          className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          aria-label="Modifier"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(p)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          aria-label="Supprimer"
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

      <PromoCodeForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        promo={editing}
        onSaved={load}
      />
    </AdminPage>
  );
}
