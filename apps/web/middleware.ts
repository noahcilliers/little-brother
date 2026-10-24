import { convexAuthNextjsMiddleware, createRouteMatcher } from "@convex-dev/auth/nextjs/server";
import { api } from "@lb/backend/api";
import { fetchQuery } from "convex/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { afterLogin, loginHref } from "./lib/after-login";

// `/` and the installer stay public; the app and onboarding need sign-in; /login sends signed-in people on.
const isProtectedRoute = createRouteMatcher(["/app(.*)", "/onboarding(.*)"]);
const isLogin = createRouteMatcher(["/login"]);

/** Local e2e deployments (LB_ALLOW_INVITE=1 on Convex) keep the dashboard open without sign-in. */
async function openMode(): Promise<boolean> {
  try {
    return (await fetchQuery(api.team.status, {})).openMode;
  } catch {
    return false;
  }
}

const go = (request: NextRequest, to: string) => NextResponse.redirect(new URL(to, request.url));

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const login = isLogin(request);
    if (!login && !isProtectedRoute(request)) return;
    const authed = await convexAuth.isAuthenticated();
    const q = request.nextUrl.searchParams;
    if (login && authed) return go(request, afterLogin(q.get("next"), q.get("invite")));
    if (!login && !authed && !(await openMode()))
      return go(request, loginHref(request.nextUrl.pathname + request.nextUrl.search));
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  // All routes except static assets (anything with a dot, e.g. /install.sh and /lb.mjs) and _next.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
