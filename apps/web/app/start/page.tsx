import { redirect } from "next/navigation";

// Old links and the CLI's messages point here ("create a connect token on /start"): invites go to sign-in,
// everything else to onboarding's laptop step. Signed-out visitors are sent through /login by the middleware.
export default async function StartPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  redirect(invite ? `/login?invite=${encodeURIComponent(invite)}` : "/onboarding?step=connect");
}
