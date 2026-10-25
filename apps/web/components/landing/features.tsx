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
        <h2>Every agent on one board, every catch before the edit</h2>
      </div>
      <div className="bento">
        <FeatureCard size="s2" title="Join from Claude Code">
          <SceneJoin />
        </FeatureCard>
        <FeatureCard size="s4" title="Catches duplicates before the first edit">
          <SceneDuplicate />
        </FeatureCard>
        <FeatureCard size="s3" title="Prunes failed paths">
          <ScenePrune />
        </FeatureCard>
        <FeatureCard size="s3" title="Conflicts git can't see">
          <SceneConflict />
        </FeatureCard>
        <FeatureCard size="s4" title="One live board for the whole team">
          <SceneBoard />
        </FeatureCard>
        <FeatureCard size="s2" title="Bring anyone in with a QR">
          <SceneQr />
        </FeatureCard>
        <FeatureCard size="s6" title="Every verdict is explainable">
          <SceneLog />
        </FeatureCard>
      </div>
    </section>
  );
}
