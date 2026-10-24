import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(workpool, { name: "classifyPool" });
app.use(rateLimiter);

export default app;
