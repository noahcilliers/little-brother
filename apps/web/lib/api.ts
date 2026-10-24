import { api } from "@lb/backend/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";

export { api };

/** The board for one session; the query returns null when the viewer can't see that session. */
export type Board = NonNullable<FunctionReturnType<typeof api.dashboard.board>>;
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

export type TeamStatus = FunctionReturnType<typeof api.team.status>;
export type Me = FunctionReturnType<typeof api.team.me>;
export type Progress = FunctionReturnType<typeof api.onboarding.progress>;

export type RoomSummary = FunctionReturnType<typeof api.rooms.mine>[number];
export type Room = NonNullable<FunctionReturnType<typeof api.rooms.get>>;
export type RoomSession = Room["sessions"][number];
export type RoomMember = Room["members"][number];
export type SessionHead = NonNullable<FunctionReturnType<typeof api.sessions.get>>;

export type RoomId = Room["id"];
export type SessionId = SessionHead["id"];

// Route params arrive as plain strings. The reads take strings and return null for a malformed id;
// mutations validate ids server side.
export const asRoomId = (id: string) => id as RoomId;
export const asSessionId = (id: string) => id as SessionId;
export type LogStep = NonNullable<FunctionReturnType<typeof api.dashboard.log>>[number];
export type LogVerdict = LogStep["verdicts"][number];
export type JoinRequest = FunctionReturnType<typeof api.roomAdmin.requests>[number];
export type ServerRow = NonNullable<FunctionReturnType<typeof api.dashboard.serverLog>>[number];
