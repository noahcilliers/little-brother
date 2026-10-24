import "./stack.css";

const TILES = [
  {
    role: "capture · nudge",
    name: "Claude Code",
    line: "Hooks report every prompt, edit and command. Denials, added context and channel pushes steer the agent back.",
    chips: ["hooks", "MCP", "channels"],
    size: "",
  },
  {
    role: "on your laptop",
    name: "lb connector",
    line: "Normalizes edits into files, symbols and topics locally. Only short diff previews leave the laptop, never whole files.",
    chips: ["TypeScript", "Node", "TS compiler API"],
    size: "",
  },
  {
    role: "backend",
    name: "Convex",
    line: "One deployment holds the realtime database, the hook and MCP endpoints, the classifier's scheduled jobs and the vector index of past work.",
    chips: ["realtime DB", "HTTP actions", "scheduler + crons", "vector index", "auth"],
    size: "w2",
  },
  {
    role: "judge · embeddings",
    name: "Gemini + Claude",
    line: "Gemini Flash-Lite judges close calls and Gemini embeddings index work by default; Claude is the alternative judge. Each sits behind a swappable interface.",
    chips: ["Gemini 3.x Flash-Lite", "gemini-embedding-001", "Claude judge", "Judge · Embedder"],
    size: "w2",
  },
  {
    role: "dashboard",
    name: "Next.js on Vercel",
    line: "The live board, decision popups, logs and the read-only watch view.",
    chips: ["Next.js 15", "React 19"],
    size: "",
  },
  {
    role: "sign-in",
    name: "Convex Auth",
    line: "Sign in with GitHub. Rooms, waiting rooms and session codes hang off that identity.",
    chips: ["GitHub OAuth"],
    size: "",
  },
] as const;

const TOOLING = ["Zod at every boundary", "Vitest", "Biome", "tsup", "pnpm monorepo"];

export function Stack() {
  return (
    <section id="stack">
      <div className="sec-head">
        <div>
          <span className="label">Tech stack</span>
          <h2>Small, boring, swappable</h2>
        </div>
        <p>Every model sits behind an interface, and every hook fails open.</p>
      </div>
      <div className="stack-grid">
        {TILES.map((t) => (
          <article key={t.name} className={`stack-tile ${t.size}`}>
            <span className="label">{t.role}</span>
            <h3>{t.name}</h3>
            <p>{t.line}</p>
            <ul className="chips">
              {t.chips.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </article>
        ))}
        <article className="stack-tile w4 tooling">
          <span className="label">tooling</span>
          <ul className="chips">
            {TOOLING.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
