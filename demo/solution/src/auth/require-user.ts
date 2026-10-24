import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { toPublicUser, users } from "../../db/schema/users";
import type { User } from "../contracts/user";
import { JWT_SECRET } from "./issue-token";

/** Resolves the signed-in user into res.locals.user, or answers 401. */
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  try {
    const payload = token ? jwt.verify(token, JWT_SECRET) : undefined;
    const userId = typeof payload === "object" ? payload.userId : undefined;
    const row = typeof userId === "string" ? users.get(userId) : undefined;
    if (!row) {
      res.status(401).json({ error: "sign in required" });
      return;
    }
    res.locals.user = toPublicUser(row);
    next();
  } catch {
    res.status(401).json({ error: "invalid token" });
  }
}

export function currentUser(res: Response): User {
  const user = res.locals.user as User | undefined;
  if (!user) throw new Error("currentUser called without requireUser");
  return user;
}
