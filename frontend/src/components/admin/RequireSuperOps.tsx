import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isSuperOps } from "../../lib/superOps";

export function RequireSuperOps() {
  const { user, loading } = useAuth();

  if (user && isSuperOps(user.email)) return <Outlet />;
  if (loading) return null;

  return <Navigate to="/admin" replace />;
}
