# Little Brother

Little Brother is a coordination layer for teammates who each run their own Claude Code session on the same repo. It watches every session's prompts, edits and commands. When two agents start the same work, or one of them breaks a contract another relies on, it warns them early. It also warns before an agent retries an approach a teammate already saw fail.
- **Deploy it** (once per team): see [DEPLOY.md](DEPLOY.md#part-a-deploy-once-one-person).
- **Connect a laptop:** see [DEPLOY.md](DEPLOY.md#part-b-connect-a-laptop-each-teammate). In short:

  ```sh
  curl -fsSL <site>/install.sh | sh -s -- join --url <site> --token <connect token from the site>
  claude plugin marketplace add noahcilliers/little-brother
  claude plugin install little-brother@little-brother
  CLAUDE_CODE_ENABLE_TODO_TOOLS=1 claude --dangerously-load-development-channels plugin:little-brother@little-brother
  ```

- **Use it:** sign in on the site, create a room (or open a teammate's invite link), and create a session in it. Then, in each Claude Code session that should take part, run:

  ```
  /little-brother:join <session code>
  ```

  Only Claude sessions that joined are recorded; every other prompt on the laptop stays local. `/little-brother:leave` stops sharing, and `LB_SESSION=<code> claude` joins from the terminal.

- **Design:** [docs/PLAN.md](docs/PLAN.md) covers the design and [docs/conflict-classifier-spec.md](docs/conflict-classifier-spec.md) covers the classifier.
- **Demo:** [demo/README.md](demo/README.md).

## Layout

| Path               | What                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------- |
| `packages/core`    | Shared schemas and pure logic                                                         |
| `packages/backend` | Convex backend: ingest, classifier cascade, HTTP routes                               |
| `apps/web`         | Next.js dashboard, sign-in and connector downloads                                    |
| `apps/connector`   | `lb` CLI: hook pipe, stdio MCP server, `join`, `verify`                               |
| `plugin/`          | Claude Code plugin: hooks, MCP and skill. Listed in `.claude-plugin/marketplace.json` |

## Develop

```sh
pnpm install
pnpm dev        # Convex dev + web + connector watch
pnpm test
pnpm check      # biome + tsc
```

Conventions are in [CLAUDE.md](CLAUDE.md). For the local end-to-end replay, see [DEPLOY.md](DEPLOY.md#local-development-and-e2e).
