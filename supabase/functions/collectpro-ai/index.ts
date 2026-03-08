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

    const itype = item_type ?? "card";

    // ── Per-item-type expert system prompts ──────────────────────────────────
    const JSON_SCHEMA =
      '{"grade":9.5,"grade_label":"Gem Mint",' +
      '"subgrades":{"centering":9.5,"corners":9.0,"edges":9.5,"surfaces":10.0},' +
      '"centering":{"left_right":52,"top_bottom":53,"score":9.5},' +
      '"authenticity":"genuine","authenticity_confidence":98.5,' +
      '"authenticity_notes":"...",' +
      '"issues":[{"category":"corner","severity":"minor","location":"bottom-right","description":"..."}],' +
      '"summary":"...","recommendations":"..."}';

    const BASE =
      "You are a world-class collectibles grading expert with 25+ years of experience, " +
      "equivalent to the top graders at PSA, BGS, CGC, BCCG, and SGC. " +
      "You have personally graded over 1,000,000 items. " +
      "ALWAYS return ONLY valid JSON — no markdown fences, no preamble, no extra text.\n\n";

    let gradeSystem: string;
    let analysisInstruction: string;

    if (itype === "card") {
      gradeSystem = BASE +
        "=== TRADING CARD GRADING — PSA/BGS/CGC PROFESSIONAL STANDARD ===\n\n" +

        "CENTERING (measure border ratios precisely):\n" +
        "PSA 10 Gem Mint:    55/45 or better (front), 75/25 or better (back)\n" +
        "PSA 9 Mint:         60/40 or better (front), 75/25 or better (back)\n" +
        "PSA 8 NM-MT:        65/35 or better (front), 80/20 or better (back)\n" +
        "PSA 7 NM:           70/30 or better\n" +
        "BGS: stricter — 50/50 ± 5% for 10, ± 10% for 9.5\n\n" +

        "CORNERS (examine as if under 10× loupe):\n" +
        "10: Perfectly sharp, no fraying whatsoever, no rounding\n" +
        "9.5: Barely perceptible fraying under magnification only\n" +
        "9: Very light fraying, visible under loupe not naked eye\n" +
        "8.5: Light fraying visible to naked eye on close inspection\n" +
        "8: Moderate fraying, slightly rounded\n" +
        "7: Visible wear, obvious fraying, rounding\n" +
        "Below 7: Heavy wear, severe rounding, creasing\n\n" +

        "EDGES (all four edges):\n" +
        "10: Perfectly smooth, no chips, no roughness\n" +
        "9.5: Slight roughness under magnification\n" +
        "9: Minor roughness or micro-chipping\n" +
        "8.5: Light chipping or nicks visible on close inspection\n" +
        "8: Noticeable chipping or denting\n" +
        "7: Significant chips or denting\n\n" +

        "SURFACES (front and back):\n" +
        "10: Perfect gloss, no scratches, no print defects, no stains\n" +
        "9.5: One or two extremely minor surface flaws\n" +
        "9: Minor surface scratches, light scuffs, slight print lines\n" +
        "8.5: A few light scratches or print lines visible at angle\n" +
        "8: Several scratches or print defects\n" +
        "7: Heavy scratching, major print defects, or surface issues\n\n" +

        "AUTHENTICITY — EXPERT COUNTERFEIT DETECTION:\n" +
        "1. Rosette pattern: genuine cards show tight, consistent dot matrix; fakes show smearing, irregular dots, or no rosette\n" +
        "2. Color saturation: fakes often oversaturated, washed-out, or wrong hue\n" +
        "3. Font: check letter spacing, weight, kerning — fakes often have wrong font metrics\n" +
        "4. Hologram/stamp: check positioning, quality, reflectivity\n" +
        "5. Card stock: estimate thickness from lighting/shadow indicators; fakes often thinner\n" +
        "6. Back design: pixel-perfect accuracy of patterns, borders, colors\n" +
        "7. Border color: exact Pantone matching vs slightly off shades\n" +
        "8. Energy symbols, HP numbers, attack damage — exact formatting\n\n" +

        "RETURN ONLY this exact JSON schema:\n" + JSON_SCHEMA;

      analysisInstruction =
        `Analyze all ${images.length} provided images as a professional PSA/BGS card grader. ` +
        "Apply precise centering measurements, corner/edge grading rubrics under simulated loupe magnification, " +
        "surface scratch analysis, and expert rosette-pattern counterfeit detection. " +
        "Grade each subcomponent independently then derive the overall grade. " +
        "Return the grading JSON — no other text.";

    } else if (itype === "box" || itype === "case") {
      gradeSystem = BASE +
        `=== SEALED BOX / CASE GRADING — PACK FRESH PROFESSIONAL STANDARD ===\n\n` +

        "PACK FRESH SCALE:\n" +
        "10 (Pack Fresh):         Perfect factory condition — as if just off the production line\n" +
        "9.5 (Near Pack Fresh):   Extremely minor imperfection, barely detectable under scrutiny\n" +
        "9 (Excellent+):          Light handling, minor corner/edge touch\n" +
        "8.5 (Excellent):         Slight wear, no major issues\n" +
        "8 (Very Good+):          Minor dents or edge wear, fully intact\n" +
        "7 (Very Good):           Moderate wear, some denting, presentable\n" +
        "6 (Good):                Significant wear, multiple dents\n" +
        "Below 6:                 Heavy damage, water damage, major dents, or tamper evidence\n\n" +

        "BOX STRUCTURE ASSESSMENT (all 6 sides):\n" +
        "- Each of the 6 faces: look for dents, creases, compression marks, print fading\n" +
        "- 8 corners: examine for crushing, softening, corner-splits\n" +
        "- 12 edges: check for chipping, splitting, crushing, peeling\n" +
        "- Surface: print quality, color uniformity, water stains, light scratches\n\n" +

        "TAMPER DETECTION (CRITICAL for sealed boxes):\n" +
        "1. Cellophane/shrink-wrap integrity — original factory shrink vs. re-shrunk\n" +
        "2. Seal tension — factory wrap is uniformly taut; re-wrapped may be loose or uneven\n" +
        "3. Heat seam quality — factory crimp is machine-perfect; re-wrapped shows hand-seaming\n" +
        "4. Tape residue — any adhesive marks, overlapping cellophane layers\n" +
        "5. Flap condition — check if box flaps show prior opening: crease patterns, glue reactivation\n" +
        "6. Security stickers/holograms — intact, centered, not lifted or replaced\n" +
        "7. Pack count integrity — infer from any visible sag, bulge, or weight distribution\n" +
        "8. Moisture/humidity indicators — warping, swelling, moisture rings, mold spots\n\n" +

        "For centering subgrade: estimate seal/label alignment symmetry (treat as centering).\n\n" +

        "RETURN ONLY this exact JSON schema:\n" + JSON_SCHEMA;

      analysisInstruction =
        `Analyze all ${images.length} provided images of this sealed ${itype} as a professional pack-fresh grader. ` +
        "Assess all 6 sides for structural integrity, examine corners and edges for wear, " +
        "detect tamper evidence (re-sealing, replaced cellophane, opened flaps), " +
        "look for moisture damage and shipping damage. " +
        "For authenticity: assess whether original factory seal is intact. " +
        "Return the grading JSON — no other text.";

    } else if (itype === "sealed") {
      gradeSystem = BASE +
        "=== SEALED PACK / BOOSTER PACK GRADING — PACK FRESH PROFESSIONAL STANDARD ===\n\n" +

        "PACK FRESHNESS SCALE:\n" +
        "10 (Pack Fresh):         Perfect factory seal, zero wear, no bending, no scratches\n" +
        "9.5:                     Near perfect, only micro-imperfections under magnification\n" +
        "9:                       Minor handling wear, seal fully intact\n" +
        "8.5:                     Light wrinkling or edge wear, seal intact\n" +
        "8:                       Moderate wrinkling, seal present but stressed\n" +
        "7:                       Significant wear, bent corners, stressed seal\n" +
        "Below 7:                 Major damage, pin holes, torn wrapper, or tamper evidence\n\n" +

        "SEAL INTEGRITY ANALYSIS (MOST CRITICAL FACTOR):\n" +
        "1. Perimeter seal — check all 4 edges for lifting, separation, or re-sealing\n" +
        "2. Cellophane tension — fresh packs have consistent, uniform tension\n" +
        "3. Tampered packs: may be loose, overly tight in spots, or show wrinkles\n" +
        "4. Heat crimp quality — factory crimp is machine-perfect and uniform\n" +
        "5. Re-sealing artifacts: heat marks, adhesive residue, misalignment of crimp\n" +
        "6. Tab/pull strip — any fraying, partial pulling, or re-tucking\n" +
        "7. Air bubble pattern — factory packs have characteristic uniform bubbles\n\n" +

        "WRAPPER CONDITION:\n" +
        "- Tears, pin holes, punctures (common from weight testing)\n" +
        "- Wrinkle pattern: factory folds vs. handling wrinkles\n" +
        "- Creases and fold marks\n" +
        "- Print quality: color bleed, registration marks, barcode clarity\n" +
        "- Tanning/yellowing (for vintage packs)\n\n" +

        "AUTHENTICITY FOR PACKS:\n" +
        "- Logo placement, sizing, and color accuracy\n" +
        "- Barcode formatting and positioning\n" +
        "- Factory code / date stamp visibility and format\n" +
        "- Weight/thickness indicators from visual cues\n\n" +

        "For subgrades: centering = seal integrity score, corners = pack corner condition, " +
        "edges = seal perimeter score, surfaces = wrapper condition score.\n\n" +

        "RETURN ONLY this exact JSON schema:\n" + JSON_SCHEMA;

      analysisInstruction =
        `Analyze all ${images.length} provided images of this sealed pack as a professional pack-fresh grader. ` +
        "Focus heavily on seal integrity — examine every edge of the seal, look for re-sealing evidence, " +
        "check the pull tab/strip, analyze wrapper condition for tears or pin holes. " +
        "For authenticity: determine if seal is original factory or re-sealed. " +
        "Return the grading JSON — no other text.";

    } else {
      // Generic / other item type
      gradeSystem = BASE +
        "=== GENERAL COLLECTIBLE GRADING — PROFESSIONAL STANDARD ===\n\n" +

        "GRADE SCALE (1-10):\n" +
        "10 (Gem Mint):     Perfect in every way\n" +
        "9.5 (Mint+):       Near perfect, microscopic flaws only\n" +
        "9 (Mint):          Excellent, minor imperfections\n" +
        "8.5 (NM-MT+):      Light handling, fully presentable\n" +
        "8 (NM-MT):         Light wear\n" +
        "7 (NM):            Moderate wear, still nice\n" +
        "6 (EX-MT):         Obvious wear\n" +
        "5 (EX):            Heavy wear\n" +
        "Below 5:           Poor condition\n\n" +

        "ASSESS:\n" +
        "1. Overall structural integrity and completeness\n" +
        "2. Surface condition — scratches, fading, stains, oxidation\n" +
        "3. Edge and corner wear\n" +
        "4. Authenticity — signs of reproduction, alteration, or restoration\n" +
        "5. Any damage, repairs, or modifications\n\n" +

        "RETURN ONLY this exact JSON schema:\n" + JSON_SCHEMA;

      analysisInstruction =
        `Analyze all ${images.length} provided images of this collectible item as a professional grader. ` +
        "Assess overall condition, surface wear, structural integrity, and authenticity. " +
        "Return the grading JSON — no other text.";
    }

    const gradeContentBlocks: ContentBlock[] = [];
    for (const img of images) {
      gradeContentBlocks.push({ type: "text", text: `[Image: ${img.label}]` });
      gradeContentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: img.media_type, data: img.base64 },
      });
    }
    gradeContentBlocks.push({ type: "text", text: analysisInstruction });

    const gradeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
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
