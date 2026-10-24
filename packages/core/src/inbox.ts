/** Contract 6 — what an agent is told, by hook context or channel push. */
export type InboxItem = {
  id: string;
  classificationId: string;
  text: string; // already rendered, ≤ 5 lines
  action: "warn" | "serialize" | "block";
  state: "queued" | "delivered" | "acked" | "applied";
};

export type ChannelMessage = { content: string; meta: { item_id: string; kind: string } };

/** Render pending items as the short block injected into a session. */
export function renderDigest(items: Pick<InboxItem, "id" | "text">[], max = 5): string {
  if (items.length === 0) return "";
  const shown = items.slice(0, max).map((i) => `- ${i.text} (ack: ${i.id})`);
  const more = items.length > max ? [`- …and ${items.length - max} more (call little-brother inbox)`] : [];
  return ["[little-brother]", ...shown, ...more].join("\n");
}
