import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { StoreProvider } from "./context/StoreContext";
import { CookieConsent } from "./components/CookieConsent";
import { Layout } from "./components/Layout";
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

function App() {
  return (
    <StoreProvider>
      <AuthProvider>
        <CartProvider>
          <BrowserRouter>
          <CookieConsent />
          <Routes>
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
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </StoreProvider>
  );
}

export default App;
