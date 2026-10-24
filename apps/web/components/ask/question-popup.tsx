"use client";

import { useMutation, useQuery } from "convex/react";
import { api, type SessionId } from "@/lib/api";
import { usePresence } from "@/lib/use-presence";
import { QuestionDock } from "./question-dock";

/** On the session page (every tab): keeps presence fresh and answers the viewer's own agents' questions. */
export function QuestionPopup({ sessionId }: { sessionId: SessionId }) {
  usePresence(sessionId);
  const pending = useQuery(api.ask.pending, { sessionId });
  const answer = useMutation(api.ask.answer);
  return <QuestionDock items={pending ?? []} onAnswer={(id, answers) => answer({ id, answers })} />;
}
