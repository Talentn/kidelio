import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const GOVERNORATES = [
  "Tunis", "Ariana", "Ben Arous", "Manouba", "Nabeul", "Zaghouan",
  "Bizerte", "Béja", "Jendouba", "Kef", "Siliana", "Sousse",
  "Monastir", "Mahdia", "Sfax", "Kairouan", "Kasserine", "Sidi Bouzid",
  "Gabès", "Medenine", "Tataouine", "Gafsa", "Tozeur", "Kebili"
];

export function Checkout() {
  const { items, total, clear } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [promo, setPromo] = useState("");
  const [discount, setDiscount] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const shipping = total >= 200 ? 0 : 7;
  const grandTotal = total - discount + shipping;

  const validatePromo = async () => {
    try {
      const d = await api<{ valid: boolean; discount: number }>("/promo-codes/validate", {
        method: "POST",
        body: JSON.stringify({ code: promo, subtotal: total }),
      });
      if (d.valid) setDiscount(Number(d.discount));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Code invalide");
    }
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);

    try {
      const data = await api<{ order: { order_number: string } }>("/orders", {
        method: "POST",
        body: JSON.stringify({
          guest_name: form.get("name"),
          guest_phone: form.get("phone"),
          guest_email: form.get("email"),
          shipping_governorate: form.get("governorate"),
          shipping_delegation: form.get("delegation"),
          shipping_address: form.get("address"),
          promo_code: promo || undefined,
          payment_method: "cash",
          items: items.map((i) => ({
            product_id: i.productId,
            quantity: i.quantity,
          })),
        }),
      });
      clear();
      navigate(`/commande/${data.order.order_number}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return <p className="page">Panier vide</p>;
  }

  return (
    <div className="page">
      <h1>Checkout</h1>
      <form className="checkout-form" onSubmit={submit}>
        <fieldset>
          <legend>Coordonnées</legend>
          <input name="name" placeholder="Nom complet" required defaultValue={user?.name} />
          <input name="phone" placeholder="Téléphone" required type="tel" />
          <input name="email" placeholder="Email (optionnel)" type="email" defaultValue={user?.email} />
        </fieldset>
        <fieldset>
          <legend>Livraison</legend>
          <select name="governorate" required>
            <option value="">Gouvernorat</option>
            {GOVERNORATES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <input name="delegation" placeholder="Délégation / Ville" required />
          <textarea name="address" placeholder="Adresse complète" required rows={3} />
        </fieldset>
        <fieldset>
          <legend>Code promo</legend>
          <div className="promo-row">
            <input value={promo} onChange={(e) => setPromo(e.target.value)} placeholder="Code" />
            <button type="button" className="btn btn-ghost" onClick={validatePromo}>
              Appliquer
            </button>
          </div>
        </fieldset>
        <div className="checkout-summary">
          <p>Sous-total: {total.toFixed(3)} TND</p>
          <p>Livraison: {shipping.toFixed(3)} TND {total >= 200 && "(gratuite)"}</p>
          {discount > 0 && <p>Réduction: -{discount.toFixed(3)} TND</p>}
          <p className="price-lg">Total: {grandTotal.toFixed(3)} TND</p>
          <p className="hint">Paiement à la livraison (espèces)</p>
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
          {loading ? "Envoi..." : "Confirmer la commande"}
        </button>
      </form>
    </div>
  );
}
