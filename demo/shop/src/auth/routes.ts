import { Router } from "express";
import { currentUser, requireUser } from "./require-user";

export const authRouter = Router();

authRouter.post("/auth/login", (_req, res) => {
  res.status(501).json({ error: "login not implemented" });
});

authRouter.get("/me", requireUser, (_req, res) => {
  res.json(currentUser(res));
});
