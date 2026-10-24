import { LandingPage } from "@/components/landing/landing-page";
import { signedIn, siteOrigin } from "@/lib/server-site";

export default async function Home() {
  const [origin, authed] = await Promise.all([siteOrigin(), signedIn()]);
  return <LandingPage origin={origin} signedIn={authed} />;
}
