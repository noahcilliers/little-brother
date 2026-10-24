import type { AskQuestion } from "./api";

/** How long `lb ask` waits for the website before Claude Code asks in the terminal (LB_ASK_TIMEOUT_MS). */
export const ASK_WAIT_MS = 540_000;

/** One question's answer while it is being chosen. */
export type Pick = { selected: string[]; otherOn: boolean; other: string };
export type AskAnswer = { question: string; selected: string[]; other?: string };

export const emptyPick = (): Pick => ({ selected: [], otherOn: false, other: "" });

/** Single-select replaces the choice (and leaves Other); multi-select toggles it. */
export function choose(p: Pick, label: string, multi: boolean): Pick {
  if (!multi) return { ...p, selected: [label], otherOn: false };
  const on = p.selected.includes(label);
  return { ...p, selected: on ? p.selected.filter((l) => l !== label) : [...p.selected, label] };
}

/** Other is one more choice: exclusive in single-select, a toggle beside the rest in multi-select. */
export function chooseOther(p: Pick, multi: boolean, on: boolean): Pick {
  return multi ? { ...p, otherOn: on } : { ...p, selected: on ? [] : p.selected, otherOn: on };
}

export const isAnswered = (p: Pick | undefined): boolean =>
  p !== undefined && (p.selected.length > 0 || (p.otherOn && p.other.trim().length > 0));

export function toAnswers(questions: AskQuestion[], picks: Pick[]): AskAnswer[] {
  return questions.map((q, i) => {
    const p = picks[i] ?? emptyPick();
    const other = p.otherOn ? p.other.trim() : "";
    return other
      ? { question: q.question, selected: p.selected, other }
      : { question: q.question, selected: p.selected };
  });
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s} s ago` : `${Math.floor(s / 60)} min ago`;
}

/** Whole minutes left before the terminal takes the question back; 0 once it has. */
export function minutesLeft(at: number, now: number): number {
  return Math.max(0, Math.ceil((at + ASK_WAIT_MS - now) / 60_000));
}
