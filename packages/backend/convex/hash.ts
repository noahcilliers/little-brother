async function digestHex(algo: "SHA-1" | "SHA-256", text: string): Promise<string> {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const sha256Hex = (text: string) => digestHex("SHA-256", text);
export const sha1Hex = (text: string) => digestHex("SHA-1", text);

export function randomToken(bytes = 24): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(raw, (b) => b.toString(16).padStart(2, "0")).join("");
}
