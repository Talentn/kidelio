import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

type Product = {
  id: number;
  name: string;
  slug: string;
  effective_price: number;
  image_urls: string[];
  age_group?: string;
};

type Slider = { id: number; title?: string; subtitle?: string; link_url?: string };

export function Home() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [sliders, setSliders] = useState<Slider[]>([]);

  useEffect(() => {
    api<{ products: Product[] }>("/products?featured=true").then((d) =>
      setFeatured(d.products.slice(0, 8))
    );
    api<{ sliders: Slider[] }>("/hero-sliders").then((d) => setSliders(d.sliders));
  }, []);

  return (
    <div>
      <section className="hero">
        <div className="hero-content">
          <h1>Des sourires, des couleurs, des aventures</h1>
          <p>Vêtements et essentiels pour femmes et enfants — livraison en Tunisie</p>
          <Link to="/produits" className="btn btn-primary btn-lg">
            Découvrir la boutique
          </Link>
        </div>
      </section>

      {sliders.length > 0 && (
        <section className="section">
          <h2>À la une</h2>
          <div className="slider-cards">
            {sliders.map((s) => (
              <div key={s.id} className="slider-card">
                <h3>{s.title}</h3>
                <p>{s.subtitle}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2>Nos coups de cœur</h2>
        <div className="product-grid">
          {featured.map((p) => (
            <Link key={p.id} to={`/produits/${p.slug}`} className="product-card">
              <div className="product-img">
                {p.image_urls[0] ? (
                  <img src={p.image_urls[0]} alt={p.name} loading="lazy" />
                ) : (
                  <span className="placeholder">👕</span>
                )}
              </div>
              <h3>{p.name}</h3>
              {p.age_group && <span className="tag">{p.age_group}</span>}
              <p className="price">{p.effective_price.toFixed(3)} TND</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
