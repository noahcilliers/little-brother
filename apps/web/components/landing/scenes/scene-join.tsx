import "./scene-join.css";
import { Av, MiniTerm } from "../mini";

export function SceneJoin() {
  return (
    <div className="sc sc-join">
      <MiniTerm title="ash@mbp — ~/shop — claude">
        <p className="j-cmd">
          <span className="pr">&gt;</span> <span className="type">/little-brother:join k7f2qx</span>
          <i className="caret" />
        </p>
        <p className="j-out">
          <b className="acc">⎿</b> joined "checkout sprint" · tracking this session
        </p>
      </MiniTerm>
      <div className="lane j-lane">
        <Av who="ash" />
        <b>ash</b>
        <small>joined just now</small>
        <span className="j-track">
          <i />
        </span>
      </div>
    </div>
  );
}
