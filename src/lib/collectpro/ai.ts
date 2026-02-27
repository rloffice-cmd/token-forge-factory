// ─────────────────────────────────────────────────────────────────────────────
// CollectPro — AI client (Layer 3 → Layer 3 edge function)
//
// • All calls go through the edge function — Anthropic key never in browser
// • Exponential-backoff retry (3 attempts)
// • AbortController support for cancellation
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, AIMode } from "./types";

const MAX_ATTEMPTS = 3;

export async function callAI(
  messages: ChatMessage[],
  mode: AIMode,
  opts: { signal?: AbortSignal; cacheKey?: string } = {},
  attempt = 0
): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke("collectpro-ai", {
      body: { messages, mode, cacheKey: opts.cacheKey ?? "" },
    });

    if (error) throw new Error(error.message);

    // Extract text from Anthropic response (handles tool_use blocks transparently)
    const content = data?.content;
    if (Array.isArray(content)) {
      return (
        content
          .filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("\n") || "לא התקבלה תשובה."
      );
    }
    return String(content ?? "לא התקבלה תשובה.");
  } catch (err: unknown) {
    if (opts.signal?.aborted) throw new Error("ABORTED");

    if (attempt < MAX_ATTEMPTS - 1) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      return callAI(messages, mode, opts, attempt + 1);
    }
    throw err;
  }
}
