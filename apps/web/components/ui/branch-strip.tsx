import { clsx } from "clsx";
import { type GitOp, gitOpText, type Landed, landedText, shortSha } from "@/lib/git";

type Branch = {
  branch: string;
  baseRev?: string;
  git?: GitOp;
  landed: Record<Landed, number>;
};

/** Branch, base commit, last git op and landed counts, on two mono lines. Failed ops are struck through. */
export function BranchStrip({ a, className }: { a: Branch; className?: string }) {
  return (
    <span className={clsx("bstrip", className)}>
      <span>
        {a.branch || "—"}
        {a.baseRev ? <span className="faint"> @ {shortSha(a.baseRev)}</span> : null}
      </span>
      <span className="faint">
        {a.git ? <span className={clsx(!a.git.ok && "struck")}>{gitOpText(a.git)}</span> : "no git op yet"}
        {" · "}
        {landedText(a.landed)}
      </span>
    </span>
  );
}
