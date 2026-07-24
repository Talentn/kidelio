import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { AdminSectionKey, sectionAllowed } from "../../lib/adminSections";

/**
 * Guards an admin page behind a section key. The super admin configures which
 * sections each staff account can see (null = all sections).
 */
export function RequireSection({ section, children }: { section: AdminSectionKey; children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (user && sectionAllowed(user, section)) return <>{children}</>;

  if (loading) return null;

  return <Navigate to="/admin" replace />;
}
