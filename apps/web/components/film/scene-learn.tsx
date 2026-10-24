import { prog } from "./film-clock";
import { rise } from "./film-fx";
import { LearnTree } from "./learn-tree";

// Scene 5: learning, shown as one picture: a failed path becomes a lesson and the next agent goes around it
// (classify/lessons.ts). Decisions labelling verdicts is the same loop, left to the docs to keep this scene quiet.

const T0 = 0.4;

export function SceneLearn({ s }: { s: number }) {
  return (
    <div className="fx-learn">
      <h2 className="fx-title">
        <span className="fh-mask">
          <span style={rise(prog(s, T0 - 0.2, 0.5))}>It learns from every mistake.</span>
        </span>
      </h2>
      <div className="fx-learn-tree">
        <LearnTree s={s} />
      </div>
    </div>
  );
}
