import { useEffect, useState } from "react";
import { api } from "../api/client";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    api<{ consent: string | null }>("/consent")
      .then((d) => {
        if (!d.consent) setVisible(true);
      })
      .catch(() => setVisible(true));
  }, []);

  const save = async (level: "essential" | "all") => {
    await api("/consent", {
      method: "PATCH",
      body: JSON.stringify({ level }),
    });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label="Consentement cookies">
      <p>
        Nous utilisons des cookies pour le panier, la session et améliorer votre
        expérience. Choisissez votre préférence.
      </p>
      <div className="cookie-actions">
        <button type="button" className="btn btn-ghost" onClick={() => save("essential")}>
          Essentiels uniquement
        </button>
        <button type="button" className="btn btn-primary" onClick={() => save("all")}>
          Tout accepter
        </button>
      </div>
    </div>
  );
}
