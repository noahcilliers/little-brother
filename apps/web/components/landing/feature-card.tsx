import "./feature-card.css";
import type { ReactNode } from "react";
import { PlayOnView } from "./play-on-view";

type Props = { title: string; size: string; children: ReactNode };

/** A bento card: a looping mini-scene above a heading. The scene is decorative. */
export function FeatureCard({ title, size, children }: Props) {
  return (
    <PlayOnView as="article" className={`feat ${size}`}>
      <div className="stage" aria-hidden="true">
        {children}
      </div>
      <div className="feat-copy">
        <h3>{title}</h3>
      </div>
    </PlayOnView>
  );
}
