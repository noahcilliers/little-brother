import { query } from "./_generated/server";
import { board as boardView } from "./dashboardQueries/board";

// Read model for apps/web. Public and unauthenticated for the hackathon; every read is bounded.
// The handler lives in dashboardQueries/ so each piece stays small; this file only fixes the public API name.

export const board = query({ args: {}, handler: (ctx) => boardView(ctx) });
