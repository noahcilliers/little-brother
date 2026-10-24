import { Router } from "express";
import { findUserByEmail, hashPassword, toPublicUser } from "../../db/schema/users";
import { issueToken } from "./issue-token";
import { currentUser, requireUser } from "./require-user";

export const authRouter = Router();

authRouter.post("/auth/login", (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const row = email ? findUserByEmail(email) : undefined;
  if (!row || !password || row.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "invalid credentials" });
    return;
  }
  const user = toPublicUser(row);
  res.json({ token: issueToken(user), user });
});

authRouter.get("/me", requireUser, (_req, res) => {
  res.json(currentUser(res));
});
