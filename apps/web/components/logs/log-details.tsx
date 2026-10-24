import { type LogRow, logDate, SOURCE_LABEL } from "@/lib/log-rows";
import { Badge, type Tone } from "../ui/badge";
import { VerdictDetails } from "./verdict-details";

const TONE: Record<LogRow["level"], Tone> = { info: "neutral", warn: "warn", error: "danger" };

/** The drawer body for one log line: full text and every field we have. */
export function LogDetails({ row }: { row: LogRow }) {
  return (
    <div className="log-details">
      <div className="detail-badges">
        <Badge tone={TONE[row.level]}>{row.level}</Badge>
        <Badge>{SOURCE_LABEL[row.source]}</Badge>
        <span className="muted mono">{logDate(row.at)}</span>
      </div>
      {row.verdict ? (
        <VerdictDetails verdict={row.verdict} />
      ) : (
        <>
          <pre className="detail-pre">{row.message}</pre>
          <dl className="meta-list">
            <dt>Kind</dt>
            <dd>{row.kind}</dd>
            <dt>Who</dt>
            <dd>@{row.who}</dd>
            {row.session !== null ? (
              <>
                <dt>Session</dt>
                <dd>{row.session}</dd>
              </>
            ) : null}
            <dt>Id</dt>
            <dd className="mono">{row.id}</dd>
          </dl>
        </>
      )}
    </div>
  );
}
