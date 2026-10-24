# Quill & Kettle

A small online shop: Express API (`src/`, port 3001) and a Vite + React storefront (`web/`, port 5173).
Data is in memory and resets when the API restarts.

| Area | Owner | Files |
| --- | --- | --- |
| Catalog and pricing | Noah | `src/contracts/product.ts`, `src/catalog/*`, `src/pricing/*` |
| Cart and checkout | Joshua | `src/contracts/cart.ts`, `src/contracts/order.ts`, `src/cart/*`, `src/checkout/*` |
| Storefront | Ash | `web/` |

Types shared by the API and the storefront live in `src/contracts/`. Import them; don't redeclare them.

## API

| Route | Does |
| --- | --- |
| `GET /api/products?category=` | List products, optionally one category (`stationery`, `kitchen`, `tea`) |
| `GET /api/products/:slug` | One product |
| `GET /api/cart` | Cart summary with totals |
| `POST /api/cart/items` | Add `{ productId, quantity }` |
| `PATCH /api/cart/items/:productId` | Set `{ quantity }` (0 removes) |
| `POST /api/checkout` | Place the order, decrement stock, empty the cart |

Cart routes need an `x-cart-id` header; the storefront makes one up and keeps it in localStorage.

## Commands

```sh
npm install
npm run dev        # API + storefront → http://localhost:5173
npm test           # vitest: totals, catalog, cart, checkout
npm run typecheck
```
