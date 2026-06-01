import { Link, useParams } from "react-router-dom";

export function OrderSuccess() {
  const { orderNumber } = useParams();
  return (
    <div className="page empty-state success-page">
      <h1>Commande confirmée !</h1>
      <p>Numéro: <strong>{orderNumber}</strong></p>
      <p>Paiement à la livraison. Merci pour votre confiance.</p>
      <Link to="/" className="btn btn-primary">Retour à l'accueil</Link>
    </div>
  );
}
