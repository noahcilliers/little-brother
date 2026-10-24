# lb-demo-shop

Tiny shop: Express API (`src/`, port 3001) + Vite React storefront (`web/`, port 5173).

| Workstream | Branch | Scope |
| --- | --- | --- |
| auth | `noah/auth` | `src/auth/*`, `db/schema/users.ts` (seed `demo@shop.dev` / `correct-horse`), `GET /api/me` |
| checkout | `joshua/checkout` | `src/checkout/*`: `GET /api/cart`, `POST /api/cart/items`, `POST /api/checkout` |
| frontend | `ash/frontend` | `web/` |

The `User` shape is in `src/contracts/user.ts`. Import it; don't redeclare it.

```sh
npm install
npm run dev               # API
npm run web               # storefront
npm test                  # unit: storefront can reach the API
npm run test:integration  # sign in → cart → checkout, end to end
```
