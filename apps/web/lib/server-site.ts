import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { headers } from "next/headers";

/** This site's public origin, for the copy-paste commands. Behind a proxy, trust its forwarded headers. */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Signed in? False when the backend is unreachable or auth isn't configured, so public pages still render. */
export async function signedIn(): Promise<boolean> {
  try {
    return await isAuthenticatedNextjs();
  } catch {
    return false;
  }
}
