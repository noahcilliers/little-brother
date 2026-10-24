# Demo

- `shop/` — source of **lb-demo-shop**: Express API (`src/`), in-memory tables (`db/schema/`, no `users.ts` yet),
  Vite React storefront (`web/`), `.littlebrother.json` topic map, and tests. Uses npm, not pnpm; it is outside
  the pnpm workspace and biome.
- `setup.sh` — turns `shop/` into a git repo with `main` plus `noah/auth`, `joshua/checkout`, `ash/frontend`.
- `solution/` — reference overlay (JWT bearer + Vite proxy) proving the integration test can pass. Never copied
  by `setup.sh`.

```sh
demo/setup.sh ~/lb-demo-shop --install           # one repo, three branches
demo/setup.sh /tmp/lb-demo/shop --worktrees      # + /tmp/lb-demo/{noah,joshua,ash} worktrees (replay cwds)
```

On `main`:
- `npm test` (unit) fails: the storefront has no route to the API (no `/api` proxy, no CORS).
- `npm run test:integration` fails: login, cart and checkout answer 501.

Both pass once auth and checkout pick the same mechanism and the Vite proxy is in place (see `solution/`).
Demo login: `demo@shop.dev` / `correct-horse`. Run the app with `npm run dev` (API :3001) and `npm run web` (:5173).
