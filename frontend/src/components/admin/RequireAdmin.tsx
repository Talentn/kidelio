import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/** User management — admin role only (employees share the rest of the dashboard). */
export function RequireAdmin() {
  const { user, loading } = useAuth();

  if (user?.role === "admin") return <Outlet />;

  if (loading) return null;

  return <Navigate to="/admin" replace />;
}
