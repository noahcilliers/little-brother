# Ecommerce backend

Express + built-in `node:sqlite` (Node >= 22.5). The database seeds 8 products on first start.

```sh
npm install
npm run dev        # http://localhost:4000/api, DB at ./shop.db (override with DB_FILE, PORT)
npm test
```

## API

Prices are integer cents. Errors return `{ "error": string }` with 400 / 404 / 409 (out of stock).

| Method | Path | Response |
| --- | --- | --- |
| GET | `/api/health` | `{ ok: true }` |
| GET | `/api/products?q=&category=` | `{ products: Product[] }` |
| GET | `/api/products/:id` | `{ product }` |
| GET | `/api/categories` | `{ categories: string[] }` |
| POST | `/api/orders` | `201 { order }` |
| GET | `/api/orders/:id` | `{ order }` |

`Product`: `{ id, name, description, priceCents, imageUrl, category, stock }`

`POST /api/orders` body:

```json
{ "customer": { "name": "Ada", "email": "ada@example.com", "address": "1 Main St" },
  "items": [{ "productId": 1, "quantity": 2 }] }
```

`Order`: `{ id, status, totalCents, customer, items: [{ productId, name, unitPriceCents, quantity }], createdAt }`

The cart lives on the client. The server looks up current prices and checks stock when the order is placed, so the totals a client sends are never trusted.
