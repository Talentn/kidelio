import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Minus,
  Search,
  Pencil,
  Trash2,
  Package,
  Star,
  Tag as TagIcon,
  ImagePlus,
  X,
  Palette,
  Ruler,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { apiAdmin } from "../../lib/api";
import {
  effectiveAdminCategoryId,
  resolveAdminCategoryIds,
  type AdminCategory,
} from "../../lib/categories";
import { AdminPage, Card, Modal, ConfirmDialog, useToast } from "../../components/admin/ui";
import type { SizeAttr } from "./AdminAttributes";

type ColorImage = { id: number; url: string };
type ColorSize  = { id: number; size: string; stock: number };
type ProductColor = {
  id: number;
  name: string;
  hex?: string;
  position?: number;
  images: ColorImage[];
  sizes?: ColorSize[];
};

type Product = {
  id: number;
  name: string;
  slug: string;
  reference?: string;
  price: number;
  promo_price?: number;
  stock: number;
  active: boolean;
  featured: boolean;
  on_promo: boolean;
  age_group?: string;
  category_id?: number;
  description?: string;
  image_urls: string[];
  colors?: ProductColor[];
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function useFilePreviews(files: File[]) {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  return previews;
}

function FilePreviewGrid({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="flex gap-2 flex-wrap mt-3">
      {urls.map((url, i) => (
        <img
          key={url}
          src={url}
          alt={`Aperçu ${i + 1}`}
          className="w-16 h-16 rounded-xl object-cover border border-slate-200"
        />
      ))}
    </div>
  );
}

/* ── Product form modal ── */
function ProductForm({
  open,
  onClose,
  product,
  categoryTree,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  categoryTree: AdminCategory[];
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [current, setCurrent] = useState<Product | null>(product);
  const [globalSizes, setGlobalSizes] = useState<SizeAttr[]>([]);
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("#e8b4bc");
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [parentCategoryId, setParentCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const filePreviews = useFilePreviews(files);
  const colorActionsRef = useRef<{
    hasPendingPhotos: () => boolean;
    submitPending: () => Promise<ProductColor | null>;
  } | null>(null);

  const [form, setForm] = useState({
    name: "",
    slug: "",
    reference: "",
    description: "",
    price: "",
    promo_price: "",
    stock: "0",
    age_group: "",
    category_id: "",
    active: true,
    featured: false,
    on_promo: false,
  });

  useEffect(() => {
    if (open) {
      apiAdmin<{ sizes: SizeAttr[] }>("/size-attributes")
        .then((d) => setGlobalSizes(d.sizes))
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setError("");
      setFiles([]);
      setColorName("");
      setColorHex("#e8b4bc");
      setSelectedSizes([]);
      setCurrent(product);
      setSlugTouched(!!product);
      const { parentId, subId } = resolveAdminCategoryIds(categoryTree, product?.category_id ?? null);
      setParentCategoryId(parentId);
      setSubCategoryId(subId);
      setForm({
        name: product?.name ?? "",
        slug: product?.slug ?? "",
        reference: product?.reference ?? "",
        description: product?.description ?? "",
        price: product?.price != null ? String(product.price) : "",
        promo_price: product?.promo_price != null ? String(product.promo_price) : "",
        stock: product?.stock != null ? String(product.stock) : "0",
        age_group: product?.age_group ?? "",
        category_id: product?.category_id ? String(product.category_id) : "",
        active: product?.active ?? true,
        featured: product?.featured ?? false,
        on_promo: product?.on_promo ?? false,
      });
    }
  }, [open, product, categoryTree]);

  const selectedParent = categoryTree.find((r) => String(r.id) === parentCategoryId);
  const subcategories = selectedParent?.children ?? [];
  const needsSubcategory = subcategories.length > 0;

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onNameChange = (value: string) => {
    setForm((f) => ({ ...f, name: value, slug: slugTouched ? f.slug : slugify(value) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!current && files.length > 0 && !colorName.trim()) {
      setError("Indiquez un nom de couleur pour associer les photos.");
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("slug", form.slug || slugify(form.name));
      fd.append("reference", form.reference);
      fd.append("description", form.description);
      fd.append("price", form.price);
      if (form.promo_price) fd.append("promo_price", form.promo_price);
      fd.append("stock", form.stock || "0");
      fd.append("age_group", form.age_group);
      const categoryId = effectiveAdminCategoryId(categoryTree, parentCategoryId, subCategoryId);
      if (needsSubcategory && parentCategoryId && !subCategoryId) {
        setError("Choisissez une sous-catégorie.");
        setSaving(false);
        return;
      }
      if (categoryId) fd.append("category_id", categoryId);
      fd.append("active", String(form.active));
      fd.append("featured", String(form.featured));
      fd.append("on_promo", String(form.on_promo));

      let saved: Product;

      if (current) {
        let addedColor: ProductColor | null = null;
        if (colorActionsRef.current?.hasPendingPhotos()) {
          addedColor = await colorActionsRef.current.submitPending();
          if (!addedColor) {
            setSaving(false);
            return;
          }
        }

        const d = await apiAdmin<{ product: Product }>(`/products/${current.id}`, { method: "PATCH", body: fd });
        saved = d.product;
        if (addedColor) {
          const merged = [...(saved.colors ?? []), addedColor].sort(
            (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id,
          );
          saved = { ...saved, colors: merged };
        }
        setFiles([]);
        notify(addedColor ? "Produit et photos enregistrés" : "Produit mis à jour");
      } else {
        const d = await apiAdmin<{ product: Product }>("/products", { method: "POST", body: fd });
        saved = d.product;

        if (files.length > 0 || colorName.trim()) {
          const colorFd = new FormData();
          colorFd.append("name", colorName.trim() || "Standard");
          colorFd.append("hex", colorHex);
          files.forEach((f) => colorFd.append("images[]", f));
          const cd = await apiAdmin<{ color: ProductColor }>(
            `/products/${saved.id}/colors`,
            { method: "POST", body: colorFd }
          );
          let color = cd.color;
          for (const sizeName of selectedSizes) {
            const sd = await apiAdmin<{ color: ProductColor }>(
              `/products/${saved.id}/colors/${color.id}/sizes`,
              { method: "POST", body: JSON.stringify({ size: sizeName, stock: Number(form.stock) || 0 }) }
            );
            color = sd.color;
          }
          saved = { ...saved, colors: [color] };
        }

        setFiles([]);
        notify("Produit créé");
      }

      setCurrent(saved);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onSaved();
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={current ? "Modifier le produit" : "Nouveau produit"} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="input-label">Nom du produit *</label>
            <input className="input" value={form.name} onChange={(e) => onNameChange(e.target.value)} required />
          </div>

          <div>
            <label className="input-label">Slug (URL) *</label>
            <input
              className="input font-mono text-sm"
              value={form.slug}
              onChange={(e) => { set("slug", slugify(e.target.value)); setSlugTouched(true); }}
              required
            />
          </div>
          <div>
            <label className="input-label">Référence</label>
            <input className="input" value={form.reference} onChange={(e) => set("reference", e.target.value)} />
          </div>

          <div>
            <label className="input-label">Prix (TND) *</label>
            <input type="number" step="0.001" min="0" className="input" value={form.price} onChange={(e) => set("price", e.target.value)} required />
          </div>
          <div>
            <label className="input-label">Prix promo (TND)</label>
            <input type="number" step="0.001" min="0" className="input" value={form.promo_price} onChange={(e) => set("promo_price", e.target.value)} />
          </div>

          <div>
            <label className="input-label">Stock *</label>
            <input type="number" min="0" className="input" value={form.stock} onChange={(e) => set("stock", e.target.value)} required />
          </div>
          <div>
            <label className="input-label">Tranche d'âge</label>
            <input className="input" placeholder="Ex: 2-4 ans" value={form.age_group} onChange={(e) => set("age_group", e.target.value)} />
          </div>

          <div>
            <label className="input-label">Catégorie principale</label>
            <select
              className="input"
              value={parentCategoryId}
              onChange={(e) => {
                setParentCategoryId(e.target.value);
                setSubCategoryId("");
              }}
            >
              <option value="">— Aucune —</option>
              {categoryTree.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Sous-catégorie</label>
            <select
              className="input"
              value={subCategoryId}
              onChange={(e) => setSubCategoryId(e.target.value)}
              disabled={!parentCategoryId || !needsSubcategory}
            >
              {!parentCategoryId ? (
                <option value="">Choisir une catégorie d&apos;abord</option>
              ) : !needsSubcategory ? (
                <option value="">— Non requise —</option>
              ) : (
                <>
                  <option value="">— Choisir —</option>
                  {subcategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </>
              )}
            </select>
            {needsSubcategory && parentCategoryId && (
              <p className="text-xs text-slate-500 mt-1">Obligatoire pour cette catégorie.</p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="input-label">Description</label>
            <textarea className="input resize-none" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>

          {/* New product: color + images + sizes in one step */}
          {!current && (
            <div className="sm:col-span-2 rounded-2xl border border-brand-200 bg-brand-50/40 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Palette size={16} className="text-brand-500" />
                <h3 className="font-bold text-slate-800 text-sm">Couleur, photos &amp; tailles</h3>
              </div>
              <p className="text-xs text-slate-500">
                Les photos sont liées à une couleur. La première photo apparaît sur l&apos;accueil et le catalogue.
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="input-label">Nom de la couleur *</label>
                  <input
                    className="input"
                    placeholder="Ex: Bleu marine"
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    required={files.length > 0}
                  />
                </div>
                <div>
                  <label className="input-label">Teinte</label>
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-200 cursor-pointer bg-white p-1"
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Photos du produit</label>
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-6 cursor-pointer hover:border-brand-400 hover:bg-white transition-colors bg-white/80">
                  <ImagePlus size={24} className="text-slate-400" />
                  <span className="text-sm text-slate-500 font-medium">
                    {files.length > 0 ? `${files.length} photo(s) sélectionnée(s)` : "Cliquez pour ajouter des photos"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  />
                </label>
                <FilePreviewGrid urls={filePreviews} />
              </div>

              {globalSizes.length > 0 && (
                <div>
                  <label className="input-label flex items-center gap-1.5">
                    <Ruler size={14} /> Tailles disponibles pour cette couleur
                  </label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {globalSizes.map((gs) => {
                      const on = selectedSizes.includes(gs.name);
                      return (
                        <button
                          key={gs.id}
                          type="button"
                          onClick={() =>
                            setSelectedSizes((prev) =>
                              on ? prev.filter((n) => n !== gs.name) : [...prev, gs.name]
                            )
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                            on
                              ? "border-brand-500 bg-brand-100 text-brand-700"
                              : "border-dashed border-slate-200 text-slate-600 hover:border-brand-300"
                          }`}
                        >
                          {gs.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Stock initial = stock général du produit ({form.stock || 0} par taille).
                  </p>
                </div>
              )}

              {globalSizes.length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  Créez vos tailles dans <a href="/admin/attributs" className="font-bold underline">Attributs</a> pour les sélectionner ici.
                </p>
              )}
            </div>
          )}

          {/* Edit: manage colors below */}
          {current && (
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={16} className="text-brand-500" />
                <h3 className="font-bold text-slate-800 text-sm">Couleurs, photos &amp; tailles</h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Ajoutez ou modifiez les couleurs ci-dessous. Chaque couleur a ses photos et ses tailles en stock.
              </p>
              <ColorManager
                productId={current.id}
                colors={current.colors ?? []}
                globalSizes={globalSizes}
                onChange={(colors) => setCurrent({ ...current, colors })}
                registerActions={(actions) => { colorActionsRef.current = actions; }}
              />
            </div>
          )}
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-4 pt-2">
          {([
            ["active", "Actif"],
            ["featured", "Coup de cœur"],
            ["on_promo", "En promo"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => set(key, e.target.checked)}
                className="w-4 h-4 rounded accent-brand-500"
              />
              <span className="text-sm font-semibold text-slate-700">{label}</span>
            </label>
          ))}
        </div>

        {error && <p className="alert-error">{error}</p>}

        <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
          <button type="button" onClick={handleClose} className="px-5 py-2.5 rounded-full font-semibold text-sm text-slate-600 hover:bg-slate-100 transition-colors">
            {current ? "Fermer" : "Annuler"}
          </button>
          <button type="submit" disabled={saving} className="btn-primary btn-sm">
            {saving ? "Enregistrement..." : current ? "Enregistrer les modifications" : "Créer le produit"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Color manager (per-color images + per-size stock) ── */
function ColorManager({
  productId,
  colors,
  globalSizes,
  onChange,
  registerActions,
}: {
  productId: number;
  colors: ProductColor[];
  globalSizes: SizeAttr[];
  onChange: (colors: ProductColor[]) => void;
  registerActions?: (actions: {
    hasPendingPhotos: () => boolean;
    submitPending: () => Promise<ProductColor | null>;
  }) => void;
}) {
  const { notify } = useToast();
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#e8b4bc");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const newFilePreviews = useFilePreviews(newFiles);

  const replaceColor = (color: ProductColor) =>
    onChange(colors.map((c) => (c.id === color.id ? color : c)));

  const sortedColors = useMemo(
    () => [...colors].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id),
    [colors]
  );

  const moveColor = async (colorId: number, direction: "up" | "down") => {
    const idx = sortedColors.findIndex((c) => c.id === colorId);
    if (idx < 0) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= sortedColors.length) return;

    const order = sortedColors.map((c) => c.id);
    [order[idx], order[target]] = [order[target], order[idx]];

    setBusy(true);
    try {
      const d = await apiAdmin<{ colors: ProductColor[] }>(
        `/products/${productId}/colors/reorder`,
        { method: "PATCH", body: JSON.stringify({ order }) }
      );
      onChange(d.colors);
      notify("Ordre des couleurs mis à jour");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  };

  const addColor = async (): Promise<ProductColor | null> => {
    if (newFiles.length === 0) { notify("Ajoutez au moins une photo pour cette couleur", "error"); return null; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim() || "Standard");
      fd.append("hex", hex);
      newFiles.forEach((f) => fd.append("images[]", f));
      const d = await apiAdmin<{ color: ProductColor }>(`/products/${productId}/colors`, { method: "POST", body: fd });
      onChange([...colors, d.color].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)));
      setName(""); setHex("#e8b4bc"); setNewFiles([]);
      notify("Couleur ajoutée");
      return d.color;
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
      return null;
    } finally { setBusy(false); }
  };

  useEffect(() => {
    registerActions?.({
      hasPendingPhotos: () => newFiles.length > 0,
      submitPending: () => addColor(),
    });
  });

  const addImages = async (colorId: number, files: File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("images[]", f));
      const d = await apiAdmin<{ color: ProductColor }>(`/products/${productId}/colors/${colorId}`, { method: "PATCH", body: fd });
      replaceColor(d.color);
      notify("Images ajoutées");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally { setBusy(false); }
  };

  const removeImage = async (colorId: number, imageId: number) => {
    setBusy(true);
    try {
      const d = await apiAdmin<{ color: ProductColor }>(`/products/${productId}/colors/${colorId}/images/${imageId}`, { method: "DELETE" });
      replaceColor(d.color);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally { setBusy(false); }
  };

  const deleteColor = async (colorId: number) => {
    setBusy(true);
    try {
      await apiAdmin(`/products/${productId}/colors/${colorId}`, { method: "DELETE" });
      onChange(colors.filter((c) => c.id !== colorId));
      notify("Couleur supprimée");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally { setBusy(false); }
  };

  const addSize = async (colorId: number, size: string) => {
    if (!size.trim()) return;
    setBusy(true);
    try {
      const d = await apiAdmin<{ color: ProductColor }>(
        `/products/${productId}/colors/${colorId}/sizes`,
        { method: "POST", body: JSON.stringify({ size: size.trim(), stock: 0 }) }
      );
      replaceColor(d.color);
      notify("Taille ajoutée");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally { setBusy(false); }
  };

  const updateSizeStock = async (colorId: number, sizeId: number, stock: number) => {
    setBusy(true);
    try {
      const d = await apiAdmin<{ color: ProductColor }>(
        `/products/${productId}/colors/${colorId}/sizes/${sizeId}`,
        { method: "PATCH", body: JSON.stringify({ stock }) }
      );
      replaceColor(d.color);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally { setBusy(false); }
  };

  const deleteSize = async (colorId: number, sizeId: number) => {
    setBusy(true);
    try {
      const d = await apiAdmin<{ color: ProductColor }>(
        `/products/${productId}/colors/${colorId}/sizes/${sizeId}`,
        { method: "DELETE" }
      );
      replaceColor(d.color);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      {globalSizes.length === 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <Ruler size={15} className="flex-shrink-0" />
          <span>
            Aucune taille définie. <a href="/admin/attributs" className="font-bold underline hover:text-amber-900">Créez vos tailles</a> dans la page Attributs avant d'en ajouter ici.
          </span>
        </div>
      )}

      {/* Existing colors — order #1 = image principale catalogue */}
      {sortedColors.map((c, index) => (
        <ColorCard
          key={c.id}
          color={c}
          orderIndex={index}
          orderTotal={sortedColors.length}
          busy={busy}
          globalSizes={globalSizes}
          onMoveUp={() => moveColor(c.id, "up")}
          onMoveDown={() => moveColor(c.id, "down")}
          onDeleteColor={() => deleteColor(c.id)}
          onAddImages={(files) => addImages(c.id, files)}
          onRemoveImage={(imgId) => removeImage(c.id, imgId)}
          onAddSize={(size) => addSize(c.id, size)}
          onUpdateSizeStock={(sizeId, stock) => updateSizeStock(c.id, sizeId, stock)}
          onDeleteSize={(sizeId) => deleteSize(c.id, sizeId)}
        />
      ))}

      {/* Add new color */}
      <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nouvelle couleur</p>
        {newFiles.length > 0 && (
          <p className="text-xs text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 mb-3">
            Photos sélectionnées — cliquez <strong>Ajouter</strong> ou <strong>Enregistrer les modifications</strong> pour les téléverser.
          </p>
        )}
        <div
          className="flex flex-col sm:flex-row gap-3 sm:items-end"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addColor();
            }
          }}
        >
          <div className="flex-1">
            <label className="input-label">Nom</label>
            <input className="input" placeholder="Ex: Rose poudré" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="input-label">Teinte</label>
            <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-11 w-14 rounded-lg border border-slate-200 cursor-pointer bg-white p-1" />
          </div>
          <div>
            <label className="input-label">Images</label>
            <label className="btn-secondary btn-sm cursor-pointer whitespace-nowrap">
              <ImagePlus size={15} />
              {newFiles.length > 0 ? `${newFiles.length} fich.` : "Choisir"}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setNewFiles(Array.from(e.target.files ?? []))} />
            </label>
          </div>
          <button type="button" onClick={() => void addColor()} disabled={busy} className="btn-primary btn-sm whitespace-nowrap">
            <Plus size={15} /> Ajouter
          </button>
        </div>
        <FilePreviewGrid urls={newFilePreviews} />
      </div>
    </div>
  );
}

/* ── Single color card (images + sizes from global attributes) ── */
function ColorCard({
  color, orderIndex, orderTotal, busy, globalSizes,
  onMoveUp, onMoveDown,
  onDeleteColor, onAddImages, onRemoveImage,
  onAddSize, onUpdateSizeStock, onDeleteSize,
}: {
  color: ProductColor;
  orderIndex: number;
  orderTotal: number;
  busy: boolean;
  globalSizes: SizeAttr[];
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDeleteColor: () => void;
  onAddImages: (files: File[]) => void;
  onRemoveImage: (imgId: number) => void;
  onAddSize: (size: string) => void;
  onUpdateSizeStock: (sizeId: number, stock: number) => void;
  onDeleteSize: (sizeId: number) => void;
}) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const addedNames = new Set((color.sizes ?? []).map((s) => s.size));

  // Sizes from global list not yet added to this color
  const availableToAdd = globalSizes.filter((gs) => !addedNames.has(gs.name));

  const draft = (sizeId: number) =>
    drafts[sizeId] ?? String(color.sizes?.find((s) => s.id === sizeId)?.stock ?? 0);
  const setDraft = (sizeId: number, v: string) => setDrafts((d) => ({ ...d, [sizeId]: v }));

  const commitStock = (sizeId: number) => {
    const v = parseInt(draft(sizeId), 10);
    if (!isNaN(v) && v >= 0) onUpdateSizeStock(sizeId, v);
  };

  const totalStock = (color.sizes ?? []).reduce((sum, s) => sum + s.stock, 0);

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Color header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex flex-col gap-0.5 flex-shrink-0">
            <button type="button" onClick={onMoveUp} disabled={busy || orderIndex === 0}
              className="p-0.5 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30"
              aria-label="Monter">
              <ChevronUp size={16} />
            </button>
            <button type="button" onClick={onMoveDown} disabled={busy || orderIndex >= orderTotal - 1}
              className="p-0.5 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-30"
              aria-label="Descendre">
              <ChevronDown size={16} />
            </button>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full flex-shrink-0">
            #{orderIndex + 1}{orderIndex === 0 ? " · Principale" : ""}
          </span>
          <span className="w-6 h-6 rounded-full ring-1 ring-black/10 flex-shrink-0" style={{ backgroundColor: color.hex || "#e5e7eb" }} />
          <span className="font-bold text-slate-800 text-sm truncate">{color.name}</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
            totalStock === 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"
          }`}>
            {totalStock} en stock
          </span>
        </div>
        <button type="button" onClick={onDeleteColor} disabled={busy}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          aria-label="Supprimer la couleur">
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Images */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Images</p>
          <div className="flex gap-2 flex-wrap items-center">
            {color.images.map((img) => (
              <div key={img.id} className="relative">
                <img src={img.url} alt="" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                <button type="button" onClick={() => onRemoveImage(img.id)} disabled={busy}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm hover:bg-red-600 transition-colors"
                  aria-label="Supprimer">
                  <X size={10} />
                </button>
              </div>
            ))}
            <label className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/50 transition-colors">
              <ImagePlus size={16} className="text-slate-400" />
              <input type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { onAddImages(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        {/* Active sizes with stock */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tailles actives</p>

          {(color.sizes ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 italic">Sélectionnez des tailles ci-dessous.</p>
          ) : (
            <div className="space-y-2">
              {(color.sizes ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2">
                  <span className="font-bold text-slate-800 text-sm min-w-[4rem]">{s.size}</span>
                  <div className="flex items-center border border-slate-200 rounded-full overflow-hidden">
                    <button type="button"
                      onClick={() => { const v = Math.max(0, parseInt(draft(s.id), 10) - 1); setDraft(s.id, String(v)); onUpdateSizeStock(s.id, v); }}
                      className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                      <Minus size={11} />
                    </button>
                    <input
                      type="number" min="0"
                      value={draft(s.id)}
                      onChange={(e) => setDraft(s.id, e.target.value)}
                      onBlur={() => commitStock(s.id)}
                      onKeyDown={(e) => e.key === "Enter" && commitStock(s.id)}
                      className="w-12 text-center text-sm font-bold text-slate-900 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button type="button"
                      onClick={() => { const v = parseInt(draft(s.id), 10) + 1; setDraft(s.id, String(v)); onUpdateSizeStock(s.id, v); }}
                      className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                      <Plus size={11} />
                    </button>
                  </div>
                  <span className="text-xs text-slate-400">en stock</span>
                  <button type="button" onClick={() => onDeleteSize(s.id)} disabled={busy}
                    className="ml-auto p-1 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                    aria-label="Retirer cette taille">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available sizes to add (chips from global attributes) */}
        {availableToAdd.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Ajouter une taille
            </p>
            <div className="flex flex-wrap gap-1.5">
              {availableToAdd.map((gs) => (
                <button
                  key={gs.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onAddSize(gs.name)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold border-2 border-dashed border-brand-200 text-brand-600 hover:bg-brand-50 hover:border-brand-400 disabled:opacity-40 transition-all"
                >
                  <Plus size={11} className="inline mr-1" />
                  {gs.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {globalSizes.length === 0 && (
          <p className="text-xs text-amber-600 font-medium">
            Aucune taille globale. Allez dans <strong>Attributs</strong> pour en créer.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Page ── */
export function AdminProducts() {
  const { notify } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryTree, setCategoryTree] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "promo" | "low">("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiAdmin<{ products: Product[] }>("/products")
      .then((d) => { setProducts(d.products); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    apiAdmin<{ categories: AdminCategory[] }>("/categories").then((d) => setCategoryTree(d.categories)).catch(() => {});
  }, [load]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (search && !`${p.name} ${p.reference ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "active") return p.active;
      if (filter === "inactive") return !p.active;
      if (filter === "promo") return p.on_promo;
      if (filter === "low") return p.stock < 5;
      return true;
    });
  }, [products, search, filter]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await apiAdmin(`/products/${toDelete.id}`, { method: "DELETE" });
      notify("Produit supprimé");
      load();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Suppression impossible", "error");
    } finally {
      setToDelete(null);
    }
  };

  const toggleActive = async (p: Product) => {
    try {
      const fd = new FormData();
      fd.append("active", String(!p.active));
      const d = await apiAdmin<{ product: Product }>(`/products/${p.id}`, { method: "PATCH", body: fd });
      setProducts((list) => list.map((x) => (x.id === p.id ? d.product : x)));
      notify(p.active ? "Produit désactivé" : "Produit activé");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    }
  };

  const catName = (id?: number) => {
    if (!id) return undefined;
    const { parentId, subId } = resolveAdminCategoryIds(categoryTree, id);
    const root = categoryTree.find((r) => String(r.id) === parentId);
    if (!root) return undefined;
    if (subId) {
      const sub = root.children?.find((c) => String(c.id) === subId);
      return sub ? `${root.name} › ${sub.name}` : root.name;
    }
    return root.name;
  };

  const FILTERS = [
    { key: "all", label: "Tous" },
    { key: "active", label: "Actifs" },
    { key: "inactive", label: "Inactifs" },
    { key: "promo", label: "En promo" },
    { key: "low", label: "Stock bas" },
  ] as const;

  return (
    <AdminPage
      title="Produits"
      subtitle={`${products.length} produit${products.length > 1 ? "s" : ""} au catalogue`}
      actions={
        <button type="button" onClick={() => { setEditing(null); setFormOpen(true); }} className="btn-primary btn-sm">
          <Plus size={16} /> Nouveau produit
        </button>
      }
    >
      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10"
            placeholder="Rechercher par nom ou référence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`chip ${filter === f.key ? "chip-active" : ""}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Package size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="font-semibold text-slate-500">Aucun produit trouvé.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-bold px-4 py-3">Produit</th>
                  <th className="text-left font-bold px-4 py-3 hidden md:table-cell">Catégorie</th>
                  <th className="text-left font-bold px-4 py-3">Prix</th>
                  <th className="text-left font-bold px-4 py-3">Stock</th>
                  <th className="text-left font-bold px-4 py-3 hidden sm:table-cell">Statut</th>
                  <th className="text-right font-bold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {(p.image_urls[0] || p.colors?.find((c) => c.images.length > 0)?.images[0]?.url) ? (
                            <img
                              src={p.image_urls[0] || p.colors?.find((c) => c.images.length > 0)?.images[0]?.url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package size={18} className="text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate max-w-[200px]">{p.name}</p>
                          {p.reference && <p className="text-xs text-slate-400">{p.reference}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{catName(p.category_id) ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.on_promo && p.promo_price ? (
                        <div>
                          <span className="font-bold text-brand-600">{Number(p.promo_price).toFixed(3)}</span>
                          <span className="text-xs text-slate-400 line-through ml-1">{Number(p.price).toFixed(3)}</span>
                        </div>
                      ) : (
                        <span className="font-bold text-slate-900">{Number(p.price).toFixed(3)} TND</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${p.stock === 0 ? "text-red-500" : p.stock < 5 ? "text-amber-500" : "text-slate-700"}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => toggleActive(p)}
                          className={`text-xs font-bold px-2 py-0.5 rounded-full transition-colors hover:opacity-80 ${p.active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-200 text-slate-500 hover:bg-slate-300"}`}
                          title={p.active ? "Cliquer pour désactiver" : "Cliquer pour activer"}
                        >
                          {p.active ? "Actif" : "Inactif"}
                        </button>
                        {p.featured && <Star size={14} className="text-amber-400 fill-amber-400" />}
                        {p.on_promo && <TagIcon size={14} className="text-brand-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditing(p); setFormOpen(true); }}
                          className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          aria-label="Modifier"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setToDelete(p)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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

      <ProductForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        product={editing}
        categoryTree={categoryTree}
        onSaved={load}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer ce produit ?"
        message={`« ${toDelete?.name} » sera définitivement supprimé. Cette action est irréversible.`}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </AdminPage>
  );
}
