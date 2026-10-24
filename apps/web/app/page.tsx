import { LandingPage } from "@/components/landing/landing-page";
import { siteOrigin, signedIn } from "@/lib/server-site";

export default async function Home() {
  const [origin, authed] = await Promise.all([siteOrigin(), signedIn()]);
  return <LandingPage origin={origin} signedIn={authed} />;
}
