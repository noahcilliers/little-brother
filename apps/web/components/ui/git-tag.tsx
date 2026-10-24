import { clsx } from "clsx";
import { type GitStatus, gitLabel } from "@/lib/git";

/** What a real merge said about a verdict; a live miss is inverted with a dashed outline so it can't blend in. */
export function GitTag({ status }: { status: GitStatus | undefined }) {
  if (!status) return null;
  return <span className={clsx("vt", `git-${status}`)}>{gitLabel(status)}</span>;
}
