/**
 * String equality whose running time doesn't depend on where the inputs first differ, for comparing a
 * presented secret against the configured one. Hash both sides first when lengths may differ: the loop
 * still runs over the longer input, but a length mismatch is visible to a patient caller.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const n = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
