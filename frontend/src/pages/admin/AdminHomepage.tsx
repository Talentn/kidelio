import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, ImageIcon, Layout, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { apiAdmin, invalidateCache } from "../../lib/api";
import { AdminPage, Card, Modal, useToast } from "../../components/admin/ui";

type HomeAsset = {
  key: string;
  label: string;
  image_url?: string | null;
};

type HeroSlider = {
  id: number;
  title?: string;
  subtitle?: string;
  link_url?: string;
  active: boolean;
  position: number;
  image_url?: string | null;
};

const STATIC_FALLBACK: Record<string, string> = {
  hero_fallback: "/hero-femme.png",
  banner_collection: "/banner-collection.png",
  banner_babies: "/banner-babies.png",
  banner_toys: "/banner-toys.png",
};

function AssetSlot({ asset, onSaved }: { asset: HomeAsset; onSaved: () => void }) {
  const { notify } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(asset.image_url ?? null);

  useEffect(() => {
    setPreview(asset.image_url ?? null);
  }, [asset.image_url]);

  const upload = async (file: File) => {
    setUploading(true);
    const url = URL.createObjectURL(file);
    setPreview(url);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const d = await apiAdmin<{ asset: HomeAsset }>(`/homepage/assets/${asset.key}`, {
        method: "PATCH",
        body: fd,
      });
      setPreview(d.asset.image_url ?? url);
      notify(`${asset.label} mis à jour`);
      invalidateCache("/api/v1/homepage");
      onSaved();
    } catch (err: unknown) {
      setPreview(asset.image_url ?? null);
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setUploading(false);
    }
  };

  const displaySrc = preview || STATIC_FALLBACK[asset.key];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="aspect-[16/10] bg-slate-100 relative">
        {displaySrc ? (
          <img src={displaySrc} alt={asset.label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageIcon size={32} />
          </div>
        )}
        {!asset.image_url && (
          <span className="absolute top-2 left-2 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
            Image par défaut
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="font-bold text-slate-900 text-sm mb-1">{asset.label}</p>
        <p className="text-xs text-slate-400 mb-3 font-mono">{asset.key}</p>
        <label className="btn-secondary btn-sm w-full cursor-pointer justify-center">
          <Upload size={14} />
          {uploading ? "Envoi…" : "Changer la photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

function SliderForm({
  open,
  onClose,
  slider,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  slider: HeroSlider | null;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    link_url: "/produits",
    position: "0",
    active: true,
  });

  useEffect(() => {
    if (!open) return;
    setError("");
    setFile(null);
    setPreview(slider?.image_url ?? null);
    setForm({
      title: slider?.title ?? "",
      subtitle: slider?.subtitle ?? "",
      link_url: slider?.link_url ?? "/produits",
      position: slider?.position != null ? String(slider.position) : "0",
      active: slider?.active ?? true,
    });
  }, [open, slider]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slider && !file) {
      setError("Ajoutez une image pour le slide.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("subtitle", form.subtitle);
      fd.append("link_url", form.link_url);
      fd.append("position", form.position || "0");
      fd.append("active", String(form.active));
      if (file) fd.append("image", file);

      if (slider) {
        await apiAdmin(`/hero-sliders/${slider.id}`, { method: "PATCH", body: fd });
        notify("Slide mis à jour");
      } else {
        await apiAdmin("/hero-sliders", { method: "POST", body: fd });
        notify("Slide créé");
      }
      invalidateCache("/api/v1/homepage");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={slider ? "Modifier le slide" : "Nouveau slide hero"} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="input-label">Image *</label>
          <input
            type="file"
            accept="image/*"
            className="input py-2"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {preview && (
            <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 aspect-[21/9] bg-slate-50">
              <img src={preview} alt="Aperçu" className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        <div>
          <label className="input-label">Titre</label>
          <input
            className="input"
            placeholder="Ex. Collection été 2026"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div>
          <label className="input-label">Sous-titre</label>
          <input
            className="input"
            placeholder="Ex. Nouveautés pour les petits"
            value={form.subtitle}
            onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
          />
        </div>
        <div>
          <label className="input-label">Lien au clic</label>
          <input
            className="input"
            placeholder="/produits"
            value={form.link_url}
            onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
          />
        </div>
        <div>
          <label className="input-label">Ordre</label>
          <input
            type="number"
            className="input"
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
          />
          <p className="text-xs text-slate-400 mt-1">Plus petit = affiché en premier.</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="w-4 h-4 rounded accent-brand-500"
          />
          <span className="text-sm font-semibold text-slate-700">Actif sur la page d&apos;accueil</span>
        </label>
        {error && <p className="alert-error">{error}</p>}
        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-full text-sm font-semibold text-slate-600 hover:bg-slate-100">
            Annuler
          </button>
          <button type="submit" disabled={saving} className="btn-primary btn-sm">
            {saving ? "…" : slider ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminHomepage() {
  const { notify } = useToast();
  const [assets, setAssets] = useState<HomeAsset[]>([]);
  const [sliders, setSliders] = useState<HeroSlider[]>([]);
  const [loading, setLoading] = useState(true);
  const [sliderOpen, setSliderOpen] = useState(false);
  const [editingSlider, setEditingSlider] = useState<HeroSlider | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiAdmin<{ assets: HomeAsset[]; sliders: HeroSlider[] }>("/homepage")
      .then((d) => {
        setAssets(d.assets);
        setSliders(d.sliders);
      })
      .catch(() => notify("Impossible de charger la page d'accueil", "error"))
      .finally(() => setLoading(false));
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const removeSlider = async (s: HeroSlider) => {
    if (!confirm(`Supprimer le slide « ${s.title || `#${s.id}`} » ?`)) return;
    try {
      await apiAdmin(`/hero-sliders/${s.id}`, { method: "DELETE" });
      notify("Slide supprimé");
      load();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    }
  };

  const toggleSlider = async (s: HeroSlider) => {
    try {
      const fd = new FormData();
      fd.append("active", String(!s.active));
      fd.append("title", s.title ?? "");
      fd.append("subtitle", s.subtitle ?? "");
      fd.append("link_url", s.link_url ?? "");
      fd.append("position", String(s.position));
      await apiAdmin(`/hero-sliders/${s.id}`, { method: "PATCH", body: fd });
      load();
      notify(s.active ? "Slide désactivé" : "Slide activé");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    }
  };

  return (
    <AdminPage
      title="Page d'accueil"
      subtitle="Photos du hero, bannières et carousel — visibles sur la boutique"
      actions={
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary btn-sm inline-flex items-center gap-2"
        >
          <ExternalLink size={16} /> Voir la boutique
        </a>
      }
    >
      {loading ? (
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-48 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">Carousel hero</h2>
                <p className="text-sm text-slate-500">
                  Si au moins un slide actif a une image, il remplace le hero statique. Sinon, le hero principal
                  s&apos;affiche.
                </p>
              </div>
              <button
                type="button"
                className="btn-primary btn-sm flex-shrink-0"
                onClick={() => {
                  setEditingSlider(null);
                  setSliderOpen(true);
                }}
              >
                <Plus size={16} /> Nouveau slide
              </button>
            </div>
            <Card className="overflow-hidden">
              {sliders.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Layout size={36} className="mx-auto mb-2 text-slate-300" />
                  <p className="font-medium">Aucun slide — le hero statique sera utilisé.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sliders.map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 hover:bg-slate-50/80"
                    >
                      <div className="w-full sm:w-40 aspect-[21/9] rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                        {s.image_url ? (
                          <img src={s.image_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <ImageIcon size={24} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-900">{s.title || `Slide #${s.id}`}</p>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              s.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {s.active ? "Actif" : "Inactif"}
                          </span>
                        </div>
                        {s.subtitle && <p className="text-sm text-slate-500 mt-0.5">{s.subtitle}</p>}
                        {s.link_url && (
                          <p className="text-xs text-slate-400 mt-1 truncate">{s.link_url}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSlider(s)}
                          className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 hover:bg-slate-200"
                        >
                          {s.active ? "Désactiver" : "Activer"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSlider(s);
                            setSliderOpen(true);
                          }}
                          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSlider(s)}
                          className="p-2 rounded-xl hover:bg-red-50 text-slate-500 hover:text-red-600"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </section>

          <section>
            <h2 className="font-display text-lg font-bold text-slate-900 mb-1">Images fixes</h2>
            <p className="text-sm text-slate-500 mb-4">
              Hero de secours et bannières de la page d&apos;accueil. Les photos des catégories se gèrent dans{" "}
              <Link to="/admin/categories" className="text-brand-600 font-semibold hover:underline">
                Catégories
              </Link>
              .
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <AssetSlot key={asset.key} asset={asset} onSaved={load} />
              ))}
            </div>
          </section>
        </div>
      )}

      <SliderForm
        open={sliderOpen}
        onClose={() => setSliderOpen(false)}
        slider={editingSlider}
        onSaved={load}
      />
    </AdminPage>
  );
}
