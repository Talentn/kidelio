import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";

type Product = {
  id: number;
  name: string;
  slug: string;
  effective_price: number;
  in_stock: boolean;
  image_urls: string[];
  age_group?: string;
};

type Category = { id: number; name: string; slug: string };

export function Products() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState(searchParams.get("q") || "");

  const category = searchParams.get("category") || "";

  useEffect(() => {
    api<{ categories: Category[] }>("/categories").then((d) => setCategories(d.categories));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    api<{ products: Product[] }>(`/products?${params}`).then((d) => setProducts(d.products));
  }, [category, q]);

  return (
    <div className="page">
      <h1>Boutique</h1>

      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          const p = new URLSearchParams(searchParams);
          if (q) p.set("q", q);
          else p.delete("q");
          setSearchParams(p);
        }}
      >
        <input
          type="search"
          placeholder="Rechercher..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="btn btn-primary">
          OK
        </button>
      </form>

      <div className="category-chips">
        <button
          type="button"
          className={!category ? "chip active" : "chip"}
          onClick={() => {
            const p = new URLSearchParams(searchParams);
            p.delete("category");
            setSearchParams(p);
          }}
        >
          Tous
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={category === String(c.id) ? "chip active" : "chip"}
            onClick={() => {
              const p = new URLSearchParams(searchParams);
              p.set("category", String(c.id));
              setSearchParams(p);
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="product-grid">
        {products.map((p) => (
          <Link key={p.id} to={`/produits/${p.slug}`} className="product-card">
            <div className="product-img">
              {p.image_urls[0] ? (
                <img src={p.image_urls[0]} alt={p.name} loading="lazy" />
              ) : (
                <span className="placeholder">🎁</span>
              )}
            </div>
            <h3>{p.name}</h3>
            <p className="price">{p.effective_price.toFixed(3)} TND</p>
            {!p.in_stock && <span className="out-of-stock">Rupture</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
