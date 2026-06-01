import { useEffect, useState } from "react";
import { api } from "../api/client";

type Stats = {
  orders_today: number;
  revenue_today: number;
  pending_orders: number;
  low_stock_products: number;
  total_products: number;
  unread_messages: number;
};

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>("/admin/dashboard/stats").then(setStats);
  }, []);

  if (!stats) return <p>Chargement...</p>;

  return (
    <div>
      <h1>Tableau de bord</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <span>Commandes aujourd'hui</span>
          <strong>{stats.orders_today}</strong>
        </div>
        <div className="stat-card">
          <span>CA aujourd'hui</span>
          <strong>{Number(stats.revenue_today).toFixed(3)} TND</strong>
        </div>
        <div className="stat-card warn">
          <span>En attente</span>
          <strong>{stats.pending_orders}</strong>
        </div>
        <div className="stat-card warn">
          <span>Stock bas</span>
          <strong>{stats.low_stock_products}</strong>
        </div>
        <div className="stat-card">
          <span>Produits</span>
          <strong>{stats.total_products}</strong>
        </div>
        <div className="stat-card">
          <span>Messages non lus</span>
          <strong>{stats.unread_messages}</strong>
        </div>
      </div>
    </div>
  );
}
