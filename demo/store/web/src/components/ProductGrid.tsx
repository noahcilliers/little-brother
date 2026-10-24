import type { Product } from "../../../src/contracts/product";
import { ProductCard } from "./ProductCard";

interface ProductGridProps {
  products: Product[];
  onAdd: (productId: string) => void;
}

export function ProductGrid({ products, onAdd }: ProductGridProps) {
  return (
    <ul className="grid">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} onAdd={() => onAdd(p.id)} />
        </li>
      ))}
    </ul>
  );
}
