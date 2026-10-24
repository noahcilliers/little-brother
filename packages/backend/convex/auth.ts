import GitHub from "@auth/core/providers/github";
import { convexAuth } from "@convex-dev/auth/server";

// GitHub sign-in for the dashboard. The provider reads AUTH_GITHUB_ID and AUTH_GITHUB_SECRET from the
// deployment env; the login is kept so it can become the member's handle.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub({
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: profile.email ?? undefined,
          image: profile.avatar_url,
          githubLogin: profile.login,
        };
      },
    }),
  ],
});
