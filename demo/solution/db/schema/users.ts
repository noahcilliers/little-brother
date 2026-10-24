import { createHash } from "node:crypto";
import type { User } from "../../src/contracts/user";

export interface UserRow extends User {
  passwordHash: string;
}

export const hashPassword = (password: string) => createHash("sha256").update(password).digest("hex");

/** In-memory users table, seeded with the demo account the storefront and tests sign in with. */
export const users = new Map<string, UserRow>([
  ["u_demo", { id: "u_demo", email: "demo@shop.dev", name: "Demo Shopper", passwordHash: hashPassword("correct-horse") }],
]);

export function findUserByEmail(email: string): UserRow | undefined {
  return [...users.values()].find((u) => u.email === email);
}

export function toPublicUser({ id, email, name }: UserRow): User {
  return { id, email, name };
}
