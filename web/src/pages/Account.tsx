import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

type Order = {
  order_number: string;
  status: string;
  total: number;
  created_at: string;
};

export function Account() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (user) {
      api<{ orders: Order[] }>("/orders").then((d) => setOrders(d.orders));
    }
  }, [user]);

  if (!user) return <p>Connectez-vous pour voir votre compte.</p>;

  return (
    <div className="page">
      <h1>Bonjour, {user.name}</h1>
      <p>Points fidélité: {user.fidelity_points}</p>
      <h2>Mes commandes</h2>
      {orders.length === 0 ? (
        <p>Aucune commande pour le moment.</p>
      ) : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.order_number}>
              <strong>{o.order_number}</strong> — {o.status} — {Number(o.total).toFixed(3)} TND
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
