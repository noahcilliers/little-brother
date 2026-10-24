"use node";

import { GoogleGenAI } from "@google/genai";
import { JUDGE_SYSTEM, judgePrompt, toClassifiedNode } from "@lb/core";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { judgeSchema } from "./classify/adapters/schema";

/** Dev only: run the raw judge call on one pair N times and report finish reasons, lengths and parse results. */
export const probe = internalAction({
  args: { nextText: v.string(), otherText: v.string(), runs: v.number() },
  handler: async (ctx, { nextText, otherText, runs }) => {
    const nodes = await ctx.runQuery(internal.debugPairs.byText, { a: nextText, b: otherText });
    if (!nodes) return "pair not found";
    const pair = { next: toClassifiedNode(nodes.a), other: toClassifiedNode(nodes.b), retrievalScore: 0.85, reasons: ["one changes auth.mechanism, the other consumes it"], failedMemory: false };
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });
    const out: string[] = [];
    for (let i = 0; i < runs; i++) {
      const t = Date.now();
      try {
        const res = await ai.models.generateContent({
          model: process.env.GEMINI_JUDGE_MODEL ?? "gemini-3.5-flash-lite",
          contents: judgePrompt(pair, [], []),
          config: { systemInstruction: JUDGE_SYSTEM, temperature: 0, maxOutputTokens: 512, responseMimeType: "application/json", responseJsonSchema: judgeSchema() },
        });
        const text = res.text ?? "";
        let ok = "parse-ok";
        try { JSON.parse(text); } catch { ok = "PARSE-FAIL"; }
        out.push(`${Date.now() - t}ms finish=${res.candidates?.[0]?.finishReason} len=${text.length} ${ok} ${text.slice(0, 90)}`);
      } catch (e) {
        out.push(`${Date.now() - t}ms ERROR ${String(e).slice(0, 120)}`);
      }
    }
    return out.join("\n");
  },
});
