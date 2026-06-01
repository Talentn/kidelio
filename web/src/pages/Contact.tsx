import { FormEvent, useState } from "react";
import { api } from "../api/client";

export function Contact() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    try {
      await api("/contact", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          message: form.get("message"),
        }),
      });
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="page">
      <h1>Contact</h1>
      {sent ? (
        <p className="success">Message envoyé. Merci !</p>
      ) : (
        <form onSubmit={onSubmit} className="checkout-form">
          <input name="name" placeholder="Nom" required />
          <input name="email" type="email" placeholder="Email" required />
          <input name="phone" placeholder="Téléphone" />
          <textarea name="message" placeholder="Votre message" required rows={5} />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn btn-primary">Envoyer</button>
        </form>
      )}
    </div>
  );
}
