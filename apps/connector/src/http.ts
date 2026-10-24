import type { request as httpRequest } from "node:http";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
  }
}

// Every hook is a fresh process, so client start-up is paid per call: fetch costs ~20 ms to set up, node:http
// ~3 ms. TLS is loaded only for https sites (~5 ms more), so a local backend never pays for it.
async function requester(protocol: string): Promise<typeof httpRequest> {
  return protocol === "https:" ? (await import("node:https")).request : (await import("node:http")).request;
}

export async function postJson(
  url: string,
  body: unknown,
  opts: { token?: string; timeoutMs?: number } = {},
): Promise<unknown> {
  const target = new URL(url);
  const payload = JSON.stringify(body);
  const headers: Record<string, string | number> = {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const request = await requester(target.protocol);
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const { status, text } = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const fail = (e: Error) => {
      clearTimeout(timer);
      reject(e);
    };
    const req = request(target, { method: "POST", headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("error", fail);
      res.on("end", () => {
        clearTimeout(timer);
        resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") });
      });
    });
    // A deadline for the whole exchange, as AbortSignal.timeout gave fetch; socket timeouts only cover idle gaps.
    const timer = setTimeout(() => req.destroy(new Error(`timed out after ${timeoutMs} ms`)), timeoutMs);
    req.on("error", fail);
    req.end(payload);
  });
  if (status < 200 || status >= 300) throw new HttpError(status, text);
  return text ? JSON.parse(text) : null;
}
