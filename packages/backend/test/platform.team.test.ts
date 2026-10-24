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
  return t.withIdentity({ subject: `${userId}|session-${login}` });
}

describe("team and connect tokens", () => {
  afterEach(() => vi.unstubAllEnvs());

  test("first user owns the team; others need the current invite", async () => {
    const t = makeT();
    const ash = await signedIn(t, "Ash");
    expect((await ash.mutation(api.team.create, { name: "cal" })).handle).toBe("ash");
    const me = await ash.query(api.team.me, {});
    expect(me?.team?.isOwner).toBe(true);
    const invite = me?.team?.inviteCode ?? "";

    const noah = await signedIn(t, "noah");
    await expect(noah.mutation(api.team.create, { name: "x" })).rejects.toThrow(/already has a team/);
    await expect(noah.mutation(api.team.join, { invite: "nope" })).rejects.toThrow(/no longer valid/);
    const rotated = await ash.mutation(api.team.rotateInvite, {});
    await expect(noah.mutation(api.team.join, { invite })).rejects.toThrow(/no longer valid/);
    expect((await noah.mutation(api.team.join, { invite: rotated.inviteCode })).handle).toBe("noah");
    await expect(noah.mutation(api.team.rotateInvite, {})).rejects.toThrow(/owner/);
  });

  test("a connect token joins once, its connector token posts hooks, and revoking cuts it off", async () => {
    const t = makeT();
    const ash = await signedIn(t, "ash");
    await ash.mutation(api.team.create, { name: "cal" });
    const { id, token: connect } = await ash.mutation(api.devices.create, { label: "mbp" });

    const res = await post(t, "/join", { token: connect, machine: "ash-mbp" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; handle: string };
    expect(body.handle).toBe("ash");
    expect((await post(t, "/join", { token: connect })).status).toBe(401);

    expect((await post(t, "/hook/SessionStart", envelope("SessionStart", "s1"), body.token)).status).toBe(200);
    const progress = await ash.query(api.onboarding.progress, {});
    expect(progress).toMatchObject({ sessionStart: true, prompt: false, edit: false });
    expect((await ash.query(api.devices.list, {}))[0]?.status).toBe("active");

    await ash.mutation(api.devices.revoke, { id });
    expect((await post(t, "/hook/SessionStart", envelope("SessionStart", "s2"), body.token)).status).toBe(401);
  });

  test("outside open mode the invite code is refused and the board needs a member", async () => {
    vi.stubEnv("LB_ALLOW_INVITE", "0");
    const t = makeT();
    expect((await post(t, "/join", { invite: "calhacks", handle: "ash" })).status).toBe(403);
    await expect(t.query(api.dashboard.board, {})).rejects.toThrow(/Sign in/);
    const ash = await signedIn(t, "ash");
    await ash.mutation(api.team.create, { name: "cal" });
    expect((await ash.query(api.dashboard.board, {})).agents).toEqual([]);
  });
});
