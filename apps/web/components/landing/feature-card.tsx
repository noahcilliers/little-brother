import "./feature-card.css";
import type { ReactNode } from "react";
import { PlayOnView } from "./play-on-view";

type Props = { n: string; title: string; body: string; size: string; children: ReactNode };

/** A bento card: a looping mini-scene above a heading and one sentence. The scene is decorative. */
export function FeatureCard({ n, title, body, size, children }: Props) {
  return (
    <PlayOnView as="article" className={`feat ${size}`}>
      <div className="stage" aria-hidden="true">
        {children}
      </div>
      <div className="feat-copy">
        <span className="label">{n}</span>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </PlayOnView>
  );
}
