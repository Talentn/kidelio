import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useCart } from "../context/CartContext";

type Product = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  effective_price: number;
  in_stock: boolean;
  stock: number;
  image_urls: string[];
  age_group?: string;
};

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (slug) {
      api<{ product: Product }>(`/products/${slug}`).then((d) => setProduct(d.product));
    }
  }, [slug]);

  if (!product) return <p className="loading">Chargement...</p>;

  const handleAdd = () => {
    addItem(
      {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        price: product.effective_price,
        imageUrl: product.image_urls[0],
      },
      qty
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="page product-detail">
      <div className="product-gallery">
        {product.image_urls[0] ? (
          <img src={product.image_urls[0]} alt={product.name} />
        ) : (
          <div className="placeholder large">🧒</div>
        )}
      </div>
      <div className="product-info">
        <h1>{product.name}</h1>
        {product.age_group && <span className="tag">{product.age_group}</span>}
        <p className="price-lg">{product.effective_price.toFixed(3)} TND</p>
        {product.description && <p className="desc">{product.description}</p>}

        {product.in_stock ? (
          <>
            <label>
              Quantité
              <input
                type="number"
                min={1}
                max={product.stock}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </label>
            <button type="button" className="btn btn-primary btn-lg" onClick={handleAdd}>
              Ajouter au panier
            </button>
            {added && <p className="success">Ajouté au panier ✓</p>}
          </>
        ) : (
          <p className="out-of-stock">Produit en rupture de stock</p>
        )}
      </div>
    </div>
  );
}
