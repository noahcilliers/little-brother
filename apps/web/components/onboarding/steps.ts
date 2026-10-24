export const STEPS = [
  { id: "workspace", label: "Workspace" },
  { id: "connect", label: "Laptop" },
  { id: "plugin", label: "Plugin" },
  { id: "session", label: "Session" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

export const isStep = (s: string | null): s is StepId => STEPS.some((x) => x.id === s);

/** What the wizard carries between steps in the URL, so a refresh lands on the same screen. */
export type Carry = { room: string | null; session: string | null; invite: string | null };

export function stepHref(step: StepId, carry: Carry): string {
  const q = new URLSearchParams({ step });
  if (carry.room) q.set("room", carry.room);
  if (carry.session) q.set("session", carry.session);
  if (carry.invite) q.set("invite", carry.invite);
  return `/onboarding?${q.toString()}`;
}

export const neighbour = (step: StepId, by: 1 | -1): StepId | null =>
  STEPS[STEPS.findIndex((s) => s.id === step) + by]?.id ?? null;
