import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/client";

export function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    try {
      const data = await login(
        form.get("email") as string,
        form.get("password") as string
      );
      if (!["admin", "employee"].includes(data.user.role)) {
        setError("Accès réservé au personnel");
        return;
      }
      navigate("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Kids Shop Admin</h1>
        <form onSubmit={onSubmit}>
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Mot de passe" required />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block">
            Connexion
          </button>
        </form>
        <p className="hint">admin@kids-shop.local / password123</p>
      </div>
    </div>
  );
}
