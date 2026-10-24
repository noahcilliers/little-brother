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

async function signedIn(t: T, login: string) {
  const userId: Id<"users"> = await t.run((ctx) =>
    ctx.db.insert("users", { name: login, githubLogin: login, image: `https://a/${login}.png` }),
  );
  const as = t.withIdentity({ subject: `${userId}|session-${login}` });
  await as.mutation(api.team.ensureAccount, {});
  return as;
}

async function connector(t: T, as: Awaited<ReturnType<typeof signedIn>>): Promise<string> {
  const { token } = await as.mutation(api.devices.create, { label: "mbp" });
  const res = await post(t, "/join", { token, machine: "mbp" });
  return ((await res.json()) as { token: string }).token;
}

describe("room-wide log", () => {
  afterEach(() => vi.unstubAllEnvs());

  test("the host sees every session's hooks tagged by session; members and outsiders get null", async () => {
    vi.stubEnv("LB_ALLOW_INVITE", "0");
    const t = makeT();
    const ash = await signedIn(t, "ash");
    const { roomId } = await ash.mutation(api.rooms.create, { name: "cal" });
    const a = await ash.mutation(api.sessions.create, { roomId, name: "auth" });
    const b = await ash.mutation(api.sessions.create, { roomId, name: "checkout" });
    const token = await connector(t, ash);
    for (const [s, code] of [
      ["s1", a.code],
      ["s2", b.code],
    ] as const) {
      await post(t, "/session/attach", { code }, token);
      const env = envelope("SessionStart", s);
      env.session.lbSession = code;
      await post(t, "/hook/SessionStart", env, token);
    }

    const log = await ash.query(api.logs.room, { roomId });
    expect(log?.sessions.map((s) => s.name).sort()).toEqual(["auth", "checkout"]);
    const hooks = (log?.server ?? []).filter((r) => r.kind.startsWith("hook"));
    expect(new Set(hooks.map((r) => r.sessionId))).toEqual(new Set([a.sessionId, b.sessionId]));
    expect(log?.server.some((r) => r.kind === "attached")).toBe(true);
    expect(log?.classifier).toEqual([]);

    // The per-session log keeps its shape and only that session's hooks.
    const one = (await ash.query(api.dashboard.serverLog, { sessionId: a.sessionId })) ?? [];
    expect(one.filter((r) => r.kind.startsWith("hook")).every((r) => r.sessionId === a.sessionId)).toBe(true);

    const invite = (await ash.query(api.rooms.get, { roomId }))?.inviteCode ?? "";
    const noah = await signedIn(t, "noah");
    expect(await noah.query(api.logs.room, { roomId })).toBeNull();
    await ash.mutation(api.roomAdmin.setAdmission, { roomId, admission: "open" });
    await noah.mutation(api.rooms.join, { invite });
    expect(await noah.query(api.logs.room, { roomId })).toBeNull();
    expect(await ash.query(api.logs.room, { roomId: "not-an-id" })).toBeNull();
  });
});
