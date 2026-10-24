import { FeatureCard } from "./feature-card";
import { SceneBoard } from "./scenes/scene-board";
import { SceneConflict } from "./scenes/scene-conflict";
import { SceneDuplicate } from "./scenes/scene-duplicate";
import { SceneJoin } from "./scenes/scene-join";
import { SceneLog } from "./scenes/scene-log";
import { ScenePrune } from "./scenes/scene-prune";
import { SceneQr } from "./scenes/scene-qr";

export function Features() {
  return (
    <section id="features">
      <div className="sec-head">
        <div>
          <span className="label">Features</span>
          <h2>Every agent on one board, every catch before the edit</h2>
        </div>
        <p>
          Little Brother sits between your teammates' Claude Code sessions and steps in only when the work
          collides.
        </p>
      </div>
      <div className="bento">
        <FeatureCard
          size="s2"
          n="01 · join"
          title="Join from Claude Code"
          body="One slash command with the session code. Only sessions that join are tracked."
        >
          <SceneJoin />
        </FeatureCard>
        <FeatureCard
          size="s4"
          n="02 · duplicates"
          title="Catches duplicates before the first edit"
          body="When a second agent starts work that's already in progress, its edit is denied with a pointer to the first."
        >
          <SceneDuplicate />
        </FeatureCard>
        <FeatureCard
          size="s3"
          n="03 · failed paths"
          title="Prunes failed paths"
          body="A dead end becomes a lesson, so the next agent routes around it instead of spending the same nine minutes."
        >
          <ScenePrune />
        </FeatureCard>
        <FeatureCard
          size="s3"
          n="04 · conflicts"
          title="Conflicts git can't see"
          body="Two branches can merge cleanly and still break auth. Little Brother pauses that topic and asks the owner to pick one."
        >
          <SceneConflict />
        </FeatureCard>
        <FeatureCard
          size="s4"
          n="05 · live board"
          title="One live board for the whole team"
          body="One lane per person: goals, tasks and actions as they happen, with every catch as a toast."
        >
          <SceneBoard />
        </FeatureCard>
        <FeatureCard
          size="s2"
          n="06 · share"
          title="Bring anyone in with a QR"
          body="Phones scan the session QR, wait in the waiting room, and watch live once the host admits them."
        >
          <SceneQr />
        </FeatureCard>
        <FeatureCard
          size="s6"
          n="07 · explainable"
          title="Every verdict is explainable"
          body="Each catch logs its relation, what decided it, the confidence and the latency, next to the host's server log."
        >
          <SceneLog />
        </FeatureCard>
      </div>
    </section>
  );
}
