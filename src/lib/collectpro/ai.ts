// ─────────────────────────────────────────────────────────────────────────────
// CollectPro — AI client (Layer 3 → Layer 3 edge function)
//
// • All calls go through the edge function — Anthropic key never in browser
// • Exponential-backoff retry (3 attempts)
// • AbortController support for cancellation
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, AIMode } from "./types";

// ── Grading types ─────────────────────────────────────────────────────────────

export interface GradingImage {
  label: string;   // e.g. "Front", "Back", "Corner TL", "Edge Top"
  base64: string;
  media_type: string;
}

export interface GradingIssue {
  category: "corner" | "edge" | "surface" | "centering" | "print" | "authenticity" | "other";
  severity: "minor" | "moderate" | "major";
  location: string;
  description: string;
}

export interface GradingSubgrades {
  centering: number;
  corners: number;
  edges: number;
  surfaces: number;
}

export interface GradingResult {
  grade: number;               // 1.0 – 10.0 PSA scale
  grade_label: string;         // "Gem Mint", "Mint", "Near Mint", etc.
  subgrades: GradingSubgrades;
  centering: {
    left_right: number;        // percentage left border vs right
    top_bottom: number;        // percentage top border vs bottom
    score: number;
  };
  authenticity: "genuine" | "suspect" | "counterfeit";
  authenticity_confidence: number;  // 0–100
  authenticity_notes: string;
  issues: GradingIssue[];
  summary: string;
  recommendations: string;
}

export interface CardScanResult {
  name: string;
  card_set: string;
  franchise: string;
  condition: string;
  notes: string;
}

const MAX_ATTEMPTS = 3;

// ── Card image scan (Claude Vision via edge function) ─────────────────────────
export async function scanCardImage(
  imageBase64: string,
  mediaType = "image/jpeg"
): Promise<CardScanResult> {
  const { data, error } = await supabase.functions.invoke("collectpro-ai", {
    body: { messages: [], mode: "scan", image_base64: imageBase64, image_media_type: mediaType },
  });

  if (error) throw new Error(error.message);

  // Extract text block from Anthropic response
  const content = data?.content;
  const text = Array.isArray(content)
    ? content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("")
    : String(content ?? "{}");

  // Parse JSON — be lenient about whitespace / markdown fences
  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI did not return valid JSON");

  return JSON.parse(cleaned.slice(start, end + 1)) as CardScanResult;
}

// ── Professional pre-grading assessment (multi-image) ────────────────────────
export async function gradeItem(
  images: GradingImage[],
  itemType = "card"
): Promise<GradingResult> {
  const { data, error } = await supabase.functions.invoke("collectpro-ai", {
    body: { messages: [], mode: "grade", images, item_type: itemType },
  });

  if (error) throw new Error(error.message);

  const content = data?.content;
  const text = Array.isArray(content)
    ? content.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("")
    : String(content ?? "{}");

  const cleaned = text.replace(/```json\n?|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("AI did not return valid JSON");

  return JSON.parse(cleaned.slice(start, end + 1)) as GradingResult;
}

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
      // Honour abort during the backoff wait
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delay);
        opts.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new Error("ABORTED"));
        }, { once: true });
      });
      return callAI(messages, mode, opts, attempt + 1);
    }
    throw err;
  }
}
