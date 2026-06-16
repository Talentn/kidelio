import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Star, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { apiAdmin } from "../../lib/api";
import { AdminPage, Card, useToast } from "../../components/admin/ui";

type Review = {
  id: number;
  stars: number;
  created_at: string;
  product: { id: number; name: string; slug: string };
  user?: { id: number; name: string; email: string };
  guest_ip?: string | null;
};

function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} fill={n <= value ? "currentColor" : "none"} strokeWidth={n <= value ? 0 : 1.5} />
      ))}
    </span>
  );
}

export function AdminReviews() {
  const { notify } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiAdmin<{ reviews: Review[] }>("/reviews")
      .then((d) => setReviews(d.reviews))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (review: Review) => {
    const who = review.user?.name ?? review.user?.email ?? review.guest_ip ?? "visiteur";
    if (!window.confirm(`Supprimer l'avis ${review.stars}/5 de « ${review.product.name} » (${who}) ?`)) return;

    setDeletingId(review.id);
    try {
      await apiAdmin(`/reviews/${review.id}`, { method: "DELETE" });
      setReviews((prev) => prev.filter((r) => r.id !== review.id));
      notify("Avis supprimé — stats et notes produit mises à jour");
    } catch (err: unknown) {
      notify(err instanceof Error ? err.message : "Erreur", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reviews;
    return reviews.filter((r) =>
      `${r.product.name} ${r.user?.name ?? ""} ${r.user?.email ?? ""} ${r.guest_ip ?? ""}`.toLowerCase().includes(q)
    );
  }, [reviews, search]);

  const average = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length).toFixed(1)
    : "—";

  return (
    <AdminPage
      title="Avis clients"
      subtitle={`${reviews.length} avis · moyenne ${average}/5`}
    >
      <div className="relative max-w-md mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-10"
          placeholder="Rechercher (produit, client)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">{[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Star size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="font-semibold text-slate-500">Aucun avis.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="text-left font-bold px-4 py-3">Produit</th>
                  <th className="text-left font-bold px-4 py-3">Note</th>
                  <th className="text-left font-bold px-4 py-3 hidden md:table-cell">Client</th>
                  <th className="text-left font-bold px-4 py-3 hidden sm:table-cell">Date</th>
                  <th className="text-right font-bold px-4 py-3">Supprimer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/produits/${r.product.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-slate-800 hover:text-brand-600 transition-colors"
                      >
                        {r.product.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StarRow value={r.stars} />
                      <span className="ml-2 text-slate-600 font-semibold">{r.stars}/5</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-600">
                      {r.user ? (
                        <div>
                          <p className="font-semibold text-slate-800">{r.user.name}</p>
                          <p className="text-xs text-slate-400">{r.user.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Invité · {r.guest_ip ?? "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">
                      {new Date(r.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={deletingId === r.id}
                        onClick={() => remove(r)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                        aria-label="Supprimer l'avis"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminPage>
  );
}
