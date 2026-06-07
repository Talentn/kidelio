import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isSuperOps } from "../../lib/superOps";

/** Super-ops pages — only alaghabi98@gmail.com (staff account required). */
export function RequireSuperOps() {
  const { user, loading } = useAuth();

  const allowed =
    !!user &&
    (user.role === "admin" || user.role === "employee") &&
    isSuperOps(user.email);

  if (allowed) return <Outlet />;
  if (loading) return null;

  return <Navigate to="/admin" replace />;
}
