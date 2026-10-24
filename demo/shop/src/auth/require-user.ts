import type { NextFunction, Request, Response } from "express";
import type { User } from "../contracts/user";

/** Resolves the signed-in user into res.locals.user, or answers 401. */
export function requireUser(_req: Request, res: Response, _next: NextFunction): void {
  res.status(501).json({ error: "auth not implemented" });
}

export function currentUser(res: Response): User {
  const user = res.locals.user as User | undefined;
  if (!user) throw new Error("currentUser called without requireUser");
  return user;
}
