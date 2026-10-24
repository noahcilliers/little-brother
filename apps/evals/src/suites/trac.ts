import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { sh } from "../exec";
import { CACHE } from "./python-env";

/** A PR body without its template: HTML comments, the checklist and the Trac/branch headings. */
export function cleanBody(body: string): string {
  return body
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\r/g, "")
    .split("\n")
    .filter(
      (l) =>
        !/^\s*-\s*\[[ xX]\]/.test(l) && !/^#+\s*(Trac ticket number|Branch description|Checklist)/i.test(l),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** RFC 4180 records: quoted fields may hold commas, newlines and doubled quotes. */
export function csvRecords(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

/** The Trac ticket's own description, cached; empty when offline or the ticket can't be read. */
export function tracDescription(ticket: string): string {
  const dir = join(CACHE, "trac");
  const file = join(dir, `${ticket}.txt`);
  if (existsSync(file)) return readFileSync(file, "utf8");
  mkdirSync(dir, { recursive: true });
  const r = sh(
    "curl",
    ["-sfL", "--max-time", "20", `https://code.djangoproject.com/ticket/${ticket}?format=csv`],
    homedir(),
  );
  if (!r.ok) return "";
  const [header, row] = csvRecords(r.out.replace(/^\uFEFF/, ""));
  const desc = row?.[header?.indexOf("description") ?? -1] ?? "";
  writeFileSync(file, desc);
  return desc;
}

/** Title and cleaned body; a body that is only template gets the Trac ticket's description instead. */
export function prDescription(title: string, body: string): string {
  const cleaned = cleanBody(body);
  const ticket = /#(\d{4,6})\b/.exec(title)?.[1] ?? /ticket-(\d{4,6})/.exec(body)?.[1];
  const trac = cleaned.length < 200 && ticket ? tracDescription(ticket).trim().slice(0, 3000) : "";
  return [`Title: ${title}`, cleaned && `Description:\n${cleaned}`, trac && `Ticket #${ticket}:\n${trac}`]
    .filter(Boolean)
    .join("\n\n");
}
