import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function RequireStaff() {
  const { user, loading } = useAuth();

  const isStaff = !!user && (user.role === "admin" || user.role === "employee");

  // If we already have a cached staff user, render immediately — no blocking screen.
  if (isStaff) return <Outlet />;

  if (loading) return null;

  return <Navigate to="/connexion" replace />;
}
