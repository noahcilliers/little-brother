import type { User } from "../contracts/user";

/** Credential handed to the storefront after login. Session cookie or JWT: not decided yet. */
export function issueToken(_user: User): string {
  throw new Error("issueToken: not implemented");
}
