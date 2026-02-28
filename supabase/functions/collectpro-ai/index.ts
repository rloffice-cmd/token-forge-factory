/**
 * collectpro-ai — Layer 3 (Logic): AI proxy for CollectPro
 *
 * Responsibilities:
 *  1. Load the merged system prompt from Layer 2 (cp_instructions + cp_instruction_patches)
 *  2. Call Anthropic API — system prompt is NEVER removed when web-search is added
 *  3. Cache market results back into Layer 1 (cp_knowledge) — append-only
 *  4. Rate-limit requests per IP
 *
 * The Anthropic API key lives only here — never in the browser.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ─────────────────────────────────────────────────────────────

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL  = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MODEL         = "claude-opus-4-6";

const cors = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Rate limiter (10 req / min per IP) ──────────────────────────────────────

const rl = new Map<string, { n: number; reset: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const e = rl.get(ip);
  if (!e || now > e.reset) { rl.set(ip, { n: 1, reset: now + 60_000 }); return false; }
  if (e.n >= 10) return true;
  e.n++;
  return false;
}

// ─── Definitions loader (Layer 2) ─────────────────────────────────────────────
//
// Merges: base instruction + all active patches in version ASC order.
// The result is the live system prompt — always current, never hardcoded.

async function loadSystemPrompt(
  sb: ReturnType<typeof createClient>,
  key: string
): Promise<string> {
  const [{ data: base }, { data: patches }] = await Promise.all([
    sb.from("cp_instructions")
      .select("content")
      .eq("key", key)
      .single(),
    sb.from("cp_instruction_patches")
      .select("patch, version")
      .eq("instruction_key", key)
      .eq("active", true)
      .order("version", { ascending: true }),
  ]);

  if (!base?.content) return "";

  // Base is immutable; patches are layered on top — never replacing, always extending
  const layers = [base.content, ...(patches ?? []).map((p: { patch: string }) => p.patch)];
  return layers.join("\n\n---\n\n");
}

// ─── Knowledge writer (Layer 1, append-only) ──────────────────────────────────

async function appendKnowledge(
  sb: ReturnType<typeof createClient>,
  type: string,
  key: string,
  content: string,
  metadata: Record<string, unknown>
): Promise<void> {
  // The cp_knowledge_deactivate_previous trigger will mark old rows inactive
  await sb.from("cp_knowledge").insert({ type, key, content, metadata });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (limited(ip)) {
    return json({ error: "Rate limit: 10 requests per minute." }, 429);
  }

  if (!ANTHROPIC_KEY) return json({ error: "AI service not configured." }, 503);

  type ContentBlock =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

  let body: {
    messages: Array<{ role: string; content: string }>;
    mode: "brain" | "market" | "arbitrage" | "scan" | "grade";
    cacheKey?: string;
    image_base64?: string;
    image_media_type?: string;
    // grade mode
    images?: Array<{ label: string; base64: string; media_type: string }>;
    item_type?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400);
  }

  const { messages, mode = "brain", cacheKey, image_base64, image_media_type, images, item_type } = body;

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Scan mode: vision-based card identification ───────────────────────────
  if (mode === "scan") {
    if (!image_base64) return json({ error: "image_base64 required for scan mode." }, 400);

    const scanSystem =
      "You are a TCG card identification expert. When shown a card image, " +
      "identify it and return ONLY valid JSON (no markdown, no extra text): " +
      '{"name":"<card name>","card_set":"<set name>","franchise":"Pokemon|One Piece|Magic|Other",' +
      '"condition":"M|NM|LP|MP|HP|D","notes":"<any relevant observation>"}. ' +
      "If you cannot identify the card, return {\"name\":\"\",\"card_set\":\"\",\"franchise\":\"Other\",\"condition\":\"NM\",\"notes\":\"Could not identify\"}";

    const contentBlocks: ContentBlock[] = [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: image_media_type ?? "image/jpeg",
          data: image_base64,
        },
      },
      {
        type: "text",
        text: "Identify this trading card. Return ONLY the JSON object described in the system prompt.",
      },
    ];

    const scanResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system: scanSystem,
        messages: [{ role: "user", content: contentBlocks }],
      }),
    });

    return json(await scanResp.json(), scanResp.status);
  }

  // ── Grade mode: professional pre-grading assessment ───────────────────────
  if (mode === "grade") {
    if (!images || images.length === 0) {
      return json({ error: "images array required for grade mode." }, 400);
    }

    const gradeSystem =
      "You are a professional TCG card grading expert with 20+ years of experience, equivalent to PSA, BGS, and CGC graders. " +
      "You perform meticulous pre-grading assessments by analyzing card images for centering, corner wear, edge wear, surface condition, and print quality. " +
      "You are ALSO a world-class counterfeit detection specialist — you identify fakes by analyzing: " +
      "rosette print patterns (genuine cards have a tight, consistent dot pattern), color saturation and ink bleed, " +
      "font consistency, hologram quality, card thickness/feel indicators, back design accuracy, and border color matching. " +
      "\n\nFor SEALED products (boxes, cases, sealed items): evaluate seal integrity, pack freshness, corner/edge of box, " +
      "wrapper condition, and signs of tampering or resealing. " +
      "\n\nRETURN ONLY valid JSON — no markdown fences, no extra text. Schema:\n" +
      '{"grade":9.5,"grade_label":"Gem Mint","subgrades":{"centering":9.5,"corners":9.0,"edges":9.5,"surfaces":10.0},' +
      '"centering":{"left_right":50,"top_bottom":51,"score":9.5},' +
      '"authenticity":"genuine","authenticity_confidence":98.5,' +
      '"authenticity_notes":"Consistent rosette pattern, correct font, proper hologram alignment.",' +
      '"issues":[{"category":"corner","severity":"minor","location":"bottom-right","description":"Slight fraying on bottom-right corner"}],' +
      '"summary":"Near gem-mint condition card with excellent surfaces.",' +
      '"recommendations":"Submit to PSA — strong PSA 9 candidate, possible 10 if centering is re-evaluated under studio lighting."}';

    const gradeContentBlocks: ContentBlock[] = [];
    for (const img of images) {
      gradeContentBlocks.push({ type: "text", text: `[Image: ${img.label}]` });
      gradeContentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: img.media_type, data: img.base64 },
      });
    }
    gradeContentBlocks.push({
      type: "text",
      text: `Item type: ${item_type ?? "card"}. Analyze all provided images and return the professional grading assessment JSON.`,
    });

    const gradeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: gradeSystem,
        messages: [{ role: "user", content: gradeContentBlocks }],
      }),
    });

    return json(await gradeResp.json(), gradeResp.status);
  }

  const instructionKey = `collectpro_${mode}`;

  // Load merged system prompt from Layer 2
  const systemPrompt = await loadSystemPrompt(sb, instructionKey);

  // Build Anthropic request
  // CRITICAL: system prompt is present regardless of whether tools are added
  const anthropicBody: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt || `You are a ${mode} assistant for TCG card portfolio management.`,
    messages,
  };

  const headers: Record<string, string> = {
    "Content-Type":     "application/json",
    "x-api-key":        ANTHROPIC_KEY,
    "anthropic-version": "2023-06-01",
  };

  if (mode === "market" || mode === "arbitrage") {
    anthropicBody.tools = [{ type: "web_search_20250305", name: "web_search" }];
    headers["anthropic-beta"] = "web-search-2025-03-05";
  }

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(anthropicBody),
  });

  const data = await resp.json();

  // Append market results to knowledge layer (Layer 1) — async, non-blocking
  if (resp.ok && cacheKey && (mode === "market" || mode === "arbitrage")) {
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    if (text) {
      appendKnowledge(sb, mode, cacheKey, text, {
        query: messages.at(-1)?.content ?? "",
        model: MODEL,
        timestamp: new Date().toISOString(),
      }).catch(console.error); // fire-and-forget; don't fail the response
    }
  }

  return json(data, resp.status);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
