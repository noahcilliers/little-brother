import { useCallback, useEffect, useState } from "react";
import type { CartSummary } from "../../src/contracts/cart";
import type { Category, Product } from "../../src/contracts/product";
import { api } from "./api";
import { CartPanel } from "./components/CartPanel";
import { CategoryFilter } from "./components/CategoryFilter";
import { Header } from "./components/Header";
import { ProductGrid } from "./components/ProductGrid";
import { formatPrice } from "./format";

const EMPTY_CART: CartSummary = { lines: [], itemCount: 0, subtotalCents: 0, totalCents: 0 };

export function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState<Category>();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartSummary>(EMPTY_CART);
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const run = useCallback(
    (task: () => Promise<void>) => task().catch((e: Error) => setNotice(e.message)),
    [],
  );
  const loadProducts = useCallback(() => run(async () => setProducts(await api.products(category))), [category, run]);

  useEffect(() => {
    run(async () => {
      setCategories(await api.categories());
      setCart(await api.cart());
    });
  }, [run]);
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const add = (productId: string) =>
    run(async () => {
      setCart(await api.add(productId));
      setCartOpen(true);
    });

  const setQuantity = (productId: string, quantity: number) =>
    run(async () => setCart(await api.setQuantity(productId, quantity)));

  const checkout = () =>
    run(async () => {
      const order = await api.checkout();
      setCart(await api.cart());
      setCartOpen(false);
      setNotice(`Order ${order.id} placed · ${formatPrice(order.totalCents)}. Thank you!`);
      await loadProducts();
    });

  return (
    <>
      <Header itemCount={cart.itemCount} onOpenCart={() => setCartOpen(true)} />
      <main className="page">
        <section className="hero">
          <p className="eyebrow">Small-batch goods for slow mornings</p>
          <h1>Paper, pots &amp; good tea.</h1>
        </section>
        {notice && (
          <p className="notice" role="status">
            {notice}
            <button type="button" className="link" onClick={() => setNotice("")}>
              Dismiss
            </button>
          </p>
        )}
        <CategoryFilter categories={categories} selected={category} onSelect={setCategory} />
        <ProductGrid products={products} onAdd={add} />
      </main>
      <CartPanel
        open={cartOpen}
        cart={cart}
        onClose={() => setCartOpen(false)}
        onQuantity={setQuantity}
        onCheckout={checkout}
      />
    </>
  );
}
