import { redirect } from "next/navigation";

// Old links and the installer's text point here; sign-in and onboarding now live at /login and /onboarding.
export default async function StartPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const { invite } = await searchParams;
  redirect(invite ? `/login?invite=${encodeURIComponent(invite)}` : "/login");
}
