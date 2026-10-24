import type { Product } from "../../../src/contracts/product";
import { formatPrice } from "../format";

interface ProductCardProps {
  product: Product;
  onAdd: () => void;
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const soldOut = product.stock === 0;
  return (
    <article className="card">
      <div className={`card-art art-${product.category}`} aria-hidden="true">
        {product.emoji}
      </div>
      <div className="card-body">
        <p className="card-category">{product.category}</p>
        <h2 className="card-title">{product.name}</h2>
        <p className="card-description">{product.description}</p>
        <div className="card-footer">
          <span className="price">{formatPrice(product.priceCents)}</span>
          <button type="button" className="button" disabled={soldOut} onClick={onAdd}>
            {soldOut ? "Sold out" : "Add to cart"}
          </button>
        </div>
      </div>
    </article>
  );
}
