# Demo scenarios: Quill & Kettle

Three live scenarios on **lb-demo-store**, a small online shop (stationery, kitchen, tea). Each one has three
agents with prompts that clash on purpose. This file stays here, not in the demo repo, so agents can't read
each other's prompts.

## Setup

```sh
demo/store.sh init ~/lb-demo-store --install              # one laptop per person: each runs this
demo/store.sh init /tmp/lb-demo/store --worktrees --install  # rehearsal: noah/joshua/ash worktrees on one machine
demo/store.sh reset ~/lb-demo-store                        # between scenarios
```

`init` makes the same `main` commit on every machine. On `main`, `npm run typecheck` and `npm test` pass and
`npm run dev` serves the shop at http://localhost:5173.

| Person | Owns (`.littlebrother.json`) | Branch |
| --- | --- | --- |
| Noah | catalog and pricing: `src/contracts/product.ts`, `src/catalog/**`, `src/pricing/**` | `noah/work` |
| Joshua | cart and checkout: `src/contracts/cart.ts`, `src/contracts/order.ts`, `src/cart/**`, `src/checkout/**` | `joshua/work` |
| Ash | storefront: `web/**` | `ash/work` |

**Before each scenario:**
1. `demo/store.sh reset` on every machine.
2. Start a new Little Brother session on the dashboard and have all three `lb join` it. A fresh session means
   failure memory from one scenario doesn't leak into the next.
3. Start Claude Code with the task list on: `CLAUDE_CODE_ENABLE_TODO_TOOLS=1 claude`.
4. Paste the prompts exactly. They name files on purpose, so each agent's first tool calls are predictable on
   stage.

---

## S1 · Sale week

**Say:** "Three agents, one sale, three different ideas of what a discount is."

**Shows:** two agents editing the same function with opposite rules, and a third re-solving work that's
already in progress.

**Order:** Noah first. Joshua once Noah's agent makes its first edit. Ash right after Joshua.

**Noah · pricing**

```text
Run a 20% sale on the kitchen category. Create src/pricing/sale.ts exporting salePriceCents(product: Product): number | undefined (20% off kitchen products, rounded to the nearest cent; undefined for everything else). Add an optional salePriceCents field to Product in src/contracts/product.ts and fill it in for every product returned by GET /api/products in src/catalog/routes.ts. Make computeTotals in src/cart/totals.ts charge the sale price. Sale prices are final: no other discount may ever apply to a sale item. Run npm run typecheck and npm test.
```

**Joshua · cart**

```text
Add promo codes to the cart. POST /api/cart/promo in src/cart/routes.ts takes { code } and remembers it for that cart. SAVE10 takes 10% off the entire subtotal, every item included. Apply it in computeTotals in src/cart/totals.ts, add discountCents and promoCode to CartSummary in src/contracts/cart.ts, show a Discount row in web/src/components/CartPanel.tsx, and run npm run typecheck and npm test.
```

**Ash · storefront**

```text
Put the kitchen sale on the storefront. In web/src/components/ProductCard.tsx, show kitchen products at 20% off (priceCents × 0.8) with the original price struck through and a "Sale" badge. Use the same sale price for kitchen lines in web/src/components/CartPanel.tsx so the cart matches. Run npm run typecheck.
```

**Expected catches**

| Pair | What clashes | Type | Caught by |
| --- | --- | --- | --- |
| Noah ↔ Joshua | Both rewrite `computeTotals` in `src/cart/totals.ts` | conflict | R1 line overlap (rules, on the edit) |
| Noah ↔ Joshua | "No other discount on sale items" vs "every item included" | conflict | judge, on the prompts |
| Ash ↔ Noah | The sale price is computed twice: `src/pricing/sale.ts` and `ProductCard.tsx` | duplicate | similarity or judge, before Ash's first edit |
| Ash ↔ Joshua | Both edit `CartPanel.tsx` | conflict | R1, if they touch the same lines |

**Resolve:** Noah owns pricing, so he decides: promo codes skip sale items. Joshua's agent excludes lines with a
sale price from SAVE10. Ash's agent reads `product.salePriceCents` from the API instead of multiplying by 0.8.

**Without Little Brother:** the cart charges one total and the storefront shows another, and SAVE10 stacks on
sale items, the one thing Noah ruled out. Every branch passes its own tests.

**Check after merging:** `rg "0\.8" web/src` finds nothing, and `npm run typecheck && npm test` pass.

---

## S2 · Going international

**Say:** "One agent changes how prices work. The other two keep building on the old version."

**Shows:** a contract change that breaks other agents' code only after the merge, and two agents picking
opposite answers to "where does currency live?"

**Order:** Noah first. Joshua once Noah's agent makes its first edit. Ash about 30 seconds after Joshua.

**Noah · catalog**

```text
Make the catalog multi-currency. In src/contracts/product.ts replace priceCents with price: { amount: number; currency: "USD" | "EUR" | "GBP" } (amount in minor units, like cents). Set every seed product in src/catalog/products.ts to USD, and update every use of priceCents in src/ and web/. Run npm run typecheck and npm test.
```

**Joshua · cart**

```text
Add shipping to the cart: $4.95 flat, free when the subtotal is $50 or more. Add shippingCents to CartSummary in src/contracts/cart.ts, work it out in computeTotals in src/cart/totals.ts from each product's priceCents, include it in totalCents, and show a Shipping row in web/src/components/CartPanel.tsx. Run npm run typecheck and npm test.
```

**Ash · storefront**

```text
Add a currency picker (USD, EUR, GBP) to the header in web/src/components/Header.tsx and remember the choice in localStorage. Convert in the browser: change formatPrice in web/src/format.ts to formatPrice(cents: number, currency: Currency) with fixed rates (1 USD = 0.92 EUR = 0.79 GBP), and pass the chosen currency everywhere formatPrice is called. Run npm run typecheck.
```

**Expected catches**

| Pair | What clashes | Type | Caught by |
| --- | --- | --- | --- |
| Noah ↔ Joshua | Noah removes `priceCents`; Joshua adds new reads of it in `totals.ts` | conflict | R4 delete vs use, and R1 on `computeTotals` |
| Noah ↔ Ash | Ash changes `formatPrice`'s signature while Noah rewrites its callers | conflict | R5 signature change, R1 on `ProductCard.tsx` |
| Noah ↔ Ash | Currency stored on the product vs converted in the browser | conflict | judge, on the prompts |

**Resolve:** Noah's contract lands first, since the other two depend on it. Joshua's agent reads
`price.amount`. Ash keeps the picker but formats `price.currency` with `Intl.NumberFormat` instead of
converting at made-up rates.

**Without Little Brother:** each branch typechecks on its own. The merge doesn't: `priceCents` is gone, and
`formatPrice` takes a second argument nobody else passes.

**Check after merging:** `rg priceCents src web` finds nothing, and `npm run typecheck && npm test` pass.

---

## S3 · Stock rush

**Say:** "Yesterday an agent tried caching the product list and broke stock counts. Today another agent is
about to try the same thing."

**Shows:** failure memory reaching an agent before its first edit, and how that heads off a second clash.

**Order:**
1. Noah's prompt is "yesterday's" session. Send it, wait for it to fail and revert (about a minute), then
   `/exit` that Claude session. Do this before you go on stage if time is short, but in the same Little
   Brother session.
2. Send Joshua's and Ash's prompts together.

**Noah · catalog (yesterday)**

```text
The product grid loads slowly. Cache the GET /api/products response in memory for 60 seconds in src/catalog/routes.ts, then run npm test. If npm test fails, undo the change with `git checkout src/catalog/routes.ts` and stop. Don't try anything else; just report what happened.
```

It fails on purpose: `test/api.test.ts` checks out a mug and expects the catalog to show one fewer right
away.

**Joshua · cart**

```text
Browsing feels slow when lots of people are shopping. Add a 60-second in-memory cache to GET /api/products in src/catalog/routes.ts so we stop rebuilding the product list on every request. Run npm test.
```

**Ash · storefront**

```text
Show live stock on the storefront. In web/src/components/ProductCard.tsx show "Only N left" when stock is 5 or fewer, and in web/src/App.tsx refetch the product list every 10 seconds so the counts drop as other people check out. Run npm run typecheck.
```

**Expected catches**

| Pair | What clashes | Type | Caught by |
| --- | --- | --- | --- |
| Joshua ↔ Noah's lesson | The same cache that failed the stock test yesterday | stale | R11 on the prompt, before the first edit |
| Joshua ↔ Ash | A 60-second cache vs stock counts that refresh every 10 seconds | conflict | judge, on the prompts |

If Joshua's agent takes the stale warning and drops the cache, the Joshua ↔ Ash conflict never forms. That's the
point to make on stage: one catch prevented the next clash.

**Without Little Brother:** Joshua's agent spends a few minutes rediscovering that the cache fails the stock
test. If it "fixes" the test instead, Ash's "Only N left" shows numbers up to a minute old.

**Check after merging:** `npm test` passes, and `src/catalog/routes.ts` has no cache.

---

## If a scenario misfires

- **An agent ignores a warning.** `stale` and `duplicate` only warn. Let it run; the merged checks above show
  the cost, which still makes the point.
- **A catch lands late.** Prompts are timed so the second agent starts after the first one's first edit.
  Wait for that edit to show on the dashboard before sending.
- **The judge flags something that isn't a clash.** Dismiss it on the dashboard. That's the feedback loop, live.
