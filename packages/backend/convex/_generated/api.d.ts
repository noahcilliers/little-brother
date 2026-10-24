/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as access from "../access.js";
import type * as admin from "../admin.js";
import type * as admission from "../admission.js";
import type * as agents from "../agents.js";
import type * as auth from "../auth.js";
import type * as classify_adapters_claude from "../classify/adapters/claude.js";
import type * as classify_adapters_gemini from "../classify/adapters/gemini.js";
import type * as classify_adapters_select from "../classify/adapters/select.js";
import type * as classify_calibrate from "../classify/calibrate.js";
import type * as classify_compare from "../classify/compare.js";
import type * as classify_db from "../classify/db.js";
import type * as classify_gate from "../classify/gate.js";
import type * as classify_lessons from "../classify/lessons.js";
import type * as classify_load from "../classify/load.js";
import type * as classify_persist from "../classify/persist.js";
import type * as classify_priority from "../classify/priority.js";
import type * as classify_run from "../classify/run.js";
import type * as classify_sync from "../classify/sync.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dashboardQueries_beats from "../dashboardQueries/beats.js";
import type * as dashboardQueries_board from "../dashboardQueries/board.js";
import type * as dashboardQueries_catches from "../dashboardQueries/catches.js";
import type * as dashboardQueries_decisions from "../dashboardQueries/decisions.js";
import type * as dashboardQueries_goals from "../dashboardQueries/goals.js";
import type * as dashboardQueries_labels from "../dashboardQueries/labels.js";
import type * as dashboardQueries_lanes from "../dashboardQueries/lanes.js";
import type * as dashboardQueries_log from "../dashboardQueries/log.js";
import type * as dashboardQueries_routine from "../dashboardQueries/routine.js";
import type * as dashboardQueries_serverRows from "../dashboardQueries/serverRows.js";
import type * as dashboardQueries_sessions from "../dashboardQueries/sessions.js";
import type * as dashboardQueries_shared from "../dashboardQueries/shared.js";
import type * as dashboardQueries_source from "../dashboardQueries/source.js";
import type * as dashboardQueries_tasks from "../dashboardQueries/tasks.js";
import type * as dashboardQueries_tokens from "../dashboardQueries/tokens.js";
import type * as debugPairs from "../debugPairs.js";
import type * as decisions from "../decisions.js";
import type * as devSeed from "../devSeed.js";
import type * as devSeedExtra from "../devSeedExtra.js";
import type * as devSeedRows from "../devSeedRows.js";
import type * as devSeedStory from "../devSeedStory.js";
import type * as devSeedWrite from "../devSeedWrite.js";
import type * as devices from "../devices.js";
import type * as digest from "../digest.js";
import type * as evals from "../evals.js";
import type * as events from "../events.js";
import type * as git from "../git.js";
import type * as gitVerify from "../gitVerify.js";
import type * as hash from "../hash.js";
import type * as hooks_end from "../hooks/end.js";
import type * as hooks_post from "../hooks/post.js";
import type * as hooks_pre from "../hooks/pre.js";
import type * as hooks_prompt from "../hooks/prompt.js";
import type * as hooks_revert from "../hooks/revert.js";
import type * as hooks_start from "../hooks/start.js";
import type * as hooks_stop from "../hooks/stop.js";
import type * as hooks_task from "../hooks/task.js";
import type * as hooks_types from "../hooks/types.js";
import type * as http from "../http.js";
import type * as httpJoin from "../httpJoin.js";
import type * as inbox from "../inbox.js";
import type * as knowledge from "../knowledge.js";
import type * as mcp from "../mcp.js";
import type * as members from "../members.js";
import type * as migrateRooms from "../migrateRooms.js";
import type * as nodes from "../nodes.js";
import type * as onboarding from "../onboarding.js";
import type * as outdated from "../outdated.js";
import type * as resolve from "../resolve.js";
import type * as roomAdmin from "../roomAdmin.js";
import type * as rooms from "../rooms.js";
import type * as savings from "../savings.js";
import type * as schemaTeam from "../schemaTeam.js";
import type * as seed from "../seed.js";
import type * as serverLog from "../serverLog.js";
import type * as sessionRows from "../sessionRows.js";
import type * as sessions from "../sessions.js";
import type * as taskAttribution from "../taskAttribution.js";
import type * as tasks from "../tasks.js";
import type * as team from "../team.js";
import type * as teamMembers from "../teamMembers.js";
import type * as tokenAuth from "../tokenAuth.js";
import type * as tokens from "../tokens.js";
import type * as verify from "../verify.js";
import type * as watch from "../watch.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  access: typeof access;
  admin: typeof admin;
  admission: typeof admission;
  agents: typeof agents;
  auth: typeof auth;
  "classify/adapters/claude": typeof classify_adapters_claude;
  "classify/adapters/gemini": typeof classify_adapters_gemini;
  "classify/adapters/select": typeof classify_adapters_select;
  "classify/calibrate": typeof classify_calibrate;
  "classify/compare": typeof classify_compare;
  "classify/db": typeof classify_db;
  "classify/gate": typeof classify_gate;
  "classify/lessons": typeof classify_lessons;
  "classify/load": typeof classify_load;
  "classify/persist": typeof classify_persist;
  "classify/priority": typeof classify_priority;
  "classify/run": typeof classify_run;
  "classify/sync": typeof classify_sync;
  crons: typeof crons;
  dashboard: typeof dashboard;
  "dashboardQueries/beats": typeof dashboardQueries_beats;
  "dashboardQueries/board": typeof dashboardQueries_board;
  "dashboardQueries/catches": typeof dashboardQueries_catches;
  "dashboardQueries/decisions": typeof dashboardQueries_decisions;
  "dashboardQueries/goals": typeof dashboardQueries_goals;
  "dashboardQueries/labels": typeof dashboardQueries_labels;
  "dashboardQueries/lanes": typeof dashboardQueries_lanes;
  "dashboardQueries/log": typeof dashboardQueries_log;
  "dashboardQueries/routine": typeof dashboardQueries_routine;
  "dashboardQueries/serverRows": typeof dashboardQueries_serverRows;
  "dashboardQueries/sessions": typeof dashboardQueries_sessions;
  "dashboardQueries/shared": typeof dashboardQueries_shared;
  "dashboardQueries/source": typeof dashboardQueries_source;
  "dashboardQueries/tasks": typeof dashboardQueries_tasks;
  "dashboardQueries/tokens": typeof dashboardQueries_tokens;
  debugPairs: typeof debugPairs;
  decisions: typeof decisions;
  devSeed: typeof devSeed;
  devSeedExtra: typeof devSeedExtra;
  devSeedRows: typeof devSeedRows;
  devSeedStory: typeof devSeedStory;
  devSeedWrite: typeof devSeedWrite;
  devices: typeof devices;
  digest: typeof digest;
  evals: typeof evals;
  events: typeof events;
  git: typeof git;
  gitVerify: typeof gitVerify;
  hash: typeof hash;
  "hooks/end": typeof hooks_end;
  "hooks/post": typeof hooks_post;
  "hooks/pre": typeof hooks_pre;
  "hooks/prompt": typeof hooks_prompt;
  "hooks/revert": typeof hooks_revert;
  "hooks/start": typeof hooks_start;
  "hooks/stop": typeof hooks_stop;
  "hooks/task": typeof hooks_task;
  "hooks/types": typeof hooks_types;
  http: typeof http;
  httpJoin: typeof httpJoin;
  inbox: typeof inbox;
  knowledge: typeof knowledge;
  mcp: typeof mcp;
  members: typeof members;
  migrateRooms: typeof migrateRooms;
  nodes: typeof nodes;
  onboarding: typeof onboarding;
  outdated: typeof outdated;
  resolve: typeof resolve;
  roomAdmin: typeof roomAdmin;
  rooms: typeof rooms;
  savings: typeof savings;
  schemaTeam: typeof schemaTeam;
  seed: typeof seed;
  serverLog: typeof serverLog;
  sessionRows: typeof sessionRows;
  sessions: typeof sessions;
  taskAttribution: typeof taskAttribution;
  tasks: typeof tasks;
  team: typeof team;
  teamMembers: typeof teamMembers;
  tokenAuth: typeof tokenAuth;
  tokens: typeof tokens;
  verify: typeof verify;
  watch: typeof watch;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
