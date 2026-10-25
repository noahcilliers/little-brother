"use client";

import { type ClassifierPlan, classifierChoiceOf, classifierPlan } from "@lb/core";
import { useMutation, useQuery } from "convex/react";
import { api, type Room } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { FormError } from "../ui/field";

type Judge = ClassifierPlan["judge"];
type Option<T> = { id: T; label: string; hint: string; recommended?: boolean; lacks?: string };

const JUDGE_NAME: Record<Judge, string> = { gemini: "Gemini", claude: "Claude", none: "nothing" };

function Step<T extends string | boolean>(props: {
  n: number;
  title: string;
  hint: string;
  name: string;
  options: Option<T>[];
  value: T;
  locked: boolean;
  onPick: (v: T) => void;
}) {
  return (
    <section className="clf-step" aria-label={props.title}>
      <header className="clf-head">
        <span className="clf-num">{props.n}</span>
        <span>
          <b>{props.title}</b>
          <small>{props.hint}</small>
        </span>
      </header>
      <div className={props.options.length === 3 ? "choices-grid three" : "choices-grid"} role="radiogroup">
        {props.options.map((o) => (
          <label key={String(o.id)} className="choice-card" aria-disabled={o.lacks !== undefined}>
            <input
              type="radio"
              name={props.name}
              checked={props.value === o.id}
              disabled={props.locked || o.lacks !== undefined}
              onChange={() => props.onPick(o.id)}
            />
            <span>
              <b>
                {o.label}
                {o.recommended ? <em className="clf-rec">Recommended</em> : null}
              </b>
              <small>{o.lacks ? `Needs ${o.lacks} on this deployment.` : o.hint}</small>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

/**
 * Host only: how the room classifies. Two steps, as the cascade runs: a first pass on every pair (rules, plus our
 * trained model if chosen), then an LLM judge for the pairs the first pass isn't sure about.
 */
export function ClassifierChoice({ room }: { room: Room }) {
  const options = useQuery(api.roomAdmin.classifierOptions, { roomId: room.id });
  const set = useMutation(api.roomAdmin.setClassifier);
  const { busy, error, run } = useAction();
  if (!options) return null;
  const plan = classifierPlan(options.current);
  const locked = busy || !options.isHost;
  const pick = (next: ClassifierPlan) =>
    void run(() => set({ roomId: room.id, classifier: classifierChoiceOf(next) }));

  const first: Option<boolean>[] = [
    {
      id: true,
      label: "Rules + Little Brother model",
      hint: "Our trained model settles the pairs it's sure of in under a millisecond.",
      recommended: true,
      ...(options.model ? {} : { lacks: "a trained model" }),
    },
    { id: false, label: "Rules only", hint: "Deterministic checks. Nothing learned." },
  ];
  const judges: Option<Judge>[] = [
    {
      id: "gemini",
      label: "Gemini",
      hint: "Judges unsure pairs and compares conflicting code.",
      recommended: true,
      ...(options.gemini ? {} : { lacks: "a Gemini key" }),
    },
    {
      id: "claude",
      label: "Claude",
      hint: "Same job, with Claude as the judge.",
      ...(options.claude ? {} : { lacks: "an Anthropic key" }),
    },
    { id: "none", label: "None", hint: "No LLM calls. Unsure pairs aren't flagged." },
  ];
  const flow = ["Rules", ...(plan.pairModel ? ["Little Brother model"] : []), JUDGE_NAME[plan.judge]];

  return (
    <div className="clf">
      <Step
        n={1}
        title="First pass"
        hint="Runs on every pair, inside the hook's time budget."
        name="classifier-first"
        options={first}
        value={plan.pairModel}
        locked={locked}
        onPick={(pairModel) => pick({ ...plan, pairModel })}
      />
      <Step
        n={2}
        title="Escalation"
        hint="Only for pairs the first pass isn't sure about. Runs in the background."
        name="classifier-judge"
        options={judges}
        value={plan.judge}
        locked={locked}
        onPick={(judge) => pick({ ...plan, judge })}
      />
      <p className="clf-flow" aria-label="Current pipeline">
        {flow
          .filter((s) => s !== "nothing")
          .map((s, i) => (
            <span key={s}>
              {i > 0 ? <i aria-hidden="true">→</i> : null}
              <code>{s}</code>
            </span>
          ))}
        {options.model && plan.pairModel ? <small>model {options.model}</small> : null}
      </p>
      {!options.isHost ? <small className="muted">Only the room's host can change this.</small> : null}
      <FormError error={error} />
    </div>
  );
}
