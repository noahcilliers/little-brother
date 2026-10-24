import { BEAT } from "./film-timeline";

// What each laptop's Claude Code session prints. `type` lines are typed into the input box first; `remote` lines
// arrive from the phone through Remote Control.

export type TermKind = "type" | "remote" | "lb" | "say" | "tool" | "out" | "ok" | "deny" | "warn" | "decided";
export type TermLine = [s: number, kind: TermKind, text: string, head?: string];
export const TYPE_CPS = 40;

// biome-ignore format: one session line per row reads like the terminal it depicts
export const TERM_A: TermLine[] = [
  [BEAT.ashTypes, "type", "/little-brother:join k7f2qx"],
  [BEAT.ashIn, "lb", '[little-brother] joined "checkout sprint" in room lb-demo-shop'],
  [13.9, "type", "build the storefront, then the login flow"],
  [15.3, "say", "I'll start with the storefront pages."],
  [16, "tool", "Write(web/src/pages/Products.tsx)"], [16.3, "out", "Wrote 64 lines"],
  [18, "tool", "Write(web/src/pages/Cart.tsx)"], [18.3, "out", "Wrote 81 lines"],
  [22.4, "type", "add CORS to the API so the storefront can call it"],
  [23.8, "say", "Plan: add cors() middleware to src/server.ts."],
  [24.2, "tool", "Edit(src/server.ts)"],
  [BEAT.stale, "warn", "Noah's agent already tried this and it failed. What worked: a Vite proxy.", "little-brother · stale"],
  [25, "say", "Skipping the middleware. Using the Vite proxy instead."],
  [25.6, "tool", "Edit(web/vite.config.ts)"], [25.9, "out", "server.proxy /api → :3000"],
  [27.4, "tool", "Bash(curl localhost:5173/api/health)"], [27.7, "ok", "200 OK"],
  [28.6, "tool", "Write(src/login/session.ts)"], [29.2, "out", "currentUser() reads req.session.userId"],
  [BEAT.conflict, "warn", "Noah is using JWT tokens for auth. Paused until he decides.", "little-brother · conflict"],
  [BEAT.resolve, "decided", "Noah chose JWT tokens. Switch login to bearer tokens.", "little-brother · decided"],
  [38.7, "say", "Switching login to bearer tokens."],
  [39, "tool", "Edit(web/src/api-client.ts)"], [39.3, "out", "headers.Authorization = Bearer <token>"],
  [40.2, "tool", "Bash(npm test)"], [40.5, "ok", "6 passed"],
];

// biome-ignore format: one session line per row reads like the terminal it depicts
export const TERM_B: TermLine[] = [
  [BEAT.joshTypes, "type", "/little-brother:join k7f2qx"],
  [BEAT.joshIn, "lb", '[little-brother] joined "checkout sprint" in room lb-demo-shop'],
  [BEAT.remoteSend + 0.2, "remote", "build the checkout backend: carts, orders, payments"],
  [15.8, "say", "Starting with the cart and order models."],
  [16.4, "tool", "Write(src/checkout/cart.ts)"], [17.4, "tool", "Write(src/checkout/order.ts)"],
  [18.6, "tool", "Bash(npm test)"], [18.9, "ok", "8 passed"],
  [20, "say", "Checkout needs users. Creating a users table."],
  [20.4, "tool", "Write(db/schema/users.ts)"],
  [BEAT.dup, "deny", "Noah's agent already built the users table. Import it instead.", "PreToolUse:Write · denied by little-brother"],
  [21.3, "say", "Noah owns users. Importing User instead."],
  [21.8, "tool", "Edit(src/checkout/cart.ts)"], [22.1, "out", 'import { User } from "@/db/schema/users"'],
  [23.6, "tool", "Bash(npm test)"], [23.9, "ok", "9 passed"],
  [25.4, "say", "Now payments."],
  [27.2, "tool", "Write(src/checkout/payments.ts)"], [27.5, "out", "createIntent()"],
  [31.6, "tool", "Write(src/checkout/webhook.ts)"], [31.9, "out", "handleStripeEvent()"],
  [38.4, "tool", "Bash(npm test)"], [38.7, "ok", "12 passed"],
];

/** When a line shows in the scrollback: typed prompts only once they're sent. */
export function shownAt([s, kind, text]: TermLine): number {
  return kind === "type" ? s + text.length / TYPE_CPS + 0.25 : s;
}
