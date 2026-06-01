import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronRight, ImageIcon, Plus, Pencil, Tags, Trash2 } from "lucide-react";
import { apiAdmin, invalidateCache } from "../../lib/api";
import { countAdminCategories, type AdminCategory } from "../../lib/categories";
import { AdminPage, Card, Modal, useToast } from "../../components/admin/ui";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type FormState = {
  name: string;
  slug: string;
  description: string;
  position: string;
  active: boolean;
  parent_id: string;
};

function CategoryForm({
  open,
  onClose,
  category,
  parentId,
  roots,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  category: AdminCategory | null;
  parentId: number | null;
  roots: AdminCategory[];
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: "",
    slug: "",
    description: "",
    position: "0",
    active: true,
    parent_id: "",
  });

  const isSub = Boolean(form.parent_id);
  const hasChildren = (category?.children_count ?? 0) > 0;

  useEffect(() => {
    if (!open) return;
    setError("");
    setImageFile(null);
    setSlugTouched(!!category);
    const pid = category?.parent_id ?? parentId;
    setForm({
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      description: category?.description ?? "",
      position: category?.position != null ? String(category.position) : "0",
      active: category?.active ?? true,
      parent_id: pid != null ? String(pid) : "",
    });
    setPreview(category?.image_url ?? null);
  }, [open, category, parentId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("name", form.name);
      fd.append("slug", form.slug || slugify(form.name));
      fd.append("description", form.description);
      fd.append("position", String(Number(form.position) || 0));
      fd.append("active", form.active ? "true" : "false");
      if (form.parent_id) fd.append("parent_id", form.parent_id);
      if (imageFile) fd.append("image", imageFile);

      if (category) {
        await apiAdmin(`/categories/${category.id}`, { method: "PATCH", body: fd });
        notify("Catégorie mise à jour");
      } else {
        await apiAdmin("/categories", { method: "POST", body: fd });
        notify(isSub ? "Sous-catégorie créée" : "Catégorie créée");
      }
      invalidateCache("/api/v1/categories");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const title = category
    ? "Modifier la catégorie"
    : isSub
      ? "Nouvelle sous-catégorie"
      : "Nouvelle catégorie";

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={submit} className="space-y-4">
        {!category && !parentId && (
          <div>
            <label className="input-label">Type</label>
            <select
              className="input"
              value={form.parent_id}
              onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
            >
              <option value="">Catégorie principale</option>
              {roots.map((r) => (
                <option key={r.id} value={r.id}>
                  Sous-catégorie de « {r.name} »
                </option>
              ))}
            </select>
          </div>
        )}

        {(parentId || category?.parent_id) && (
          <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-3 py-2">
            Catégorie parente :{" "}
            <strong className="text-slate-800">
              {roots.find((r) => r.id === (category?.parent_id ?? parentId))?.name ?? "—"}
            </strong>
          </p>
        )}

        <div>
          <label className="input-label">Nom *</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                name: e.target.value,
                slug: slugTouched ? f.slug : slugify(e.target.value),
              }))
            }
            required
          />
        </div>
        <div>
          <label className="input-label">Slug *</label>
          <input
            className="input font-mono text-sm"
            value={form.slug}
            onChange={(e) => {
              setForm((f) => ({ ...f, slug: slugify(e.target.value) }));
              setSlugTouched(true);
            }}
            required
          />
        </div>
        <div>
          <label className="input-label">Description</label>
          <textarea
            className="input resize-none"
            rows={2}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <label className="input-label">Position</label>
          <input
            type="number"
            className="input"
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
          />
        </div>

        <div>
          <label className="input-label">Image</label>
          <div className="flex items-start gap-3">
            <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
              {preview ? (
                <img src={preview} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <ImageIcon size={24} />
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setImageFile(f);
                setPreview(URL.createObjectURL(f));
              }}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            className="w-4 h-4 rounded accent-brand-500"
          />
          <span className="text-sm font-semibold text-slate-700">Active</span>
        </label>

        {hasChildren && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            Cette catégorie a des sous-catégories : les produits doivent être rattachés aux sous-catégories.
          </p>
        )}

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
            {saving ? "..." : category ? "Mettre à jour" : "Créer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CategoryRow({
  category,
  depth,
  onEdit,
  onAddSub,
  onDelete,
}: {
  category: AdminCategory;
  depth: 0 | 1;
  onEdit: (c: AdminCategory) => void;
  onAddSub: (parentId: number) => void;
  onDelete: (c: AdminCategory) => void;
}) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <div className={`flex items-center gap-2 ${depth === 1 ? "pl-6" : ""}`}>
          {depth === 1 && <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />}
          {category.image_url ? (
            <img src={category.image_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 flex-shrink-0">
              <Tags size={16} />
            </div>
          )}
          <div>
            <p className="font-bold text-slate-900">{category.name}</p>
            {depth === 1 && category.parent_name && (
              <p className="text-[11px] text-slate-400">{category.parent_name}</p>
            )}
            {depth === 0 && (category.children_count ?? 0) > 0 && (
              <p className="text-[11px] text-slate-400">
                {category.children_count} sous-catégorie{(category.children_count ?? 0) > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden sm:table-cell">{category.slug}</td>
      <td className="px-4 py-3 text-slate-600 tabular-nums">{category.products_count ?? 0}</td>
      <td className="px-4 py-3 text-slate-600">{category.position ?? 0}</td>
      <td className="px-4 py-3">
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full ${category.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}
        >
          {category.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {depth === 0 && (
            <button
              type="button"
              onClick={() => onAddSub(category.id)}
              className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
              title="Ajouter une sous-catégorie"
            >
              <Plus size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(category)}
            className="p-2 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            aria-label="Modifier"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(category)}
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            aria-label="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function AdminCategories() {
  const { notify } = useToast();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [parentForNew, setParentForNew] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiAdmin<{ categories: AdminCategory[] }>("/categories")
      .then((d) => {
        setCategories(d.categories);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = (parentId: number | null = null) => {
    setEditing(null);
    setParentForNew(parentId);
    setFormOpen(true);
  };

  const handleDelete = async (c: AdminCategory) => {
    const label = c.parent_id ? `la sous-catégorie « ${c.name} »` : `la catégorie « ${c.name} »`;
    if (!window.confirm(`Supprimer ${label} ?`)) return;
    try {
      await apiAdmin(`/categories/${c.id}`, { method: "DELETE" });
      notify("Catégorie supprimée");
      invalidateCache("/api/v1/categories");
      load();
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Impossible de supprimer", "error");
    }
  };

  const total = countAdminCategories(categories);

  return (
    <AdminPage
      title="Catégories"
      subtitle={`${total} catégorie${total > 1 ? "s" : ""} (principales et sous-catégories)`}
      actions={
        <button type="button" onClick={() => openNew()} className="btn-primary btn-sm">
          <Plus size={16} /> Nouvelle catégorie
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
        ) : categories.length === 0 ? (
          <div className="text-center py-16">
            <Tags size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="font-semibold text-slate-500">Aucune catégorie.</p>
            <p className="text-sm text-slate-400 mt-1">Créez une catégorie principale, puis ajoutez des sous-catégories.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-bold px-4 py-3">Nom</th>
                  <th className="text-left font-bold px-4 py-3 hidden sm:table-cell">Slug</th>
                  <th className="text-left font-bold px-4 py-3">Produits</th>
                  <th className="text-left font-bold px-4 py-3">Position</th>
                  <th className="text-left font-bold px-4 py-3">Statut</th>
                  <th className="text-right font-bold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((root) => (
                  <Fragment key={root.id}>
                    <CategoryRow
                      category={root}
                      depth={0}
                      onEdit={(c) => {
                        setEditing(c);
                        setParentForNew(null);
                        setFormOpen(true);
                      }}
                      onAddSub={openNew}
                      onDelete={handleDelete}
                    />
                    {(root.children ?? []).map((child) => (
                      <CategoryRow
                        key={child.id}
                        category={{ ...child, parent_name: root.name }}
                        depth={1}
                        onEdit={(c) => {
                          setEditing(c);
                          setParentForNew(null);
                          setFormOpen(true);
                        }}
                        onAddSub={openNew}
                        onDelete={handleDelete}
                      />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CategoryForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        category={editing}
        parentId={parentForNew}
        roots={categories}
        onSaved={load}
      />
    </AdminPage>
  );
}
