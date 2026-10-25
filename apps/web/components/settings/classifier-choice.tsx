"use client";

import { useMutation, useQuery } from "convex/react";
import { api, type Room } from "@/lib/api";
import { useAction } from "@/lib/use-action";
import { FormError } from "../ui/field";

type Choice = "model+gemini" | "model+claude" | "gemini" | "claude" | "model" | "rules";
type Needs = { model?: boolean; gemini?: boolean; claude?: boolean };

const CHOICES: { id: Choice; label: string; hint: string; needs: Needs }[] = [
  {
    id: "model+gemini",
    label: "Little Brother model + Gemini",
    hint: "Our classifier decides in milliseconds; Gemini judges only what it's unsure about. Recommended.",
    needs: { model: true, gemini: true },
  },
  {
    id: "model+claude",
    label: "Little Brother model + Claude",
    hint: "Same, with Claude as the judge for uncertain pairs.",
    needs: { model: true, claude: true },
  },
  { id: "gemini", label: "Gemini only", hint: "Every open pair goes to Gemini.", needs: { gemini: true } },
  { id: "claude", label: "Claude only", hint: "Every open pair goes to Claude.", needs: { claude: true } },
  {
    id: "model",
    label: "Little Brother model only",
    hint: "No LLM calls at all; rules and our model.",
    needs: { model: true },
  },
  { id: "rules", label: "Rules only", hint: "Deterministic checks, nothing learned.", needs: {} },
];

/** Host only: which classifier the room runs. Options whose key or model this deployment lacks are disabled. */
export function ClassifierChoice({ room }: { room: Room }) {
  const options = useQuery(api.roomAdmin.classifierOptions, { roomId: room.id });
  const set = useMutation(api.roomAdmin.setClassifier);
  const { busy, error, run } = useAction();
  if (!options) return null;
  const missing = (n: Needs) =>
    [
      n.model && !options.model ? "our model" : "",
      n.gemini && !options.gemini ? "a Gemini key" : "",
      n.claude && !options.claude ? "an Anthropic key" : "",
    ].filter(Boolean);
  return (
    <div className="stack-sm">
      <div className="choices-grid" role="radiogroup" aria-label="Classifier">
        {CHOICES.map((c) => {
          const lacks = missing(c.needs);
          return (
            <label key={c.id} className="choice-card" aria-disabled={lacks.length > 0}>
              <input
                type="radio"
                name="classifier"
                checked={options.current === c.id}
                disabled={busy || !options.isHost || lacks.length > 0}
                onChange={() => void run(() => set({ roomId: room.id, classifier: c.id }))}
              />
              <span>
                <b>{c.label}</b>
                <small>{lacks.length ? `Needs ${lacks.join(" and ")} on this deployment.` : c.hint}</small>
              </span>
            </label>
          );
        })}
      </div>
      {options.model ? <small className="muted">Model in use: {options.model}</small> : null}
      <FormError error={error} />
    </div>
  );
}
