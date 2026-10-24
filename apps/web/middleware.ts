import { api } from "@lb/backend/api";
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";

// `/` and the installer stay public; `/start` renders its own signed-out step; the dashboard needs sign-in.
const isProtectedRoute = createRouteMatcher(["/app(.*)"]);

/** Local e2e deployments (LB_ALLOW_INVITE=1 on Convex) keep the dashboard open without sign-in. */
async function openMode(): Promise<boolean> {
  try {
    return (await fetchQuery(api.team.status, {})).openMode;
  } catch {
    return false;
  }
}

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated()) && !(await openMode())) {
      return nextjsMiddlewareRedirect(request, "/start");
    }
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  // All routes except static assets (anything with a dot, e.g. /install.sh and /lb.mjs) and _next.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
