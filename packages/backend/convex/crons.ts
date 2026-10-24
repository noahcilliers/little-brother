import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();
crons.interval("agent presence", { minutes: 1 }, internal.agents.sweep, {});

export default crons;
