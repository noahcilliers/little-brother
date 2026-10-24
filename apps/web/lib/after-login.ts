/** Where sign-in lands: a safe same-site `next`, else the invite's join step, else the app (which sends
 * first-time users without rooms on to onboarding). */
export function afterLogin(next: string | null | undefined, invite: string | null | undefined): string {
  if (next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")) return next;
  if (invite) return `/onboarding?invite=${encodeURIComponent(invite)}`;
  return "/app";
}

export const loginHref = (next: string) => `/login?next=${encodeURIComponent(next)}`;
