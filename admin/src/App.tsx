import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { StoreProvider } from "./context/StoreContext";
import { AdminLayout } from "./components/AdminLayout";
import { RequireStaff } from "./components/RequireStaff";
import { ActivityLogs } from "./pages/ActivityLogs";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Orders } from "./pages/Orders";
import { Products } from "./pages/Products";

function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireStaff />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="orders" element={<Orders />} />
              <Route path="activity" element={<ActivityLogs />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}

export default App;
