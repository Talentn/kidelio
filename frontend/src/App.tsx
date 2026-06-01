import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { StoreProvider } from "./context/StoreContext";
import { UIProvider } from "./context/UIContext";
import { CookieConsent } from "./components/CookieConsent";
import { MetaPixel } from "./components/MetaPixel";
import { PromoPopup } from "./components/PromoPopup";
import { Layout } from "./components/Layout";
import { AdminLayout } from "./components/admin/AdminLayout";
import { RequireStaff } from "./components/admin/RequireStaff";
import { Home } from "./pages/Home";
import { Products } from "./pages/Products";
import { ProductDetail } from "./pages/ProductDetail";
import { Cart } from "./pages/Cart";
import { Checkout } from "./pages/Checkout";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Account } from "./pages/Account";
import { Contact } from "./pages/Contact";
import { OrderSuccess } from "./pages/OrderSuccess";
import { Dashboard } from "./pages/admin/Dashboard";
import { AdminProducts } from "./pages/admin/AdminProducts";
import { AdminStock } from "./pages/admin/AdminStock";
import { AdminOrders } from "./pages/admin/AdminOrders";
import { AdminCategories } from "./pages/admin/AdminCategories";
import { ActivityLogs } from "./pages/admin/ActivityLogs";
import { AdminHomepage } from "./pages/admin/AdminHomepage";
import { AdminMessages } from "./pages/admin/AdminMessages";
import { AdminAttributes } from "./pages/admin/AdminAttributes";
import { AdminPromos } from "./pages/admin/AdminPromos";
import { AdminPromoCodes } from "./pages/admin/AdminPromoCodes";
import { AdminUsers } from "./pages/admin/AdminUsers";
import { TrackOrder } from "./pages/TrackOrder";

function App() {
  return (
    <StoreProvider>
      <AuthProvider>
        <CartProvider>
          <UIProvider>
            <BrowserRouter>
              <MetaPixel />
              <CookieConsent />
              <PromoPopup />
              <Routes>
                {/* ── Boutique (public) ── */}
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="produits" element={<Products />} />
                  <Route path="produits/:slug" element={<ProductDetail />} />
                  <Route path="panier" element={<Cart />} />
                  <Route path="checkout" element={<Checkout />} />
                  <Route path="connexion" element={<Login />} />
                  <Route path="inscription" element={<Register />} />
                  <Route path="compte" element={<Account />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="commande/:orderNumber" element={<OrderSuccess />} />
                  <Route path="suivi" element={<TrackOrder />} />
                  <Route path="suivi/:orderNumber" element={<TrackOrder />} />
                </Route>

                {/* ── Back office (staff) ── */}
                <Route path="admin/connexion" element={<Navigate to="/connexion" replace />} />
                <Route path="admin" element={<RequireStaff />}>
                  <Route element={<AdminLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="produits" element={<AdminProducts />} />
                    <Route path="stock" element={<AdminStock />} />
                    <Route path="commandes" element={<AdminOrders />} />
                    <Route path="categories" element={<AdminCategories />} />
                    <Route path="accueil" element={<AdminHomepage />} />
                    <Route path="messages" element={<AdminMessages />} />
                    <Route path="attributs" element={<AdminAttributes />} />
                    <Route path="promos" element={<AdminPromos />} />
                    <Route path="codes-promo" element={<AdminPromoCodes />} />
                    <Route path="utilisateurs" element={<AdminUsers />} />
                    <Route path="activite" element={<ActivityLogs />} />
                  </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </UIProvider>
        </CartProvider>
      </AuthProvider>
    </StoreProvider>
  );
}

export default App;
