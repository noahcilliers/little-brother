# Deploying Little Brother

Little Brother has three parts, each delivered differently:

| Part                                    | Runs on      | Delivered by                                  |
| --------------------------------------- | ------------ | --------------------------------------------- |
| Backend: `packages/backend`             | Convex cloud | `npx convex deploy`, run by the Vercel build  |
| Dashboard and installer: `apps/web`     | Vercel       | a Git push to `main`                          |
| Connector: `lb`, a single file `lb.mjs` | each laptop  | `curl <site>/install.sh \| sh`                |
| Claude Code plugin: `plugin/`           | each laptop  | `claude plugin install` from this GitHub repo |

One person deploys once (Part A). Each teammate then connects their laptop (Part B), which takes about two minutes.

Throughout this guide, `<web>` stands for the dashboard origin, such as `https://little-brother.vercel.app`. `<convex-site>` stands for the Convex HTTP actions origin, such as `https://happy-otter-123.convex.site`.

---

## Part A: deploy (once, one person)

You need Node 20 or newer, pnpm 10, and accounts on Convex, Vercel and GitHub, plus a Gemini API key.

### A1. Create the Convex production deployment

```sh
pnpm install
cd packages/backend
npx convex login
npx convex deploy            # first run creates the project's production deployment and pushes functions
```

Note the two URLs it prints. The deployment URL is `https://<name>.convex.cloud`. The HTTP actions URL is `https://<name>.convex.site`, which is `<convex-site>`. If you miss them, both are in the production deployment's settings in the Convex dashboard.

### A2. Create the GitHub OAuth app

Go to GitHub, then **Settings → Developer settings → OAuth Apps → New OAuth App**, and fill in:
- **Homepage URL:** `<web>`
- **Authorization callback URL:** `<convex-site>/api/auth/callback/github`

For example: `https://happy-otter-123.convex.site/api/auth/callback/github`.

Then generate a client secret.

### A3. Set the Convex production environment

Run these from `packages/backend`. The `--prod` flag targets production. You can also set the variables in the dashboard under **Settings → Environment Variables**.

```sh
npx convex env set --prod GEMINI_API_KEY <key>
npx convex env set --prod GEMINI_JUDGE_MODELS gemini-3.5-flash-lite,gemini-3.1-flash-lite
npx convex env set --prod AUTH_GITHUB_ID <github oauth client id>
npx convex env set --prod AUTH_GITHUB_SECRET <github oauth client secret>
npx convex env set --prod SITE_URL <web>          # no trailing slash
npx @convex-dev/auth --prod                        # generates and sets JWT_PRIVATE_KEY and JWKS
```

If `npx @convex-dev/auth` can't run non-interactively, generate the key pair with the `generateKeys.mjs` script from the Convex Auth manual setup docs. Then set `JWT_PRIVATE_KEY` and `JWKS` with `npx convex env set --prod`.

> **Never** set `LB_ALLOW_INVITE` in production. It enables the shared invite code and opens the dashboard without sign-in. It exists only for the local e2e run.

### A4. Create the Vercel project

1. In Vercel, open **Add New → Project** and import the GitHub repo `noahcilliers/little-brother`.
2. Set **Root Directory** to `apps/web`. The framework is detected as Next.js. Leave **Include files outside the root directory** enabled, which is the default, because the build needs `packages/` and `scripts/`.
3. Leave the build command alone. `apps/web/vercel.json` sets it to:

   ```sh
   node ../../scripts/publish-connector.mjs \
     && cd ../../packages/backend \
     && npx convex deploy --cmd 'cd ../../apps/web && pnpm run build' --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL
   ```

   `publish-connector.mjs` bundles the connector into `public/lb.mjs` and writes `public/install.sh` with the site origin baked in. `convex deploy` then pushes the backend and runs `next build` with `NEXT_PUBLIC_CONVEX_URL` pointing at production.
4. Under **Environment Variables**, set:

   | Name                          | Value                                                                                                                            | Environments    |
   | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------- |
   | `CONVEX_DEPLOY_KEY`           | In the Convex dashboard, open the production deployment's **Deployment Settings → General** and generate a production deploy key | Production only |
   | `LB_PUBLIC_ORIGIN`            | `<web>`. Optional: when unset it defaults to the production Vercel domain. Set it once you use a custom domain                   | Production      |
   | `NEXT_PUBLIC_CONVEX_SITE_URL` | `<convex-site>`. Optional: by default it is derived from the cloud URL                                                           | Production      |

   `NEXT_PUBLIC_CONVEX_URL` needs no setting. `convex deploy` injects it into the build. If you build some other way, set it to `https://<name>.convex.cloud`.
5. Click **Deploy**. Then check:

   ```sh
   curl -fsSI <web>/install.sh | head -1    # HTTP/2 200
   curl -fsSL <web>/install.sh | head -4    # the comment shows `curl -fsSL <web>/install.sh | sh`
   ```

Preview deployments are optional. To enable them, generate a **Preview** deploy key in the Convex project settings and add it as `CONVEX_DEPLOY_KEY` for the Preview environment only.

### A5. Custom domain (optional)

1. In Vercel, add the domain under **Project → Settings → Domains** and create the DNS records it asks for.
2. Update the values that hold the origin:
   - `npx convex env set --prod SITE_URL https://lb.example.com`
   - In Vercel, set `LB_PUBLIC_ORIGIN=https://lb.example.com`.
   - Update the GitHub OAuth app's **Homepage URL**. The callback URL stays on `<convex-site>`.
3. Redeploy so that `install.sh` picks up the new origin.

### A6. Make the plugin installable

The plugin installs straight from this GitHub repo: `.claude-plugin/marketplace.json` lists `./plugin`. Push `main`. If the repo is private, every teammate needs Git access to it (for example `gh auth login`), because `claude plugin marketplace add` clones it.

---

## Part B: connect a laptop (each teammate)

Requirements: macOS or Linux, Node 20 or newer, git, and Claude Code.
1. **Sign in** at `<web>` with GitHub and open the connect page. It shows a one-time connect token (`lbc_…`). Tokens are single-use and expire after 24 hours.

2. **Install and join** in one command. Copy it from the page:

   ```sh
   curl -fsSL <web>/install.sh | sh -s -- join --url <web> --token lbc_XXXX
   ```

   Or run the two steps separately:

   ```sh
   curl -fsSL <web>/install.sh | sh
   lb join --url <web> --token lbc_XXXX
   ```

   The installer writes `~/.little-brother/bin/lb.mjs` and an `lb` shim in `~/.local/bin`. It never uses sudo and never edits shell files. If `~/.local/bin` isn't on your `PATH`, it prints the line to add. Add it, then open a new terminal. Re-running the installer updates `lb` in place.

3. **Install the Claude Code plugin:**

   ```sh
   claude plugin marketplace add noahcilliers/little-brother
   claude plugin install little-brother@little-brother
   ```

4. **Start Claude Code** in your repo with the task list and the push channel enabled:

   ```sh
   export CLAUDE_CODE_ENABLE_TODO_TOOLS=1      # put it in your shell rc to keep it
   claude --dangerously-load-development-channels plugin:little-brother@little-brother
   ```

   On first launch, choose **I am using this for local development** in the channel warning. The channel is a research preview, so it needs this flag. Without the flag everything still works except pushes into idle sessions; hook responses remain the guaranteed delivery path.

5. **Join a session.** On the site, create a room (or open a teammate's invite link) and create a session in it. In each Claude Code session that should take part, run `/little-brother:join <session code>`. Claude sessions that haven't joined are never recorded; `/little-brother:leave` stops sharing. From a terminal, `LB_SESSION=<code> claude …` joins at launch.

By default a room has a waiting room: opening its invite link, or running `/little-brother:join` before you're in the room, asks the host, who admits or denies you from the room or session page. A Claude session that asked joins by itself on its next prompt after being admitted. The host can switch the room to "anyone with the link" and remove members.

To update later, run `lb update` (or re-run the `curl … | sh` line; connectors from before sessions need the `curl` line once) for the connector, then run `claude plugin marketplace update little-brother`.

To uninstall, run `claude plugin uninstall little-brother@little-brother`, then `rm -r ~/.little-brother ~/.local/bin/lb`.

---

## Smoke test (2 minutes)

On a laptop that has finished Part B:
1. `lb --version` prints `0.1.0`. `command -v lb` prints `~/.local/bin/lb`.
2. `lb status` shows your handle, `site: <convex-site>`, `backend: reachable (HTTP 200, …)` and `outbox: 0 queued`.
3. In any git repo, start `claude` with the flags above, then:
   - Run `/mcp`. The little-brother `lb` server shows as **connected**.
   - Run `/little-brother:join <code>` with a session code from the site. Claude confirms the session and room in one line.
   - Ask: _"call the little-brother status tool"_. It answers with the session's activity, not "unavailable".
4. Open the session on `<web>/app`. Your lane appears with the prompt you just typed.
5. Optionally test with two people. Both edit the same function in the same repo on different branches. The second person gets a `[little-brother]` notice, and the dashboard shows the overlap.

---

## Troubleshooting

**`lb: command not found` (in hooks, or `/mcp` shows `lb` failed).** The hooks and the MCP server run `lb` from the `PATH` that Claude Code inherited.
- Check that `command -v lb` works in the terminal you launch `claude` from.
- A session started from an IDE or GUI launcher may have a minimal `PATH`. Launch `claude` from a terminal, or put `~/.local/bin` into the `PATH` your login shell exports (for example `~/.zprofile`).
- Last resort: symlink the shim into a directory already on that `PATH`, such as `ln -s ~/.local/bin/lb /opt/homebrew/bin/lb` on Apple Silicon Homebrew. You can also call the connector directly with `node ~/.little-brother/bin/lb.mjs`.
- The hooks fail open: when `lb` is missing, Claude Code only shows a hook error and keeps working.

**The installer says Node is too old.** Install Node 20 or newer from nodejs.org, Homebrew or nvm, then re-run. The shim looks up `node` on `PATH` at run time, so switching versions with nvm works. It falls back to the `node` that was on `PATH` at install time.

**`lb join` fails.**
- `connect token is invalid, used or expired`: get a fresh token from the connect page. Each token works once.
- `invite codes are disabled`: you used `--invite` against production. Use `--token` instead.
- `HTTP 404` or HTML instead of JSON: `--url` is wrong. Use `<web>` or `<convex-site>`, with no path.

**`lb status` shows unreachable, or the outbox grows.** The backend is down or the URL is wrong. Hooks keep queueing events in `~/.little-brother/outbox.jsonl` and replay them once the backend is reachable. Run any hook with `LB_DEBUG=1` to see the error on stderr:

```sh
echo '{}' | LB_DEBUG=1 lb hook SessionStart
```

**No channel pushes.**
- Make sure Claude Code started with `--dangerously-load-development-channels plugin:little-brother@little-brother`, in an interactive session. The flag is ignored with `-p`.
- On Team or Enterprise plans an admin must enable channels (`channelsEnabled`).
- Hook responses still deliver every notice, at the next prompt or tool call.

**The dashboard shows no tasks.** Export `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` before starting `claude`.

**`curl <web>/install.sh` returns HTML or a redirect.** The middleware is intercepting it. `/install.sh` and `/lb.mjs` must stay public, because they are static files in `apps/web/public`.

**The installer downloads from the wrong host.** `install.sh` bakes in the origin at build time. Override it for one run with `curl -fsSL <web>/install.sh | LB_ORIGIN=<web> sh`. To fix it for good, set `LB_PUBLIC_ORIGIN` in Vercel and redeploy.

**The Vercel build fails in `convex deploy`.** `CONVEX_DEPLOY_KEY` is missing, or it isn't scoped to this environment. Use a production key for Production.

**GitHub sign-in fails with `redirect_uri` mismatch.** The OAuth app's callback must be exactly `<convex-site>/api/auth/callback/github`. Also check that `SITE_URL` in Convex matches the origin you browse.

---

## Local development and e2e

```sh
pnpm install
(cd packages/backend && npx convex dev)      # local backend; HTTP actions on http://127.0.0.1:3211
pnpm --filter @lb/connector build             # dev build: apps/connector/dist/cli.js
pnpm --filter @lb/connector bundle            # distributable: apps/connector/dist/lb.mjs
node scripts/publish-connector.mjs            # also copy it, plus install.sh, into apps/web/public
scripts/e2e.sh                                # resets the LOCAL deployment and replays the demo
```

`scripts/e2e.sh` sets `LB_ALLOW_INVITE=1` on the local deployment and joins with `lb join --invite calhacks --as <handle>`. Don't point it at production: it runs `admin:reset`.
