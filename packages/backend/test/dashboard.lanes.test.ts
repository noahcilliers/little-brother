import { expect, test } from "vitest";
import type { Doc, Id } from "../convex/_generated/dataModel";
import { mergeLanes, splitSessions } from "../convex/dashboardQueries/lanes";
import type { Source } from "../convex/dashboardQueries/source";

let clock = 0;
function agent(id: string, member: string, status: Doc<"agents">["status"]): Doc<"agents"> {
  clock += 1;
  return {
    _id: id as Id<"agents">,
    _creationTime: clock,
    memberId: member as Id<"members">,
    claudeSessionId: id,
    machine: "laptop",
    repo: "lb-demo-shop",
    branch: `b-${id}`,
    status,
    lastSeenAt: clock,
  };
}

function node(id: string, agentId: string): Doc<"nodes"> {
  return {
    _id: id as Id<"nodes">,
    _creationTime: 0,
    agentId: agentId as Id<"agents">,
    kind: "action",
    verb: "EDIT",
    text: "EDIT x",
    files: [],
    touches: [],
    references: [],
    outcome: "open",
    at: 0,
  };
}

function source(
  agents: Doc<"agents">[],
  handleOf: Record<string, string>,
  nodes: Doc<"nodes">[] = [],
): Source {
  const handles = new Map(agents.map((a) => [a._id, handleOf[a.memberId] ?? "agent"]));
  return {
    agents,
    handles,
    colors: new Map(),
    nodes,
    nodeById: new Map(nodes.map((n) => [n._id, n])),
    tasks: [],
    events: [],
    inbox: [],
    verdicts: [],
    recentVerdicts: [],
    topicOwners: new Map(),
  };
}

const handles = { m1: "noah", m2: "sam" };

test("the timeline keeps one lane per person however many sessions are live", () => {
  const agents = [agent("a1", "m1", "active"), agent("a2", "m1", "idle"), agent("s1", "m2", "active")];
  const src = mergeLanes(source(agents, handles, [node("n1", "a2")]));
  expect(src.agents.map((a) => a._id)).toEqual(["a1", "s1"]);
  expect(src.nodes.map((n) => n.agentId)).toEqual(["a1"]);
});

test("two live sessions of one person get a pane each, numbered", () => {
  const { src, labels } = splitSessions(
    source([agent("a1", "m1", "active"), agent("a2", "m1", "idle")], handles),
  );
  expect(src.agents.map((a) => a._id)).toEqual(["a1", "a2"]);
  expect(src.agents.map((a) => labels.get(a._id))).toEqual(["noah · 1", "noah · 2"]);
});

test("dead sessions fold into the person's first pane alongside the earliest live one", () => {
  const agents = [
    agent("dead1", "m1", "offline"),
    agent("live1", "m1", "active"),
    agent("dead2", "m1", "offline"),
    agent("live2", "m1", "active"),
  ];
  const nodes = [node("n1", "dead2"), node("n2", "live1"), node("n3", "live2")];
  const { src } = splitSessions(source(agents, handles, nodes));
  expect(src.agents.map((a) => a._id)).toEqual(["dead1", "live2"]);
  expect(src.agents[0]?.status).toBe("active");
  expect(src.nodes.map((n) => n.agentId)).toEqual(["dead1", "dead1", "live2"]);
});

test("one live session per person keeps a single unnumbered pane", () => {
  const agents = [agent("old", "m1", "offline"), agent("new", "m1", "active"), agent("s1", "m2", "active")];
  const { src, labels } = splitSessions(source(agents, handles));
  expect(src.agents.map((a) => a._id)).toEqual(["old", "s1"]);
  expect(src.agents[0]?.branch).toBe("b-new");
  expect(src.agents.map((a) => labels.get(a._id))).toEqual(["noah", "sam"]);
});
