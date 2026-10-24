import jwt from "jsonwebtoken";
import type { User } from "../contracts/user";

export const JWT_SECRET = process.env.JWT_SECRET ?? "lb-demo-secret";

/** Stateless JWT bearer token: the storefront sends it as `Authorization: Bearer <token>`. */
export function issueToken(user: User): string {
  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "1h" });
}
