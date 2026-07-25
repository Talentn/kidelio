import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/admin/AdminLayout";
import { RequireStaff } from "./components/admin/RequireStaff";
import { RequireAdmin } from "./components/admin/RequireAdmin";
import { RequireSuperOps } from "./components/admin/RequireSuperOps";
import { RequireSection } from "./components/admin/RequireSection";

const Dashboard       = lazy(() => import("./pages/admin/Dashboard").then((m) => ({ default: m.Dashboard })));
const Statistics    = lazy(() => import("./pages/admin/Statistics").then((m) => ({ default: m.Statistics })));
const AdminProducts   = lazy(() => import("./pages/admin/AdminProducts").then((m) => ({ default: m.AdminProducts })));
const AdminStock      = lazy(() => import("./pages/admin/AdminStock").then((m) => ({ default: m.AdminStock })));
const AdminOrders     = lazy(() => import("./pages/admin/AdminOrders").then((m) => ({ default: m.AdminOrders })));
const AdminReviews    = lazy(() => import("./pages/admin/AdminReviews").then((m) => ({ default: m.AdminReviews })));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories").then((m) => ({ default: m.AdminCategories })));
const ActivityLogs    = lazy(() => import("./pages/admin/ActivityLogs").then((m) => ({ default: m.ActivityLogs })));
const AdminHomepage   = lazy(() => import("./pages/admin/AdminHomepage").then((m) => ({ default: m.AdminHomepage })));
const AdminMessages   = lazy(() => import("./pages/admin/AdminMessages").then((m) => ({ default: m.AdminMessages })));
const AdminAttributes = lazy(() => import("./pages/admin/AdminAttributes").then((m) => ({ default: m.AdminAttributes })));
const AdminPromos     = lazy(() => import("./pages/admin/AdminPromos").then((m) => ({ default: m.AdminPromos })));
const AdminPromoCodes = lazy(() => import("./pages/admin/AdminPromoCodes").then((m) => ({ default: m.AdminPromoCodes })));
const AdminUsers      = lazy(() => import("./pages/admin/AdminUsers").then((m) => ({ default: m.AdminUsers })));
const AdminClientAnalytics = lazy(() => import("./pages/admin/AdminClientAnalytics").then((m) => ({ default: m.AdminClientAnalytics })));
const AdminChat         = lazy(() => import("./pages/admin/AdminChat").then((m) => ({ default: m.AdminChat })));
const AdminChatArchives = lazy(() => import("./pages/admin/AdminChatArchives").then((m) => ({ default: m.AdminChatArchives })));
const SystemStatus      = lazy(() => import("./pages/admin/SystemStatus").then((m) => ({ default: m.SystemStatus })));
const QueuesStatus      = lazy(() => import("./pages/admin/QueuesStatus").then((m) => ({ default: m.QueuesStatus })));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications").then((m) => ({ default: m.AdminNotifications })));

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
            <Route path="statistiques" element={<RequireSection section="statistics"><Statistics /></RequireSection>} />
            <Route path="produits" element={<RequireSection section="products"><AdminProducts /></RequireSection>} />
            <Route path="stock" element={<RequireSection section="stock"><AdminStock /></RequireSection>} />
            <Route path="commandes" element={<RequireSection section="orders"><AdminOrders /></RequireSection>} />
            <Route path="avis" element={<RequireSection section="reviews"><AdminReviews /></RequireSection>} />
            <Route path="categories" element={<RequireSection section="categories"><AdminCategories /></RequireSection>} />
            <Route path="accueil" element={<RequireSection section="homepage"><AdminHomepage /></RequireSection>} />
            <Route path="messages" element={<RequireSection section="messages"><AdminMessages /></RequireSection>} />
            <Route path="attributs" element={<RequireSection section="attributes"><AdminAttributes /></RequireSection>} />
            <Route path="promos" element={<RequireSection section="promos"><AdminPromos /></RequireSection>} />
            <Route path="codes-promo" element={<RequireSection section="promo_codes"><AdminPromoCodes /></RequireSection>} />
            <Route element={<RequireAdmin />}>
              <Route path="utilisateurs" element={<RequireSection section="users"><AdminUsers /></RequireSection>} />
            </Route>
            <Route path="activite" element={<RequireSection section="activity"><ActivityLogs /></RequireSection>} />
            <Route path="panier-live" element={<RequireSection section="client_analytics"><AdminClientAnalytics /></RequireSection>} />
            <Route path="chat" element={<RequireSection section="chat"><AdminChat /></RequireSection>} />
            <Route path="chat-archives" element={<RequireSection section="chat_archives"><AdminChatArchives /></RequireSection>} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route element={<RequireSuperOps />}>
              <Route path="systeme" element={<SystemStatus />} />
              <Route path="files-attente" element={<QueuesStatus />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
