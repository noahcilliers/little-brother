import { api } from "@lb/backend/api";
import type { FunctionReturnType } from "convex/server";

export { api };

export type Board = FunctionReturnType<typeof api.dashboard.board>;
export type BoardAgent = Board["agents"][number];
export type BoardGoal = Board["goals"][number];
export type BoardTask = Board["tasks"][number];
export type BoardShared = Board["shared"][number];
export type BoardCatch = Board["catches"][number];
export type BoardSession = Board["sessions"][number];
export type SessionLine = BoardSession["lines"][number];
export type Beat = Board["beats"][number];
export type VerifyBadge = Board["verifies"][number];
export type BoardDecision = Board["decisions"][number];
export type LooseAction = Board["loose"][number];
