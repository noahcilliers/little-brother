import express from "express";
import { authRouter } from "./auth/routes";
import { catalogRouter } from "./catalog/routes";
import { checkoutRouter } from "./checkout/routes";

export const app = express();

app.use(express.json());

app.use("/api", catalogRouter);
app.use("/api", authRouter);
app.use("/api", checkoutRouter);
