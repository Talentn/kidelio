import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { me } from "../api/client";

export function RequireStaff() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    me()
      .then((d) => {
        setOk(
          !!d.user && (d.user.role === "admin" || d.user.role === "employee")
        );
      })
      .catch(() => setOk(false));
  }, []);

  if (ok === null) return <p className="loading">Vérification...</p>;
  if (!ok) return <Navigate to="/login" replace />;
  return <Outlet />;
}
