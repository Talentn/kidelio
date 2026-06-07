import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/admin/AdminLayout";
import { RequireStaff } from "./components/admin/RequireStaff";
import { RequireSuperOps } from "./components/admin/RequireSuperOps";

const Dashboard       = lazy(() => import("./pages/admin/Dashboard").then((m) => ({ default: m.Dashboard })));
const Statistics    = lazy(() => import("./pages/admin/Statistics").then((m) => ({ default: m.Statistics })));
const AdminProducts   = lazy(() => import("./pages/admin/AdminProducts").then((m) => ({ default: m.AdminProducts })));
const AdminStock      = lazy(() => import("./pages/admin/AdminStock").then((m) => ({ default: m.AdminStock })));
const AdminOrders     = lazy(() => import("./pages/admin/AdminOrders").then((m) => ({ default: m.AdminOrders })));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories").then((m) => ({ default: m.AdminCategories })));
const ActivityLogs    = lazy(() => import("./pages/admin/ActivityLogs").then((m) => ({ default: m.ActivityLogs })));
const AdminHomepage   = lazy(() => import("./pages/admin/AdminHomepage").then((m) => ({ default: m.AdminHomepage })));
const AdminMessages   = lazy(() => import("./pages/admin/AdminMessages").then((m) => ({ default: m.AdminMessages })));
const AdminAttributes = lazy(() => import("./pages/admin/AdminAttributes").then((m) => ({ default: m.AdminAttributes })));
const AdminPromos     = lazy(() => import("./pages/admin/AdminPromos").then((m) => ({ default: m.AdminPromos })));
const AdminPromoCodes = lazy(() => import("./pages/admin/AdminPromoCodes").then((m) => ({ default: m.AdminPromoCodes })));
const AdminUsers      = lazy(() => import("./pages/admin/AdminUsers").then((m) => ({ default: m.AdminUsers })));
const AdminLiveCart   = lazy(() => import("./pages/admin/AdminLiveCart").then((m) => ({ default: m.AdminLiveCart })));
const AdminChat         = lazy(() => import("./pages/admin/AdminChat").then((m) => ({ default: m.AdminChat })));
const AdminChatArchives = lazy(() => import("./pages/admin/AdminChatArchives").then((m) => ({ default: m.AdminChatArchives })));
const SystemStatus      = lazy(() => import("./pages/admin/SystemStatus").then((m) => ({ default: m.SystemStatus })));

function AdminPageLoader() {
  return (
    <div className="min-h-[60dvh] flex items-center justify-center" role="status" aria-live="polite" aria-label="Chargement">
      <span className="w-8 h-8 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin" aria-hidden="true" />
    </div>
  );
}

/** Back office — separate chunk, never loaded on the storefront home page. */
export default function AdminApp() {
  return (
    <Suspense fallback={<AdminPageLoader />}>
      <Routes>
        <Route element={<RequireStaff />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="statistiques" element={<Statistics />} />
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
            <Route element={<RequireSuperOps />}>
              <Route path="systeme" element={<SystemStatus />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
