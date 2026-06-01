import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Ruler, GripVertical, Check, X } from "lucide-react";
import { apiAdmin } from "../../lib/api";
import { AdminPage, Card, ConfirmDialog, useToast } from "../../components/admin/ui";

export type SizeAttr = { id: number; name: string; position: number };

/* ── Inline-editable row ─────────────────────────────────────────────── */
function SizeRow({
  size,
  onSaved,
  onDelete,
}: {
  size: SizeAttr;
  onSaved: (s: SizeAttr) => void;
  onDelete: (id: number) => void;
}) {
  const { notify }          = useToast();
  const [editing, setEdit]  = useState(false);
  const [name, setName]     = useState(size.name);
  const [pos, setPos]       = useState(String(size.position));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const d = await apiAdmin<{ size: SizeAttr }>(`/size-attributes/${size.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), position: Number(pos) || 0 }),
      });
      onSaved(d.size);
      setEdit(false);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally { setSaving(false); }
  };

  const cancel = () => { setName(size.name); setPos(String(size.position)); setEdit(false); };

  return (
    <div className="flex items-center gap-3 px-4 py-3 group hover:bg-slate-50 transition-colors rounded-xl">
      <GripVertical size={14} className="text-slate-300 flex-shrink-0 cursor-grab" />

      {editing ? (
        <>
          <input
            autoFocus
            className="input py-1.5 text-sm flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          />
          <input
            type="number"
            className="input py-1.5 text-sm w-20"
            placeholder="Ordre"
            value={pos}
            onChange={(e) => setPos(e.target.value)}
          />
          <button type="button" onClick={save} disabled={saving} className="p-2 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 transition-colors" aria-label="Valider">
            <Check size={14} />
          </button>
          <button type="button" onClick={cancel} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors" aria-label="Annuler">
            <X size={14} />
          </button>
        </>
      ) : (
        <>
          <div className="flex-1 flex items-center gap-3">
            <span className="font-bold text-slate-800 text-sm">{size.name}</span>
            <span className="text-xs text-slate-400 font-medium">ordre {size.position}</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => setEdit(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" aria-label="Modifier">
              <Pencil size={14} />
            </button>
            <button type="button" onClick={() => onDelete(size.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" aria-label="Supprimer">
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export function AdminAttributes() {
  const { notify }           = useToast();
  const [sizes, setSizes]    = useState<SizeAttr[]>([]);
  const [loading, setLoad]   = useState(true);
  const [newName, setNewName]= useState("");
  const [adding, setAdding]  = useState(false);
  const [toDelete, setDel]   = useState<SizeAttr | null>(null);

  const load = useCallback(() => {
    setLoad(true);
    apiAdmin<{ sizes: SizeAttr[] }>("/size-attributes")
      .then((d) => { setSizes(d.sizes); setLoad(false); })
      .catch(() => setLoad(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addSize = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const position = sizes.length > 0 ? Math.max(...sizes.map((s) => s.position)) + 10 : 0;
      const d = await apiAdmin<{ size: SizeAttr }>("/size-attributes", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), position }),
      });
      setSizes((ss) => [...ss, d.size]);
      setNewName("");
      notify("Taille ajoutée");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally { setAdding(false); }
  };

  const onSaved = (updated: SizeAttr) =>
    setSizes((ss) => ss.map((s) => s.id === updated.id ? updated : s).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)));

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await apiAdmin(`/size-attributes/${toDelete.id}`, { method: "DELETE" });
      setSizes((ss) => ss.filter((s) => s.id !== toDelete.id));
      notify("Taille supprimée");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Impossible de supprimer", "error");
    } finally { setDel(null); }
  };

  /* Common size presets to quickly populate */
  const PRESETS = [
    { group: "Bébé",   sizes: ["Naissance", "1M", "3M", "6M", "9M", "12M", "18M", "24M"] },
    { group: "Enfant", sizes: ["2-3 ans", "3-4 ans", "4-5 ans", "5-6 ans", "6-7 ans", "7-8 ans", "8-9 ans", "9-10 ans", "10-11 ans", "11-12 ans"] },
    { group: "Standard", sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
  ];

  const existingNames = new Set(sizes.map((s) => s.name.toLowerCase()));

  const addPreset = async (name: string) => {
    if (existingNames.has(name.toLowerCase())) return;
    const position = sizes.length > 0 ? Math.max(...sizes.map((s) => s.position)) + 10 : 0;
    try {
      const d = await apiAdmin<{ size: SizeAttr }>("/size-attributes", {
        method: "POST",
        body: JSON.stringify({ name, position }),
      });
      setSizes((ss) => [...ss, d.size]);
    } catch { /* silent */ }
  };

  return (
    <AdminPage
      title="Attributs — Tailles"
      subtitle="Définissez les tailles disponibles dans votre catalogue"
    >
      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left: size list ── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            {loading ? (
              <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}</div>
            ) : sizes.length === 0 ? (
              <div className="py-14 text-center">
                <Ruler size={36} className="text-slate-200 mx-auto mb-3" />
                <p className="font-semibold text-slate-400 mb-1">Aucune taille définie</p>
                <p className="text-sm text-slate-400">Utilisez les raccourcis à droite pour commencer rapidement.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sizes.map((s) => (
                  <SizeRow key={s.id} size={s} onSaved={onSaved} onDelete={setDel} />
                ))}
              </div>
            )}

            {/* Add form */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
              <div className="flex gap-2">
                <input
                  className="input py-2 text-sm flex-1"
                  placeholder="Nouvelle taille (ex: XL, 3-4 ans, 36…)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSize()}
                />
                <button
                  type="button"
                  onClick={addSize}
                  disabled={adding || !newName.trim()}
                  className="btn-primary btn-sm whitespace-nowrap"
                >
                  <Plus size={15} /> Ajouter
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Right: presets ── */}
        <div className="space-y-4">
          <Card className="p-4">
            <p className="font-bold text-slate-800 text-sm mb-3">Raccourcis</p>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Cliquez sur une taille pour l'ajouter rapidement. Les tailles déjà présentes sont grisées.
            </p>
            <div className="space-y-4">
              {PRESETS.map(({ group, sizes: ps }) => (
                <div key={group}>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">{group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ps.map((name) => {
                      const exists = existingNames.has(name.toLowerCase());
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => addPreset(name)}
                          disabled={exists}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                            exists
                              ? "border-slate-100 bg-slate-50 text-slate-300 cursor-default line-through"
                              : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 hover:border-brand-300 cursor-pointer"
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-amber-50 border-amber-200">
            <p className="text-xs font-bold text-amber-700 mb-1">Conseil</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              L'ordre d'affichage est contrôlé par le champ <strong>Ordre</strong>. Les tailles avec un ordre plus petit apparaissent en premier dans les sélecteurs.
            </p>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="Supprimer cette taille ?"
        message={`« ${toDelete?.name} » sera retirée de la liste. Les variantes produit existantes avec cette taille ne seront pas supprimées.`}
        onConfirm={confirmDelete}
        onCancel={() => setDel(null)}
      />
    </AdminPage>
  );
}
