import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export function Layout() {
  const { user, logout } = useAuth();
  const { count } = useCart();

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="logo">
          <span className="logo-icon">🧸</span>
          Kids Shop
        </Link>
        <nav className="nav-desktop">
          <Link to="/produits">Produits</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <Link to="/compte">{user.name}</Link>
              <button type="button" className="btn-link" onClick={() => logout()}>
                Déconnexion
              </button>
            </>
          ) : (
            <Link to="/connexion">Connexion</Link>
          )}
          <Link to="/panier" className="cart-link">
            Panier {count > 0 && <span className="badge">{count}</span>}
          </Link>
        </div>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <Link to="/">Accueil</Link>
        <Link to="/produits">Shop</Link>
        <Link to="/panier">Panier</Link>
        <Link to={user ? "/compte" : "/connexion"}>Compte</Link>
      </nav>

      <footer className="footer">
        <p>© {new Date().getFullYear()} Kids Shop — Mode & jouets pour enfants</p>
      </footer>
    </div>
  );
}
