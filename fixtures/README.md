# Fixtures

| Path             | What                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `hooks/*.json`   | One Claude Code hook stdin payload per event, matching `HookInput` (`packages/core/src/hooks.ts`) |
| `scenario.jsonl` | The full demo story (PLAN §8) for `lb replay`                                                     |
| `expected.md`    | What Little Brother must output at each scenario step: the e2e acceptance oracle                  |
| `scripts/`       | Generator for the two above, built from the real files in `demo/shop` and `demo/solution`         |
| `test/`          | Validates every payload against `HookInput` and every MCP line against `McpArgs`                  |

```sh
npx tsx fixtures/scripts/build-scenario.ts   # regenerate scenario.jsonl + hooks/*.json (from repo root)
npx vitest run fixtures                       # validate
```

## `scenario.jsonl` format

One JSON object per line, in order:

```jsonc
{ "step": "14-joshua-users.pre", "delayMs": 3000, "as": "joshua", "cwd": "/tmp/lb-demo/joshua", "input": { /* HookInput */ } }
{ "step": "23-noah-decision", "delayMs": 2000, "as": "noah", "cwd": "/tmp/lb-demo/noah", "mcp": "post_decision", "args": { /* McpArgs.post_decision */ } }
```

- `delayMs`: wait this long after the previous line before sending this one.
- `as`: which agent (`noah` | `joshua` | `ash`); each has its own fixed `session_id`.
- `input`: pipe to `lb hook` as stdin, run with `cwd` as the working directory (so repo/branch resolve per agent).
- `mcp` + `args`: an MCP tool call by that agent's session (call it as `lb mcp` would for `session_id` of `as`).
  Lines without `input` are MCP calls; a replayer that can't do MCP may skip them.
- Denied tool calls have only a `.pre` line, because Claude Code never runs a denied tool.
- `Edit` `old_string`s are exact against each agent's worktree (main + that agent's earlier edits), and
  file contents are real TypeScript, so the connector's TS-compiler normalizer sees genuine symbols.

## Per-agent repos on one machine

The `cwd`s are `/tmp/lb-demo/{noah,joshua,ash}`: three worktrees of one demo repo, one per branch.

```sh
demo/setup.sh /tmp/lb-demo/shop --worktrees   # repo on main + worktrees noah (noah/auth), joshua (joshua/checkout), ash (ash/frontend)
```

which is the same as `demo/setup.sh /tmp/lb-demo/shop` followed by
`git -C /tmp/lb-demo/shop worktree add /tmp/lb-demo/noah noah/auth` (and likewise for joshua, ash).
Replay sends hook payloads only; it doesn't write files into the worktrees. On macOS a live Claude Code session
would report `/private/tmp/...` as `cwd`; the fixtures use `/tmp/...`.
