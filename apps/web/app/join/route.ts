import { convexSiteUrl } from "@/lib/convex-urls";

// `lb join --url <this site>` posts here; the Convex HTTP route does the work. No cookies are read.
export async function POST(request: Request): Promise<Response> {
  try {
    const res = await fetch(`${convexSiteUrl()}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return Response.json({ error: "backend unreachable" }, { status: 502 });
  }
}
