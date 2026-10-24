import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { envelope, makeT, type T } from "./platformHelpers";

const post = (t: T, path: string, body: unknown, token?: string) =>
  t.fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });

/** Convex Auth puts `<userId>|<sessionId>` in the JWT subject. */
async function signedIn(t: T, login: string) {
  const userId: Id<"users"> = await t.run((ctx) =>
    ctx.db.insert("users", { name: login, githubLogin: login, image: `https://a/${login}.png` }),
  );
  const as = t.withIdentity({ subject: `${userId}|session-${login}` });
  await as.mutation(api.team.ensureAccount, {});
  return as;
}

/** A connector token for this signed-in member, the way `lb join --token` gets one. */
async function connector(t: T, as: Awaited<ReturnType<typeof signedIn>>): Promise<string> {
  const { token } = await as.mutation(api.devices.create, { label: "mbp" });
  const res = await post(t, "/join", { token, machine: "mbp" });
  return ((await res.json()) as { token: string }).token;
}

describe("rooms, sessions and connect tokens", () => {
  afterEach(() => vi.unstubAllEnvs());

  test("anyone creates rooms; others join by the current invite and can leave", async () => {
    vi.stubEnv("LB_ALLOW_INVITE", "0");
    const t = makeT();
    const ash = await signedIn(t, "Ash");
    const { roomId } = await ash.mutation(api.rooms.create, { name: "cal" });
    const room = await ash.query(api.rooms.get, { roomId });
    expect(room?.isOwner).toBe(true);
    const invite = room?.inviteCode ?? "";

    const noah = await signedIn(t, "noah");
    expect(await noah.query(api.rooms.get, { roomId })).toBeNull();
    await expect(noah.mutation(api.rooms.join, { invite: "nope" })).rejects.toThrow(/no longer valid/);
    const rotated = await ash.mutation(api.rooms.rotateInvite, { roomId });
    await expect(noah.mutation(api.rooms.join, { invite })).rejects.toThrow(/no longer valid/);
    expect((await noah.mutation(api.rooms.join, { invite: rotated.inviteCode })).status).toBe("pending");
    expect(await noah.query(api.rooms.mine, {})).toEqual([]);
    const [req] = await ash.query(api.roomAdmin.requests, { roomId });
    expect(req).toMatchObject({ handle: "noah", via: "link" });
    expect(await noah.query(api.roomAdmin.requests, { roomId })).toEqual([]);
    await ash.mutation(api.roomAdmin.decide, { requestId: req?.id ?? ("" as never), admit: true });
    expect(await noah.query(api.roomAdmin.myStatus, { roomId })).toBe("member");
    expect((await noah.query(api.rooms.mine, {})).map((r) => r.name)).toEqual(["cal"]);
    await expect(noah.mutation(api.rooms.rotateInvite, { roomId })).rejects.toThrow(/owner/);

    await ash.mutation(api.rooms.leave, { roomId });
    expect(await ash.query(api.rooms.get, { roomId })).toBeNull();
    expect((await noah.query(api.rooms.get, { roomId }))?.isOwner).toBe(true);
  });

  test("hooks are recorded only for a Claude session that joined an open session in your room", async () => {
    vi.stubEnv("LB_ALLOW_INVITE", "0");
    const t = makeT();
    const ash = await signedIn(t, "ash");
    const { roomId } = await ash.mutation(api.rooms.create, { name: "cal" });
    const { sessionId, code } = await ash.mutation(api.sessions.create, { roomId, name: "auth sprint" });
    const token = await connector(t, ash);

    const stray = envelope("SessionStart", "s0");
    stray.session.lbSession = undefined;
    expect((await post(t, "/hook/SessionStart", stray, token)).status).toBe(200);
    expect((await ash.query(api.onboarding.progress, {})).sessionStart).toBe(false);

    expect((await post(t, "/session/attach", { code: "zzzzzz" }, token)).status).toBe(404);
    const attach = await post(t, "/session/attach", { code }, token);
    expect(await attach.json()).toMatchObject({ name: "auth sprint", room: "cal" });
    const joined = envelope("SessionStart", "s1");
    joined.session.lbSession = code;
    await post(t, "/hook/SessionStart", joined, token);
    expect((await ash.query(api.dashboard.board, { sessionId }))?.agents).toHaveLength(1);

    const noah = await signedIn(t, "noah");
    expect(await noah.query(api.dashboard.board, { sessionId })).toBeNull();
    const noahToken = await connector(t, noah);
    expect((await post(t, "/session/attach", { code }, noahToken)).status).toBe(202);
    expect((await post(t, "/session/attach", { code }, noahToken)).status).toBe(202);
    const [req] = await ash.query(api.roomAdmin.requests, { roomId });
    expect(req).toMatchObject({ handle: "noah", via: "claude", session: "auth sprint" });
    await ash.mutation(api.roomAdmin.decide, { requestId: req?.id ?? ("" as never), admit: false });
    expect((await post(t, "/session/attach", { code }, noahToken)).status).toBe(403);

    const old = envelope("UserPromptSubmit", "n9", { prompt: "/little-brother:join abc123" });
    old.session.lbSession = undefined;
    const reply = (await (await post(t, "/hook/UserPromptSubmit", old, noahToken)).json()) as {
      output: unknown;
    };
    expect(JSON.stringify(reply.output)).toMatch(/out of date/);
    const log = (await ash.query(api.dashboard.serverLog, { sessionId })) ?? [];
    expect(log.map((r) => r.kind)).toEqual(expect.arrayContaining(["request", "denied", "attached"]));
    expect(await noah.query(api.dashboard.serverLog, { sessionId })).toBeNull();

    await ash.mutation(api.sessions.end, { sessionId });
    const late = envelope("UserPromptSubmit", "s1", { prompt: "more" });
    late.session.lbSession = code;
    const ended = (await (await post(t, "/hook/UserPromptSubmit", late, token)).json()) as {
      output: unknown;
    };
    expect(JSON.stringify(ended.output)).toMatch(/has ended/);
    expect((await ash.query(api.onboarding.progress, {})).prompt).toBe(false);
  });

  test("a connect token joins once, and revoking it cuts the connector off", async () => {
    const t = makeT();
    const ash = await signedIn(t, "ash");
    const { id, token: connect } = await ash.mutation(api.devices.create, { label: "mbp" });
    const res = await post(t, "/join", { token: connect, machine: "ash-mbp" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; handle: string };
    expect(body.handle).toBe("ash");
    expect((await post(t, "/join", { token: connect })).status).toBe(401);
    expect((await ash.query(api.devices.list, {}))[0]?.status).toBe("active");
    await ash.mutation(api.devices.revoke, { id });
    expect((await post(t, "/hook/SessionStart", envelope("SessionStart", "s2"), body.token)).status).toBe(
      401,
    );
  });

  test("outside open mode the invite code is refused", async () => {
    vi.stubEnv("LB_ALLOW_INVITE", "0");
    const t = makeT();
    expect((await post(t, "/join", { invite: "calhacks", handle: "ash" })).status).toBe(403);
  });

  test("the host's read-only live view works by token without sign-in, and turning it off kills the link", async () => {
    vi.stubEnv("LB_ALLOW_INVITE", "0");
    const t = makeT();
    const ash = await signedIn(t, "ash");
    const { roomId } = await ash.mutation(api.rooms.create, { name: "cal" });
    const { sessionId } = await ash.mutation(api.sessions.create, { roomId, name: "demo" });
    const { watchToken } = await ash.mutation(api.sessions.setWatch, { sessionId, on: true });
    const token = watchToken ?? "";
    expect(await t.query(api.watch.session, { token })).toMatchObject({ name: "demo", room: "cal" });
    expect((await t.query(api.watch.board, { token }))?.agents).toEqual([]);
    expect(await t.query(api.watch.board, { token: "x".repeat(32) })).toBeNull();
    await ash.mutation(api.sessions.setWatch, { sessionId, on: false });
    expect(await t.query(api.watch.session, { token })).toBeNull();
  });
});
