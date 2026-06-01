import { useEffect, useState } from "react";
import { api } from "../api/client";

type Order = {
  id: number;
  order_number: string;
  status: string;
  guest_name?: string;
  guest_phone?: string;
  total: number;
  created_at: string;
};

const STATUSES = [
  "pending", "confirmed", "processing", "shipped",
  "out_for_delivery", "delivered", "cancelled", "refunded"
];

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);

  const load = () =>
    api<{ orders: Order[] }>("/admin/orders").then((d) => setOrders(d.orders));

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: number, status: string) => {
    await api(`/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    load();
  };

  return (
    <div>
      <h1>Commandes</h1>
      <table className="table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Client</th>
            <th>Total</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>{o.order_number}</td>
              <td>
                {o.guest_name || "—"}
                <br />
                <small>{o.guest_phone}</small>
              </td>
              <td>{Number(o.total).toFixed(3)} TND</td>
              <td>
                <select
                  value={o.status}
                  onChange={(e) => updateStatus(o.id, e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
