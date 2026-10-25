import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { createAccount, retrieveAccount } from "@convex-dev/auth/server";

// Convex injects env vars at runtime; the convex tsconfig deliberately omits node types.
declare const process: { env: Record<string, string | undefined> };

/**
 * Sign in as a handle without GitHub, for recording demos on a local backend only: it needs LB_DEMO_SIGNIN=1
 * AND a localhost site URL, which no cloud deployment has. Headless browsers can't complete GitHub's OAuth.
 */
export const demoSignInEnabled = (): boolean =>
  process.env.LB_DEMO_SIGNIN === "1" && (process.env.CONVEX_SITE_URL ?? "").startsWith("http://127.0.0.1");

export const DemoSignIn = ConvexCredentials({
  id: "demo",
  authorize: async (params, ctx) => {
    if (!demoSignInEnabled()) return null;
    const login = String(params.login ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 40);
    if (!login) return null;
    try {
      const { user } = await retrieveAccount(ctx, { provider: "demo", account: { id: login } });
      return { userId: user._id };
    } catch {
      const name = login.charAt(0).toUpperCase() + login.slice(1);
      const { user } = await createAccount(ctx, {
        provider: "demo",
        account: { id: login },
        profile: { name, githubLogin: login },
      });
      return { userId: user._id };
    }
  },
});
