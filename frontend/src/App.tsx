import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { StoreProvider } from "./context/StoreContext";
import { UIProvider } from "./context/UIContext";
import { CookieConsent } from "./components/CookieConsent";
import { MetaPixel } from "./components/MetaPixel";
import { Layout } from "./components/Layout";
import { ChatWidget } from "./components/ChatWidget";
import { CartToastProvider } from "./context/CartToastContext";

// Deferred — not needed on first paint
const PromoPopup    = lazy(() => import("./components/PromoPopup").then(m => ({ default: m.PromoPopup })));
const AdminLayout   = lazy(() => import("./components/admin/AdminLayout").then(m => ({ default: m.AdminLayout })));
const RequireStaff  = lazy(() => import("./components/admin/RequireStaff").then(m => ({ default: m.RequireStaff })));

// ── Public pages (lazy) ───────────────────────────────────────────────────────
const Home          = lazy(() => import("./pages/Home").then(m => ({ default: m.Home })));
const Products      = lazy(() => import("./pages/Products").then(m => ({ default: m.Products })));
const ProductDetail = lazy(() => import("./pages/ProductDetail").then(m => ({ default: m.ProductDetail })));
const Cart          = lazy(() => import("./pages/Cart").then(m => ({ default: m.Cart })));
const Checkout      = lazy(() => import("./pages/Checkout").then(m => ({ default: m.Checkout })));
const Login         = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const Register      = lazy(() => import("./pages/Register").then(m => ({ default: m.Register })));
const Account       = lazy(() => import("./pages/Account").then(m => ({ default: m.Account })));
const Contact       = lazy(() => import("./pages/Contact").then(m => ({ default: m.Contact })));
const OrderSuccess  = lazy(() => import("./pages/OrderSuccess").then(m => ({ default: m.OrderSuccess })));
const TrackOrder    = lazy(() => import("./pages/TrackOrder").then(m => ({ default: m.TrackOrder })));

// ── Admin pages (lazy — never loaded by regular shoppers) ────────────────────
const Dashboard       = lazy(() => import("./pages/admin/Dashboard").then(m => ({ default: m.Dashboard })));
const AdminProducts   = lazy(() => import("./pages/admin/AdminProducts").then(m => ({ default: m.AdminProducts })));
const AdminStock      = lazy(() => import("./pages/admin/AdminStock").then(m => ({ default: m.AdminStock })));
const AdminOrders     = lazy(() => import("./pages/admin/AdminOrders").then(m => ({ default: m.AdminOrders })));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories").then(m => ({ default: m.AdminCategories })));
const ActivityLogs    = lazy(() => import("./pages/admin/ActivityLogs").then(m => ({ default: m.ActivityLogs })));
const AdminHomepage   = lazy(() => import("./pages/admin/AdminHomepage").then(m => ({ default: m.AdminHomepage })));
const AdminMessages   = lazy(() => import("./pages/admin/AdminMessages").then(m => ({ default: m.AdminMessages })));
const AdminAttributes = lazy(() => import("./pages/admin/AdminAttributes").then(m => ({ default: m.AdminAttributes })));
const AdminPromos     = lazy(() => import("./pages/admin/AdminPromos").then(m => ({ default: m.AdminPromos })));
const AdminPromoCodes = lazy(() => import("./pages/admin/AdminPromoCodes").then(m => ({ default: m.AdminPromoCodes })));
const AdminUsers      = lazy(() => import("./pages/admin/AdminUsers").then(m => ({ default: m.AdminUsers })));
const AdminLiveCart   = lazy(() => import("./pages/admin/AdminLiveCart").then(m => ({ default: m.AdminLiveCart })));
const AdminChat         = lazy(() => import("./pages/admin/AdminChat").then(m => ({ default: m.AdminChat })));
const AdminChatArchives = lazy(() => import("./pages/admin/AdminChatArchives").then(m => ({ default: m.AdminChatArchives })));

// Minimal spinner shown while a lazy chunk loads
function PageLoader() {
  return (
    <div className="min-h-[60dvh] flex items-center justify-center">
      <span className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
    </div>
  );
}

function App() {
  return (
    <HelmetProvider>
    <StoreProvider>
      <AuthProvider>
        <CartToastProvider>
        <CartProvider>
          <UIProvider>
            <BrowserRouter>
              <MetaPixel />
              <CookieConsent />
              <PromoPopup />
              <ChatWidget />
              <Suspense fallback={<PageLoader />}>
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
                      <Route path="panier-live" element={<AdminLiveCart />} />
                      <Route path="chat" element={<AdminChat />} />
                      <Route path="chat-archives" element={<AdminChatArchives />} />
                    </Route>
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </UIProvider>
        </CartProvider>
        </CartToastProvider>
      </AuthProvider>
    </StoreProvider>
    </HelmetProvider>
  );
}

export default App;
