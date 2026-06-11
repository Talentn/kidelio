import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Banknote,
  Clock,
  AlertTriangle,
  Package,
  Mail,
  Plus,
  Tags,
  Boxes,
  ArrowRight,
  Star,
} from "lucide-react";
import { apiAdmin } from "../../lib/api";
import { useLivePoll } from "../../hooks/useLivePoll";
import { AdminPage, Card } from "../../components/admin/ui";

type Stats = {
  orders_today: number;
  revenue_today: number;
  pending_orders: number;
  low_stock_products: number;
  total_products: number;
  unread_messages: number;
  total_reviews: number;
  average_rating: number;
  reviews_today: number;
};

function StatCard({
  label,
  value,
  icon,
  accent,
  to,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  to?: string;
}) {
  const inner = (
    <Card className="p-5 hover:shadow-md transition-shadow h-full">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-sm font-semibold">{label}</p>
          <p className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    apiAdmin<Stats>("/dashboard/stats")
      .then((d) => setStats(d))
      .finally(() => { if (!silent) setLoading(false); });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useLivePoll(() => refresh(true), [refresh], { interval: 5_000 });

  return (
    <AdminPage title="Tableau de bord" subtitle="Vue d'ensemble de votre boutique">
      {/* Alerts */}
      {stats && (stats.pending_orders > 0 || stats.low_stock_products > 0 || stats.unread_messages > 0) && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {stats.pending_orders > 0 && (
            <Link to="/admin/commandes" className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors">
              <Clock size={18} className="text-amber-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-amber-800">
                {stats.pending_orders} commande{stats.pending_orders > 1 ? "s" : ""} en attente
              </span>
            </Link>
          )}
          {stats.low_stock_products > 0 && (
            <Link to="/admin/stock" className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 hover:bg-red-100 transition-colors">
              <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-red-800">
                {stats.low_stock_products} produit{stats.low_stock_products > 1 ? "s" : ""} en stock bas
              </span>
            </Link>
          )}
          {stats.unread_messages > 0 && (
            <Link to="/admin/messages" className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 hover:bg-blue-100 transition-colors">
              <Mail size={18} className="text-blue-600 flex-shrink-0" />
              <span className="text-sm font-semibold text-blue-800">
                {stats.unread_messages} message{stats.unread_messages > 1 ? "s" : ""} non lu{stats.unread_messages > 1 ? "s" : ""}
              </span>
            </Link>
          )}
        </div>
      )}

      {/* Stat grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Commandes aujourd'hui"
            value={stats.orders_today}
            icon={<ShoppingCart size={20} className="text-white" />}
            accent="bg-brand-500"
            to="/admin/commandes"
          />
          <StatCard
            label="CA aujourd'hui"
            value={`${Number(stats.revenue_today).toFixed(3)} TND`}
            icon={<Banknote size={20} className="text-white" />}
            accent="bg-emerald-500"
          />
          <StatCard
            label="En attente"
            value={stats.pending_orders}
            icon={<Clock size={20} className="text-white" />}
            accent="bg-amber-500"
            to="/admin/commandes"
          />
          <StatCard
            label="Stock bas"
            value={stats.low_stock_products}
            icon={<AlertTriangle size={20} className="text-white" />}
            accent="bg-red-500"
            to="/admin/stock"
          />
          <StatCard
            label="Total produits"
            value={stats.total_products}
            icon={<Package size={20} className="text-white" />}
            accent="bg-indigo-500"
            to="/admin/produits"
          />
          <StatCard
            label="Messages"
            value={stats.unread_messages}
            icon={<Mail size={20} className="text-white" />}
            accent="bg-sky-500"
          />
          <StatCard
            label="Avis aujourd'hui"
            value={stats.reviews_today}
            icon={<Star size={20} className="text-white" />}
            accent="bg-amber-500"
            to="/admin/statistiques"
          />
          <StatCard
            label="Note moyenne"
            value={stats.average_rating > 0 ? `${stats.average_rating}/5` : "—"}
            icon={<Star size={20} className="text-white" />}
            accent="bg-yellow-500"
            to="/admin/statistiques"
          />
          <StatCard
            label="Total avis"
            value={stats.total_reviews}
            icon={<Star size={20} className="text-white" />}
            accent="bg-orange-500"
            to="/admin/statistiques"
          />
        </div>
      ) : (
        <Card className="p-8 text-center text-slate-500">Impossible de charger les statistiques.</Card>
      )}

      {/* Quick actions */}
      <h2 className="font-bold text-slate-900 text-lg mt-8 mb-4">Actions rapides</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { to: "/admin/produits", label: "Nouveau produit", icon: <Plus size={18} />, color: "text-brand-600 bg-brand-50" },
          { to: "/admin/statistiques", label: "Statistiques", icon: <Banknote size={18} />, color: "text-violet-600 bg-violet-50" },
          { to: "/admin/stock", label: "Gérer le stock", icon: <Boxes size={18} />, color: "text-emerald-600 bg-emerald-50" },
          { to: "/admin/categories", label: "Catégories", icon: <Tags size={18} />, color: "text-indigo-600 bg-indigo-50" },
          { to: "/", label: "Voir la boutique", icon: <ArrowRight size={18} />, color: "text-slate-600 bg-slate-100" },
        ].map((a) => (
          <Link
            key={a.label}
            to={a.to}
            className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-4 hover:shadow-md transition-shadow font-semibold text-slate-700 text-sm"
          >
            <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${a.color}`}>{a.icon}</span>
            {a.label}
          </Link>
        ))}
      </div>
    </AdminPage>
  );
}
