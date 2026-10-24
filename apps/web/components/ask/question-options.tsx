import type { RefObject } from "react";
import type { AskQuestion } from "@/lib/api";
import { choose, chooseOther, type Pick } from "@/lib/ask-form";

type Props = {
  q: AskQuestion;
  /** Position of the question, for the input group name. */
  index: number;
  pick: Pick;
  onChange: (p: Pick) => void;
  otherRef: RefObject<HTMLInputElement | null>;
};

/** One question: its text, numbered options (radio, or checkboxes when several may apply) and Other. */
export function QuestionOptions({ q, index, pick, onChange, otherRef }: Props) {
  const multi = q.multiSelect === true;
  const type = multi ? "checkbox" : "radio";
  const name = `ask-${index}`;
  return (
    <fieldset className="ask-q">
      <legend className="ask-text">{q.question}</legend>
      {multi ? <p className="ask-hint">Pick any that apply</p> : null}
      <div className="ask-opts">
        {q.options.map((o, i) => {
          const on = pick.selected.includes(o.label);
          return (
            <label key={o.label} className={on ? "ask-opt on" : "ask-opt"}>
              <input
                type={type}
                name={name}
                checked={on}
                onChange={() => onChange(choose(pick, o.label, multi))}
              />
              <span className="ask-n">{i + 1}</span>
              <span className="ask-body">
                <b>{o.label}</b>
                {o.description ? <small>{o.description}</small> : null}
              </span>
            </label>
          );
        })}
        <div className={pick.otherOn ? "ask-opt ask-other on" : "ask-opt ask-other"}>
          <input
            type={type}
            name={name}
            aria-label="Other"
            checked={pick.otherOn}
            onChange={() => {
              onChange(chooseOther(pick, multi, multi ? !pick.otherOn : true));
              otherRef.current?.focus();
            }}
          />
          <span className="ask-n">{q.options.length + 1}</span>
          <input
            ref={otherRef}
            type="text"
            className="ask-other-text"
            placeholder="Other…"
            aria-label="Other answer"
            value={pick.other}
            onFocus={() => (pick.otherOn ? undefined : onChange(chooseOther(pick, multi, true)))}
            onChange={(e) => onChange({ ...chooseOther(pick, multi, true), other: e.target.value })}
          />
        </div>
      </div>
    </fieldset>
  );
}
