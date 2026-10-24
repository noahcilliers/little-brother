import { type FormEvent, useEffect, useState } from "react";
import type { User } from "../../src/contracts/user";
import { type Cart, type Product, api } from "./api";

const price = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function App() {
  const [user, setUser] = useState<User>();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart>({ items: [] });
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.products().then(setProducts, (e: Error) => setMessage(e.message));
  }, []);

  const run = (task: () => Promise<void>) => task().catch((e: Error) => setMessage(e.message));

  const signIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    run(async () => {
      setUser(await api.login(String(form.get("email")), String(form.get("password"))));
      setCart(await api.cart());
      setMessage("");
    });
  };

  const total = cart.items.reduce(
    (sum, item) => sum + (products.find((p) => p.id === item.productId)?.priceCents ?? 0) * item.quantity,
    0,
  );

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 640, margin: "2rem auto" }}>
      <h1>lb-demo-shop</h1>
      {user ? (
        <p>Signed in as {user.name}</p>
      ) : (
        <form onSubmit={signIn}>
          <input name="email" defaultValue="demo@shop.dev" />
          <input name="password" type="password" defaultValue="correct-horse" />
          <button type="submit">Sign in</button>
        </form>
      )}

      <h2>Products</h2>
      <ul>
        {products.map((p) => (
          <li key={p.id}>
            {p.name} · {price(p.priceCents)}{" "}
            <button type="button" disabled={!user} onClick={() => run(async () => setCart(await api.addToCart(p.id)))}>
              Add
            </button>
          </li>
        ))}
      </ul>

      <h2>Cart</h2>
      <ul>
        {cart.items.map((item) => (
          <li key={item.productId}>
            {products.find((p) => p.id === item.productId)?.name ?? item.productId} × {item.quantity}
          </li>
        ))}
      </ul>
      <p>Total {price(total)}</p>
      <button
        type="button"
        disabled={!user || cart.items.length === 0}
        onClick={() =>
          run(async () => {
            const order = await api.checkout();
            setMessage(`Order ${order.orderId} placed · ${price(order.totalCents)}`);
            setCart(await api.cart());
          })
        }
      >
        Check out
      </button>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
