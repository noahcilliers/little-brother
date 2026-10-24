import { api } from "@lb/backend/api";
import type { FunctionReturnType } from "convex/server";

export { api };

export type Board = FunctionReturnType<typeof api.dashboard.board>;
export type BoardNode = Board["nodes"][number];
export type BoardEdge = Board["edges"][number];
export type BoardAgent = Board["agents"][number];
export type FeedRow = Board["feed"][number];
export type OpenConflict = Board["conflicts"][number];
export type Glyph = BoardNode["glyph"];
export type Why = NonNullable<BoardNode["why"]>;
