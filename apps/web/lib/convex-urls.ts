const LOCAL_CONVEX = "http://127.0.0.1:3210";

export const convexUrl = (): string => process.env.NEXT_PUBLIC_CONVEX_URL ?? LOCAL_CONVEX;

/** HTTP actions live on *.convex.site for cloud deployments and one port up for a local backend. */
export function convexSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const url = new URL(convexUrl());
  if (url.hostname.endsWith(".convex.cloud")) return url.origin.replace(/\.convex\.cloud$/, ".convex.site");
  if (url.port) url.port = String(Number(url.port) + 1);
  return url.origin;
}
