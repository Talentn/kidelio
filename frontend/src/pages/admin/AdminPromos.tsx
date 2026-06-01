import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Megaphone, ExternalLink, ImageIcon } from "lucide-react";
import { apiAdmin } from "../../lib/api";
import { AdminPage, Card, Modal, useToast } from "../../components/admin/ui";

type Promo = {
  id: number;
  title?: string;
  link_url?: string;
  active: boolean;
  position: number;
  image_url?: string | null;
};

function PromoForm({
  open,
  onClose,
  promo,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  promo: Promo | null;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", link_url: "", position: "0", active: true });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setFile(null);
    setPreview(promo?.image_url ?? null);
    setForm({
      title: promo?.title ?? "",
      link_url: promo?.link_url ?? "",
      position: promo?.position != null ? String(promo.position) : "0",
      active: promo?.active ?? true,
    });
  }, [open, promo]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promo && !file) {
      setError("Ajoutez une image pour la promotion.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("link_url", form.link_url);
      fd.append("position", form.position || "0");
      fd.append("active", String(form.active));
      if (file) fd.append("image", file);

      if (promo) {
        await apiAdmin(`/promo-popups/${promo.id}`, { method: "PATCH", body: fd });
        notify("Promotion mise à jour");
      } else {
        await apiAdmin("/promo-popups", { method: "POST", body: fd });
        notify("Promotion créée");
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
    <Modal open={open} onClose={onClose} title={promo ? "Modifier la promotion" : "Nouvelle promotion"} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="input-label">Titre affiché sur le popup</label>
          <input
            className="input"
            placeholder="Ex. -30% sur votre première commande"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <p className="text-xs text-slate-400 mt-1">Grand titre en haut du popup, style Shein.</p>
        </div>

        <div>
          <label className="input-label">Lien au clic (optionnel)</label>
          <input
            className="input"
            placeholder="/produits ou https://..."
            value={form.link_url}
            onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
          />
          <p className="text-xs text-slate-400 mt-1">Chemin interne (/produits) ou URL externe.</p>
        </div>

        <div>
          <label className="input-label">Image *</label>
          <input
            type="file"
            accept="image/*"
            className="input py-2"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {preview && (
            <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
              <img src={preview} alt="Aperçu" className="w-full max-h-48 object-contain" />
            </div>
          )}
        </div>

        <div>
          <label className="input-label">Priorité</label>
          <input
            type="number"
            className="input"
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
          />
          <p className="text-xs text-slate-400 mt-1">Plus petit = affiché en premier.</p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="w-4 h-4 rounded accent-brand-500"
          />
          <span className="text-sm font-semibold text-slate-700">Active — visible sur la boutique</span>
        </label>

        {error && <p className="alert-error">{error}</p>}

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full font-semibold text-sm text-slate-600 hover:bg-slate-100 transition-colors">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="btn-primary btn-sm">
            {saving ? "..." : promo ? "Mettre à jour" : "Créer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminPromos() {
  const { notify } = useToast();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiAdmin<{ promos: Promo[] }>("/promo-popups")
      .then((d) => { setPromos(d.promos); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (p: Promo) => {
    try {
      const fd = new FormData();
      fd.append("active", String(!p.active));
      fd.append("title", p.title ?? "");
      fd.append("link_url", p.link_url ?? "");
      fd.append("position", String(p.position));
      await apiAdmin(`/promo-popups/${p.id}`, { method: "PATCH", body: fd });
      load();
      notify(p.active ? "Promotion désactivée" : "Promotion activée");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    }
  };

  const remove = async (p: Promo) => {
    if (!confirm(`Supprimer « ${p.title || "cette promotion"} » ?`)) return;
    try {
      await apiAdmin(`/promo-popups/${p.id}`, { method: "DELETE" });
      notify("Promotion supprimée");
      load();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    }
  };

  return (
    <AdminPage
      title="Promotions popup"
      subtitle="Popups affichés aux visiteurs à l'entrée du site"
      actions={
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => { setEditing(null); setFormOpen(true); }}
        >
          <Plus size={16} /> Nouvelle promo
        </button>
      }
    >
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-20 rounded-lg" />)}</div>
        ) : promos.length === 0 ? (
          <div className="text-center py-16">
            <Megaphone size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="font-semibold text-slate-500">Aucune promotion.</p>
            <p className="text-sm text-slate-400 mt-1">Créez une promo avec image et lien optionnel.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {promos.map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-slate-50/80 transition-colors">
                <div className="w-full sm:w-28 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 flex items-center justify-center">
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                    : <ImageIcon size={24} className="text-slate-300" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-slate-900">{p.title || `Promotion #${p.id}`}</p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  {p.link_url && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
                      <ExternalLink size={12} className="flex-shrink-0" />
                      {p.link_url}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">Priorité {p.position}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleActive(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${p.active ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
                  >
                    {p.active ? "Désactiver" : "Activer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditing(p); setFormOpen(true); }}
                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-brand-600 transition-colors"
                    aria-label="Modifier"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    className="p-2 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <PromoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        promo={editing}
        onSaved={load}
      />
    </AdminPage>
  );
}
