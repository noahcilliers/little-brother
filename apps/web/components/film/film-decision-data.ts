import type { BoardCatch, BoardDecision } from "@/lib/api";
import { at } from "./film-clock";

// The conflict the owner settles in the film: both sides with the diffs the connector captured.

export const CONFLICT_AT = 32;

type Classification = BoardCatch["classificationId"];
type NodeId = BoardDecision["sides"][number]["nodeId"];
// Branded Convex ids only matter to mutations, which the film never calls.
export const cid = (s: string) => s as Classification;
const nid = (s: string) => s as NodeId;

const JWT_DIFF = [
  "@@ -1,4 +1,8 @@",
  "-  req.session.userId = user.id;",
  '+  return jwt.sign({ sub: user.id }, SECRET, { expiresIn: "1h" });',
  "+}",
  "+export function requireAuth(req: Request) {",
  '+  const token = req.headers.authorization?.replace("Bearer ", "");',
  '+  return jwt.verify(token ?? "", SECRET);',
].join("\n");
const SESSION_DIFF = [
  "@@ -0,0 +1,6 @@",
  "+export function currentUser(req: Request) {",
  "+  const id = req.session.userId;",
  "+  if (!id) throw new HttpError(401);",
  "+  return findUserById(id);",
  "+}",
].join("\n");

export const DECISION: BoardDecision = {
  id: "d1",
  classificationId: cid("k3"),
  topic: "auth.mechanism",
  owner: "noah",
  t: at(CONFLICT_AT),
  detectedAfterMs: at(CONFLICT_AT) - at(29.6),
  rationale:
    "issueToken() moves auth to JWT bearer tokens while Ash's currentUser() reads a cookie session. Each passes its own tests; merged, the storefront never sees a logged-in user.",
  sides: [
    {
      nodeId: nid("n4.0"),
      agentId: "noah",
      handle: "noah",
      taskId: "n4",
      subject: "Issue JWT bearer tokens",
      keep: "JWT bearer",
      file: "src/auth/issue-token.ts",
      preview: JWT_DIFF,
      at: at(29.6),
    },
    {
      nodeId: nid("a4.0"),
      agentId: "ash",
      handle: "ash",
      taskId: "a4",
      subject: "Cookie session login",
      keep: "cookie sessions",
      file: "src/login/session.ts",
      preview: SESSION_DIFF,
      at: at(29.2),
    },
  ],
};
