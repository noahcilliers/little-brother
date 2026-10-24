---

name: little-brother
description: Team protocol for Little Brother, which coordinates this Claude Code session with teammates' sessions on the same repo. Use whenever a message, hook context, denial or channel push starts with [little-brother], when you make a design decision others depend on, learn a non-obvious fact about the codebase, or abandon an approach that failed.
---

# Little Brother team protocol

Little Brother only sees a Claude Code session after the user runs `/little-brother:join <code>` in it (or starts Claude with `LB_SESSION=<code>`). Until then nothing is shared and the tools below say so; don't suggest joining unless the user asks about coordinating with teammates. `/little-brother:leave` stops sharing.

Several Claude Code sessions, one per teammate, are working on this repo at the same time. Little Brother watches every prompt, edit and command, compares it with what the other sessions are doing and with approaches that already failed, and tells you about overlaps before you waste effort. The `lb` MCP server gives you the tools below.

## When you hear from Little Brother

Messages come in three ways:
- **A denied tool call** whose reason starts with `[little-brother]`. Another agent owns this work or it must land first.
- **Extra context** on a prompt or after a tool call: a list of items, each ending in `(ack: <id>)`.
- **A channel push** (`<channel source="lb" item_id="…" kind="…">`), which can arrive while you are idle.

How to respond:
1. **Obey denials. Don't route around them.** Never retry the same edit, write the file under another name, or make the change through Bash. Use the work the denial points to: import the owner's module, call their function, build on their branch's contract. If you truly can't continue without the blocked change, work on another part of the task and tell the user who owns the blocked part.
2. **Treat stale warnings as evidence.** If an approach is listed as already failed, don't try it again unless you have a concrete reason it will work this time, and say what that reason is. Prefer the approach recorded as working.
3. **Ack every item you receive**, once you've acted on it: `ack { itemId, outcome }`.
   - `applied`: you changed course because of it.
   - `acked`: you saw it and nothing needed to change.
   - `rejected`: you think it's wrong. Add a one-line `note` explaining why. A human will review it.
4. If a turn ends while blocking items are unacked, the Stop hook sends you back. Ack them; don't ignore them.

## Keep a task list

For any multi-step piece of work, keep your plan in the task list: `TaskCreate` one task per step (a short subject in your own words, like "Issue JWT tokens"), `TaskUpdate` it to `in_progress` when you start it and to `completed` when it's done. Teammates see your work as these tasks, and Little Brother attributes each edit and command to the task in progress. If those tools aren't available, use `TodoWrite` the same way.

## When to call the tools yourself

| Situation                                                                                                                                  | Tool                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| You picked something other agents must agree on, like an auth mechanism, an API shape, a schema or a shared type location                  | `post_decision { topic, value, rationale }` with a dotted topic such as `auth.mech` or `db.users` |
| You learned a durable, non-obvious fact others would otherwise rediscover, like "tests need `DATABASE_URL`" or "`/api` is proxied by Vite" | `post_knowledge { fact, files, topic? }`                                                          |
| An approach failed after real effort (more than one attempt, or it touched shared files)                                                   | `report_failure { tried, why, worked? }` before you move on                                       |
| You need something from another agent's area                                                                                               | `ask { question, to? }`. Check `inbox` later for the answer                                       |
| Someone asked you something                                                                                                                | `answer { questionId, body }`                                                                     |
| You're starting a sizeable task or are unsure who owns an area                                                                             | `status`                                                                                          |
| You want the full list of pending items                                                                                                    | `inbox`                                                                                           |

Keep every entry short and concrete: name files, symbols and commands. Never paste secrets or large code blocks. Facts and failures go to teammates' agents verbatim.

## Fail-open

If the tools report that Little Brother is unavailable, keep working normally. The hooks never block you when the backend is down, and queued events sync later.
