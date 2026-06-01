import { Link, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../api/client";
import { useStore } from "../context/StoreContext";

export function AdminLayout() {
  const navigate = useNavigate();
  const { config, apiConnected } = useStore();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="admin-app">
      <aside className="sidebar">
        <div className="sidebar-brand">Kids Shop</div>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/products">Produits</Link>
          <Link to="/orders">Commandes</Link>
          <Link to="/activity">Activité</Link>
          {config?.urls.storefront && (
            <a href={config.urls.storefront} target="_blank" rel="noreferrer">
              Voir la boutique ↗
            </a>
          )}
        </nav>
        <p className={`api-status ${apiConnected ? "ok" : "err"}`}>
          API {apiConnected ? "connectée" : "déconnectée"}
        </p>
        <button type="button" className="btn-link logout" onClick={handleLogout}>
          Déconnexion
        </button>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
