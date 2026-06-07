import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  Banknote,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  Percent,
  Truck,
  MapPin,
  Tag,
} from "lucide-react";
import { apiAdmin } from "../../lib/api";
import { orderStatusLabel } from "../../lib/orderStatus";
import { AdminPage, Card } from "../../components/admin/ui";

const PERIODS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 jours" },
  { value: "30d", label: "30 jours" },
  { value: "90d", label: "90 jours" },
  { value: "year", label: "Cette année" },
  { value: "all", label: "Tout" },
] as const;

type Period = (typeof PERIODS)[number]["value"];

type Statistics = {
  period: string;
  from: string | null;
  to: string;
  summary: {
    orders_count: number;
    revenue: number;
    average_order_value: number;
    items_sold: number;
    new_customers: number;
    guest_orders: number;
    registered_orders: number;
    discount_given: number;
    shipping_revenue: number;
    cancelled_orders: number;
    refunded_orders: number;
    low_stock_products: number;
    total_products: number;
    unread_messages: number;
  };
  previous_period: {
    orders_count: number;
    revenue: number;
    change_orders_pct: number | null;
    change_revenue_pct: number | null;
  };
  revenue_by_day: { date: string; orders: number; revenue: number }[];
  orders_by_status: { status: string; count: number }[];
  top_products: { product_name: string; quantity: number; revenue: number }[];
  top_governorates: { governorate: string; orders: number; revenue: number }[];
  promo_usage: { orders_with_promo: number; total_discount: number };
};

function formatTND(value: number) {
  return `${value.toFixed(3)} TND`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function ChangeBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
        up ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
      }`}
    >
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {up ? "+" : ""}
      {value}%
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
  change,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent: string;
  change?: number | null;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-slate-500 text-sm font-semibold">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 truncate">{value}</p>
          {change !== undefined && (
            <div className="mt-1.5">
              <ChangeBadge value={change} />
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function BarChart({
  data,
  valueKey,
  labelKey,
  formatValue,
}: {
  data: { date: string; orders: number; revenue: number }[];
  valueKey: "orders" | "revenue";
  labelKey?: string;
  formatValue?: (v: number) => string;
}) {
  const max = useMemo(() => Math.max(...data.map((d) => d[valueKey]), 1), [data, valueKey]);

  if (!data.length) {
    return <p className="text-slate-400 text-sm text-center py-8">Aucune donnée pour cette période.</p>;
  }

  const showEvery = data.length > 14 ? Math.ceil(data.length / 7) : 1;

  return (
    <div className="flex items-end gap-1 h-48 pt-4">
      {data.map((d, i) => {
        const val = d[valueKey];
        const height = Math.max((val / max) * 100, val > 0 ? 4 : 0);
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0 group relative">
            <div
              className="w-full bg-brand-500 rounded-t-md transition-all hover:bg-brand-600 min-h-[2px]"
              style={{ height: `${height}%` }}
              title={`${labelKey ? d.date : formatDate(d.date)}: ${formatValue ? formatValue(val) : val}`}
            />
            {i % showEvery === 0 && (
              <span className="text-[9px] text-slate-400 truncate w-full text-center leading-none">
                {formatDate(d.date)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HorizontalBars({
  items,
  labelKey,
  valueKey,
  formatValue,
}: {
  items: Record<string, string | number>[];
  labelKey: string;
  valueKey: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => Number(i[valueKey])), 1);

  if (!items.length) {
    return <p className="text-slate-400 text-sm">Aucune donnée.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const val = Number(item[valueKey]);
        const pct = (val / max) * 100;
        const label = String(item[labelKey]);
        return (
          <div key={label}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-semibold text-slate-700 truncate pr-2">{label}</span>
              <span className="text-slate-500 flex-shrink-0">
                {formatValue ? formatValue(val) : val}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Statistics() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    apiAdmin<Statistics>(`/statistics?period=${period}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const statusItems = useMemo(
    () =>
      (data?.orders_by_status ?? [])
        .filter((s) => s.count > 0)
        .map((s) => ({ label: orderStatusLabel(s.status), count: s.count })),
    [data]
  );

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? period;

  return (
    <AdminPage
      title="Statistiques"
      subtitle="Analyse détaillée de votre boutique"
      actions={
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${
                period === p.value
                  ? "bg-brand-500 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      }
    >
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      ) : !data ? (
        <Card className="p-8 text-center text-slate-500">Impossible de charger les statistiques.</Card>
      ) : (
        <div className="space-y-6">
          {data.from && (
            <p className="text-sm text-slate-500">
              Période : <span className="font-semibold text-slate-700">{periodLabel}</span>
              {" · "}
              {formatDate(data.from)} — {formatDate(data.to)}
            </p>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              label="Commandes"
              value={data.summary.orders_count}
              icon={<ShoppingCart size={18} className="text-white" />}
              accent="bg-brand-500"
              change={data.previous_period.change_orders_pct}
            />
            <SummaryCard
              label="Chiffre d'affaires"
              value={formatTND(data.summary.revenue)}
              icon={<Banknote size={18} className="text-white" />}
              accent="bg-emerald-500"
              change={data.previous_period.change_revenue_pct}
            />
            <SummaryCard
              label="Panier moyen"
              value={formatTND(data.summary.average_order_value)}
              icon={<TrendingUp size={18} className="text-white" />}
              accent="bg-indigo-500"
            />
            <SummaryCard
              label="Articles vendus"
              value={data.summary.items_sold}
              icon={<Package size={18} className="text-white" />}
              accent="bg-violet-500"
            />
            <SummaryCard
              label="Nouveaux clients"
              value={data.summary.new_customers}
              icon={<Users size={18} className="text-white" />}
              accent="bg-sky-500"
            />
            <SummaryCard
              label="Livraison"
              value={formatTND(data.summary.shipping_revenue)}
              icon={<Truck size={18} className="text-white" />}
              accent="bg-amber-500"
            />
            <SummaryCard
              label="Remises accordées"
              value={formatTND(data.summary.discount_given)}
              icon={<Percent size={18} className="text-white" />}
              accent="bg-rose-500"
            />
            <SummaryCard
              label="Codes promo utilisés"
              value={data.promo_usage.orders_with_promo}
              icon={<Tag size={18} className="text-white" />}
              accent="bg-teal-500"
            />
          </div>

          {/* Revenue chart */}
          {data.revenue_by_day.length > 0 && (
            <Card className="p-5">
              <h2 className="font-bold text-slate-900 mb-1">Évolution du chiffre d'affaires</h2>
              <p className="text-sm text-slate-500 mb-4">Revenus par jour (hors annulations et remboursements)</p>
              <BarChart data={data.revenue_by_day} valueKey="revenue" formatValue={formatTND} />
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Orders chart */}
            {data.revenue_by_day.length > 0 && (
              <Card className="p-5">
                <h2 className="font-bold text-slate-900 mb-1">Commandes par jour</h2>
                <p className="text-sm text-slate-500 mb-4">Nombre de commandes validées</p>
                <BarChart data={data.revenue_by_day} valueKey="orders" />
              </Card>
            )}

            {/* Status breakdown */}
            <Card className="p-5">
              <h2 className="font-bold text-slate-900 mb-4">Répartition par statut</h2>
              <HorizontalBars
                items={statusItems.map((s) => ({ label: s.label, count: s.count }))}
                labelKey="label"
                valueKey="count"
              />
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top products */}
            <Card className="p-5">
              <h2 className="font-bold text-slate-900 mb-4">Produits les plus vendus</h2>
              {data.top_products.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 border-b border-slate-100">
                        <th className="pb-2 font-semibold">Produit</th>
                        <th className="pb-2 font-semibold text-right">Qté</th>
                        <th className="pb-2 font-semibold text-right">CA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_products.map((p) => (
                        <tr key={p.product_name} className="border-b border-slate-50 last:border-0">
                          <td className="py-2.5 font-medium text-slate-800 pr-2">{p.product_name}</td>
                          <td className="py-2.5 text-right text-slate-600">{p.quantity}</td>
                          <td className="py-2.5 text-right font-semibold text-slate-800">
                            {formatTND(p.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-sm">Aucune vente sur cette période.</p>
              )}
            </Card>

            {/* Top governorates */}
            <Card className="p-5">
              <h2 className="font-bold text-slate-900 mb-1 flex items-center gap-2">
                <MapPin size={18} className="text-brand-500" />
                Top gouvernorats
              </h2>
              <p className="text-sm text-slate-500 mb-4">Par nombre de commandes</p>
              <HorizontalBars
                items={data.top_governorates.map((g) => ({
                  label: g.governorate,
                  orders: g.orders,
                }))}
                labelKey="label"
                valueKey="orders"
              />
            </Card>
          </div>

          {/* Extra insights */}
          <Card className="p-5">
            <h2 className="font-bold text-slate-900 mb-4">Détails complémentaires</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Commandes invités</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{data.summary.guest_orders}</p>
              </div>
              <div>
                <p className="text-slate-500">Commandes clients</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{data.summary.registered_orders}</p>
              </div>
              <div>
                <p className="text-slate-500">Annulées</p>
                <p className="text-xl font-bold text-red-600 mt-0.5">{data.summary.cancelled_orders}</p>
              </div>
              <div>
                <p className="text-slate-500">Remboursées</p>
                <p className="text-xl font-bold text-slate-600 mt-0.5">{data.summary.refunded_orders}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AdminPage>
  );
}
