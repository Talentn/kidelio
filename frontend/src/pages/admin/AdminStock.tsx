import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, Minus, Plus, Check, Boxes, AlertTriangle,
  XCircle, PackageCheck, ChevronDown, ChevronUp,
} from "lucide-react";
import { apiAdmin } from "../../lib/api";
import { AdminPage, Card, useToast } from "../../components/admin/ui";

const LOW = 5;

/* ── types ──────────────────────────────────────────────────────────── */
type SizeRow = { id: number; size: string; stock: number };
type Color   = { id: number; name: string; hex?: string; sizes: SizeRow[] };
type Product = {
  id: number; name: string; reference?: string;
  stock: number; active: boolean; image_urls: string[];
  colors?: Color[];
};

/* ── helpers ─────────────────────────────────────────────────────────── */
function stockBadge(n: number) {
  if (n === 0)   return { label: "Rupture",  cls: "bg-red-100 text-red-600" };
  if (n  < LOW)  return { label: "Stock bas", cls: "bg-amber-100 text-amber-600" };
  return           { label: "En stock",   cls: "bg-emerald-100 text-emerald-700" };
}

function productEffectiveStock(p: Product) {
  const hasVariants = p.colors?.some((c) => c.sizes.length > 0);
  if (!hasVariants) return p.stock;
  return p.colors!.flatMap((c) => c.sizes).reduce((s, sz) => s + sz.stock, 0);
}

/* ── Inline editable stock counter ──────────────────────────────────── */
function StockCounter({
  value: initial,
  onSave,
}: {
  value: number;
  onSave: (v: number) => Promise<void>;
}) {
  const { notify }          = useToast();
  const [val, setVal]       = useState(initial);
  const [saving, setSaving] = useState(false);
  const [ok, setOk]         = useState(false);

  useEffect(() => setVal(initial), [initial]);

  const dirty = val !== initial;

  const commit = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await onSave(val);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
      setVal(initial);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex items-center border-2 rounded-full overflow-hidden transition-colors ${dirty ? "border-brand-400" : "border-slate-200"}`}>
        <button
          type="button"
          onClick={() => setVal((v) => Math.max(0, v - 1))}
          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <Minus size={11} />
        </button>
        <input
          type="number"
          min={0}
          value={val}
          onChange={(e) => setVal(Math.max(0, Number(e.target.value)))}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          className="w-11 text-center text-sm font-bold text-slate-900 outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => setVal((v) => v + 1)}
          className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <Plus size={11} />
        </button>
      </div>

      {/* Save indicator */}
      <button
        type="button"
        onClick={commit}
        disabled={!dirty || saving}
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          ok      ? "bg-emerald-500 text-white scale-110" :
          dirty   ? "bg-brand-500 text-white hover:bg-brand-700 cursor-pointer" :
                    "bg-slate-100 text-slate-300 cursor-default"
        }`}
        aria-label="Enregistrer"
      >
        {saving
          ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
          : <Check size={11} />}
      </button>
    </div>
  );
}

/* ── Color+size block inside a product card ──────────────────────────── */
function ColorSizeBlock({
  color,
  productId,
  onVariantChange,
}: {
  color: Color;
  productId: number;
  onVariantChange: (colorId: number, sizeId: number, stock: number) => void;
}) {
  const saveSize = async (sizeId: number, stock: number) => {
    await apiAdmin(
      `/products/${productId}/colors/${color.id}/sizes/${sizeId}`,
      { method: "PATCH", body: JSON.stringify({ stock }) }
    );
    onVariantChange(color.id, sizeId, stock);
  };

  return (
    <div className="space-y-2">
      {/* Color header */}
      <div className="flex items-center gap-2">
        <span
          className="w-4 h-4 rounded-full ring-1 ring-black/10 flex-shrink-0"
          style={{ backgroundColor: color.hex || "#e5e7eb" }}
        />
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{color.name}</span>
        <span className="text-xs text-slate-400">
          ({color.sizes.reduce((s, sz) => s + sz.stock, 0)} en stock)
        </span>
      </div>

      {/* Size rows */}
      {color.sizes.length === 0 ? (
        <p className="text-xs text-slate-400 italic ml-6">Aucune taille définie</p>
      ) : (
        <div className="ml-6 space-y-1.5">
          {color.sizes.map((sz) => {
            const { label, cls } = stockBadge(sz.stock);
            return (
              <div
                key={sz.id}
                className={`flex items-center justify-between gap-4 px-3 py-2 rounded-xl border ${
                  sz.stock === 0 ? "border-red-100 bg-red-50/50" :
                  sz.stock < LOW ? "border-amber-100 bg-amber-50/30" :
                                   "border-slate-100 bg-white"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-bold text-slate-800 text-sm w-20 truncate">{sz.size}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
                </div>
                <StockCounter
                  value={sz.stock}
                  onSave={(v) => saveSize(sz.id, v)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Product card (collapsed / expanded) ─────────────────────────────── */
function ProductCard({
  product,
  onProductStockChange,
  onVariantStockChange,
}: {
  product: Product;
  onProductStockChange: (id: number, stock: number) => void;
  onVariantStockChange: (productId: number, colorId: number, sizeId: number, stock: number) => void;
}) {
  const { notify }      = useToast();
  const hasColors       = (product.colors?.length ?? 0) > 0;
  const hasVariants     = hasColors && product.colors!.some((c) => c.sizes.length > 0);
  const [open, setOpen] = useState(true);

  const totalStock      = productEffectiveStock(product);
  const { label, cls }  = stockBadge(totalStock);

  const saveProductStock = async (v: number) => {
    const fd = new FormData();
    fd.append("stock", String(v));
    await apiAdmin(`/products/${product.id}`, { method: "PATCH", body: fd });
    onProductStockChange(product.id, v);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Product header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        {/* Thumbnail */}
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
          {product.image_urls[0]
            ? <img src={product.image_urls[0]} alt="" className="w-full h-full object-cover" />
            : <Boxes size={16} className="text-slate-300" />}
        </div>

        {/* Name + badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-slate-900 text-sm truncate max-w-[200px]">{product.name}</p>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
            {hasVariants && (
              <span className="text-[11px] text-slate-400 font-medium">
                {product.colors!.reduce((s, c) => s + c.sizes.length, 0)} taille(s)
              </span>
            )}
          </div>
          {product.reference && <p className="text-xs text-slate-400 mt-0.5">{product.reference}</p>}
        </div>

        {/* Stock total or flat counter */}
        {hasVariants ? (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-lg font-bold ${totalStock === 0 ? "text-red-500" : totalStock < LOW ? "text-amber-500" : "text-slate-800"}`}>
              {totalStock}
            </span>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 transition-colors"
              aria-label={open ? "Réduire" : "Développer"}
            >
              {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        ) : (
          <div className="flex-shrink-0">
            <StockCounter value={product.stock} onSave={saveProductStock} />
          </div>
        )}
      </div>

      {/* Color → Size breakdown */}
      {hasVariants && open && (
        <div className="px-4 py-4 space-y-5">
          {product.colors!.map((color) => (
            <ColorSizeBlock
              key={color.id}
              color={color}
              productId={product.id}
              onVariantChange={(colorId, sizeId, stock) =>
                onVariantStockChange(product.id, colorId, sizeId, stock)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export function AdminStock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<"all" | "out" | "low" | "in">("all");

  const load = useCallback(() => {
    setLoading(true);
    apiAdmin<{ products: Product[] }>("/products")
      .then((d) => { setProducts(d.products); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const onProductStockChange = (id: number, stock: number) =>
    setProducts((ps) => ps.map((p) => p.id === id ? { ...p, stock } : p));

  const onVariantStockChange = (productId: number, colorId: number, sizeId: number, stock: number) =>
    setProducts((ps) =>
      ps.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          colors: p.colors?.map((c) =>
            c.id !== colorId ? c : {
              ...c,
              sizes: c.sizes.map((sz) => sz.id === sizeId ? { ...sz, stock } : sz),
            }
          ),
        };
      })
    );

  const withTotal = useMemo(
    () => products.map((p) => ({ ...p, _total: productEffectiveStock(p) })),
    [products]
  );

  const counts = useMemo(() => ({
    out: withTotal.filter((p) => p._total === 0).length,
    low: withTotal.filter((p) => p._total > 0 && p._total < LOW).length,
    in:  withTotal.filter((p) => p._total >= LOW).length,
  }), [withTotal]);

  const filtered = useMemo(() =>
    withTotal.filter((p) => {
      if (search && !`${p.name} ${p.reference ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === "out") return p._total === 0;
      if (filter === "low") return p._total > 0 && p._total < LOW;
      if (filter === "in")  return p._total >= LOW;
      return true;
    }),
    [withTotal, search, filter]
  );

  const STATS = [
    { label: "Rupture",   value: counts.out, icon: XCircle,      color: "text-red-500",     bg: "bg-red-50",     ring: "ring-red-200" },
    { label: "Stock bas", value: counts.low, icon: AlertTriangle, color: "text-amber-500",   bg: "bg-amber-50",   ring: "ring-amber-200" },
    { label: "En stock",  value: counts.in,  icon: PackageCheck,  color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
  ];

  return (
    <AdminPage
      title="Gestion du stock"
      subtitle="Stock par produit · par couleur · par taille"
    >
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {STATS.map(({ label, value, icon: Icon, color, bg, ring }) => (
          <div key={label} className={`${bg} ring-1 ${ring} rounded-2xl p-4 flex items-center gap-3`}>
            <Icon size={22} strokeWidth={1.8} className={color} />
            <div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs font-semibold text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Rechercher un produit…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {([
            { key: "all", label: `Tous (${products.length})` },
            { key: "out", label: `Rupture (${counts.out})` },
            { key: "low", label: `Stock bas (${counts.low})` },
            { key: "in",  label: `En stock (${counts.in})` },
          ] as const).map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)}
              className={`chip whitespace-nowrap ${filter === f.key ? "chip-active" : ""}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
          <Boxes size={40} className="text-slate-200 mx-auto mb-3" />
          <p className="font-semibold text-slate-400">Aucun produit trouvé.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onProductStockChange={onProductStockChange}
              onVariantStockChange={onVariantStockChange}
            />
          ))}
        </div>
      )}
    </AdminPage>
  );
}
