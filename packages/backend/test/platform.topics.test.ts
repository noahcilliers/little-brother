import { expect, test } from "vitest";
import { topicFor } from "../convex/nodes";
import { makeT } from "./platformHelpers";

test("topic map globs resolve a file to its topic", async () => {
  const t = makeT();
  await t.run((ctx) =>
    ctx.db.insert("settings", {
      key: "topics:shop",
      value: { topics: { "db.users": { owner: "noah", files: ["db/schema/**", "src/contracts/user.ts"] } } },
    }),
  );
  const resolve = (files: string[]) => t.run((ctx) => topicFor(ctx, "shop", files));
  expect(await resolve(["db/schema/users.ts"])).toBe("db.users");
  expect(await resolve(["src/contracts/user.ts"])).toBe("db.users");
  expect(await resolve(["src/contracts/userXts"])).toBeFalsy();
  expect(await resolve(["web/app.ts"])).toBeFalsy();
});
