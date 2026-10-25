import "./stack.css";

const TILES = [
  {
    name: "Claude Code",
    chips: ["hooks", "MCP", "channels"],
    size: "",
  },
  {
    name: "lb connector",
    chips: ["TypeScript", "Node", "TS compiler API"],
    size: "",
  },
  {
    name: "Convex",
    chips: ["realtime DB", "HTTP actions", "scheduler + crons", "vector index", "auth"],
    size: "w2",
  },
  {
    name: "Gemini + Claude",
    chips: ["Gemini 3.x Flash-Lite", "gemini-embedding-001", "Claude judge", "Judge · Embedder"],
    size: "w2",
  },
  {
    name: "Next.js on Vercel",
    chips: ["Next.js 15", "React 19"],
    size: "",
  },
  {
    name: "Convex Auth",
    chips: ["GitHub OAuth"],
    size: "",
  },
] as const;

const TOOLING = ["Zod at every boundary", "Vitest", "Biome", "tsup", "pnpm monorepo"];

export function Stack() {
  return (
    <section id="stack">
      <div className="sec-head">
        <h2>Small, boring, swappable</h2>
        <p>Every model sits behind an interface, and every hook fails open.</p>
      </div>
      <div className="stack-grid">
        {TILES.map((t) => (
          <article key={t.name} className={`stack-tile ${t.size}`}>
            <h3>{t.name}</h3>
            <ul className="chips">
              {t.chips.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </article>
        ))}
        <article className="stack-tile w4 tooling">
          <h3>Tooling</h3>
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
