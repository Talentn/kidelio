import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    try {
      await register({
        email: form.get("email") as string,
        password: form.get("password") as string,
        name: form.get("name") as string,
      });
      navigate("/compte");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="page auth-page">
      <h1>Inscription</h1>
      <form onSubmit={onSubmit}>
        <input name="name" placeholder="Nom" required />
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Mot de passe (8+)" required minLength={8} />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">Créer mon compte</button>
      </form>
      <p>
        Déjà inscrit ? <Link to="/connexion">Connexion</Link>
      </p>
    </div>
  );
}
