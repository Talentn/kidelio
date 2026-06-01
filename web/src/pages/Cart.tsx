import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

export function Cart() {
  const { items, updateQty, removeItem, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="page empty-state">
        <h1>Panier vide</h1>
        <Link to="/produits" className="btn btn-primary">
          Continuer vos achats
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Mon panier</h1>
      <ul className="cart-list">
        {items.map((item) => (
          <li key={item.productId} className="cart-item">
            <div>
              <strong>{item.name}</strong>
              <p>{item.price.toFixed(3)} TND × {item.quantity}</p>
            </div>
            <div className="cart-item-actions">
              <button type="button" onClick={() => updateQty(item.productId, item.quantity - 1)}>
                −
              </button>
              <span>{item.quantity}</span>
              <button type="button" onClick={() => updateQty(item.productId, item.quantity + 1)}>
                +
              </button>
              <button type="button" className="btn-link danger" onClick={() => removeItem(item.productId)}>
                Retirer
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="cart-total">Total: <strong>{total.toFixed(3)} TND</strong></p>
      <Link to="/checkout" className="btn btn-primary btn-lg btn-block">
        Commander
      </Link>
    </div>
  );
}
