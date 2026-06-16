import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { FavoritesProvider } from "./context/FavoritesContext";
import { StoreProvider } from "./context/StoreContext";
import { UIProvider } from "./context/UIContext";
import { Layout } from "./components/Layout";
import { ScrollToTop } from "./components/ScrollToTop";
import { DeferredWidgets } from "./components/DeferredWidgets";
import { CartToastProvider } from "./context/CartToastContext";
import { Home } from "./pages/Home";

// Admin is a separate entry chunk — not referenced until /admin/*
const AdminApp = lazy(() => import("./AdminApp"));

// ── Public pages (lazy) ───────────────────────────────────────────────────────
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
const Favorites     = lazy(() => import("./pages/Favorites").then(m => ({ default: m.Favorites })));
const Rewards       = lazy(() => import("./pages/Rewards").then(m => ({ default: m.Rewards })));

function PageLoader() {
  return (
    <div className="min-h-[60dvh] flex items-center justify-center" role="status" aria-live="polite" aria-label="Chargement">
      <span className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" aria-hidden="true" />
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
          <FavoritesProvider>
          <UIProvider>
            <BrowserRouter>
              <ScrollToTop />
              <DeferredWidgets />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* ── Boutique (public) ── */}
                  <Route element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="produits" element={<Products />} />
                    <Route path="produits/:slug" element={<ProductDetail />} />
                    <Route path="panier" element={<Cart />} />
                    <Route path="favoris" element={<Favorites />} />
                    <Route path="checkout" element={<Checkout />} />
                    <Route path="connexion" element={<Login />} />
                    <Route path="inscription" element={<Register />} />
                    <Route path="compte" element={<Account />} />
                    <Route path="recompenses" element={<Rewards />} />
                    <Route path="contact" element={<Contact />} />
                    <Route path="commande/:orderNumber" element={<OrderSuccess />} />
                    <Route path="suivi" element={<TrackOrder />} />
                    <Route path="suivi/:orderNumber" element={<TrackOrder />} />
                  </Route>

                  {/* ── Back office (isolated chunk) ── */}
                  <Route path="admin/connexion" element={<Navigate to="/connexion" replace />} />
                  <Route path="admin/*" element={<AdminApp />} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </UIProvider>
          </FavoritesProvider>
        </CartProvider>
        </CartToastProvider>
      </AuthProvider>
    </StoreProvider>
    </HelmetProvider>
  );
}

export default App;
