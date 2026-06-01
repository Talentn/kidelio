import { useEffect, useState } from "react";
import { api } from "../api/client";

type Product = {
  id: number;
  name: string;
  slug: string;
  price: number;
  stock: number;
  active: boolean;
};

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);

  const load = () =>
    api<{ products: Product[] }>("/admin/products").then((d) => setProducts(d.products));

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1>Produits</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Prix</th>
            <th>Stock</th>
            <th>Actif</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{Number(p.price).toFixed(3)} TND</td>
              <td className={p.stock < 5 ? "warn" : ""}>{p.stock}</td>
              <td>{p.active ? "Oui" : "Non"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
