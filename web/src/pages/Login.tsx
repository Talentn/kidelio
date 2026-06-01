import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    try {
      await login(form.get("email") as string, form.get("password") as string);
      navigate("/compte");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="page auth-page">
      <h1>Connexion</h1>
      <form onSubmit={onSubmit}>
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Mot de passe" required />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">Se connecter</button>
      </form>
      <p>
        Pas de compte ? <Link to="/inscription">Créer un compte</Link>
      </p>
    </div>
  );
}
