# Reference solution (not part of the demo repo)

Overlay these files on a copy of `demo/shop` to prove the integration test is satisfiable:
JWT bearer auth (`src/auth/*`), the `users` table (`db/schema/users.ts`), cart + checkout keyed by `User`,
and the Vite `/api` proxy instead of CORS.

    cp -R demo/shop /tmp/shop-check && cp -R demo/solution/{db,src,web} /tmp/shop-check/
    cd /tmp/shop-check && npm install && npm test && npm run test:integration
