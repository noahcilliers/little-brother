export class HttpError extends Error {
  constructor(
    readonly status: number,
    body: string,
  ) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
  }
}

export async function postJson(
  url: string,
  body: unknown,
  opts: { token?: string; timeoutMs?: number } = {},
): Promise<unknown> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(res.status, text);
  return text ? JSON.parse(text) : null;
}
