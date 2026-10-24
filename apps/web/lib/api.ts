import { api } from "@lb/backend/api";
import type { FunctionReturnType } from "convex/server";

export { api };

type D = typeof api.dashboard;
export type GraphData = FunctionReturnType<D["graph"]>;
export type GraphNode = GraphData["nodes"][number];
export type GraphLane = GraphData["lanes"][number];
export type GraphEdge = GraphData["edges"][number];
export type NodeDetail = NonNullable<FunctionReturnType<D["nodeDetail"]>>;
export type ActivityRow = FunctionReturnType<D["activity"]>[number];
export type AgentRow = FunctionReturnType<D["agents"]>[number];
export type AgentStream = NonNullable<FunctionReturnType<D["agentStream"]>>;
export type ConflictView = FunctionReturnType<D["openConflicts"]>["open"][number];
export type Metrics = FunctionReturnType<D["metrics"]>;
export type { GenericId as Id } from "convex/values";
