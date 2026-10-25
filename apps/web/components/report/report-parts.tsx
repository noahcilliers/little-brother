import type { ReactNode } from "react";
import { REPO, SRC } from "./report-data";

/** A numbered report section with an anchor. */
export function Section({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="rp-sec">
      <h2>
        <a href={`#${id}`}>
          <span className="rp-n">{n}</span> {title}
        </a>
      </h2>
      {children}
    </section>
  );
}

/** A link to the repo file a number comes from. */
export function Src({ k }: { k: keyof typeof SRC }) {
  return (
    <a className="rp-src" href={`${REPO}${SRC[k]}`}>
      {SRC[k]}
    </a>
  );
}

/** A plain table: header row, then rows of cells. */
export function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="rp-table">
      <table>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r[0])}>
              {r.map((c, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: cells of a fixed row never reorder
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
