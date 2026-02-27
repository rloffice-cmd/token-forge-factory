/**
 * CollectPro AI Proxy
 *
 * Security: Keeps the Anthropic API key on the server side — never exposed to the browser.
 * Fixes Bug 1 & 2: SYSTEM_PROMPT_MARKET is always forwarded; web-search tools
 *                  no longer delete the system prompt.
 * Rate-limits: max 10 calls per minute per IP.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = "claude-opus-4-6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── System prompts ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT_BRAIN = `
אתה יועץ אמת פורנזי למשקיע קלפים מסחריים (TCG). תפקידך לנתח נתונים ולספק אמת, גם כשהיא לא נוחה.

כללים בלתי ניתנים לפשרה:
1. לעולם אל תמציא מחירים, מגמות, או ציטוטים — ציין מה ידוע ומה לא
2. הזהר תמיד לגבי אי-ודאות: "הנתון הזה אינו מדויק כי X"
3. כשה-ROI נראה טוב — שאל: מה הוצא על גריידינג? מה זמן ההחזקה? מה עמלות המכירה?
4. הגדר מראש מה נספר: עלות קנייה + עלות גריידינג = בסיס השקעה
5. "שווי מלאי" = הערכת שוק בלבד, לא רווח ממומש

הנתונים שתקבל הם נתוני הפורטפוליו הממשי של המשתמש.
ענה בעברית, בצורה ישירה וקצרה.
`.trim();

const SYSTEM_PROMPT_MARKET = `
אתה אנליסט שוק קלפים מסחריים (TCG) עם גישה לחיפוש אינטרנט בזמן אמת.
תפקידך: לספק נתוני שוק עדכניים ואמינים בלבד — לא הערכות מדומיינות.

כללים:
1. חפש תמיד ב-eBay sold listings, TCGPlayer, PSA Registry — ציין את המקור
2. הפרד בין "מחיר מוצע" לבין "מחיר מכירה מאומת"
3. ציין תאריך הנתונים שמצאת
4. אם לא מצאת נתון — אמור זאת במפורש ואל תמציא
5. כלול: טווח מחירים, מגמה (עולה/יורד/יציב), נפח מסחר אם ידוע
6. הזהר לגבי מחירים עם PSA vs ללא PSA — הם שונים מהותית

ענה בעברית, כלול מחירים בדולרים.
`.trim();

const SYSTEM_PROMPT_ARBITRAGE = `
אתה מומחה ארביטראז׳ בשוק קלפים מסחריים עם גישה לחיפוש אינטרנט בזמן אמת.
מטרתך: לזהות הזדמנויות מחיר בין פלטפורמות שונות.

כללים:
1. חפש מחירי קנייה (Troll & Toad, TCGPlayer, Facebook Groups) ומחירי מכירה (eBay, COMC)
2. חשב פוטנציאל ארביטראז׳ = מחיר מכירה — מחיר קנייה — עמלות (15% eBay) — גריידינג ($25-50)
3. ציין את רמת הסיכון: נזילות הקלף, זמן המכירה הממוצע
4. הדגל אדום: ארביטראז׳ פחות מ-$50 נטו לא שווה בדרך כלל את הזמן

ענה בעברית, כלול חישוב מפורט לכל הזדמנות.
`.trim();

// ─── In-memory rate limiter (per IP, 10 req/min) ──────────────────────────────

const rateLimitMap = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "AI service not configured." }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { messages: unknown[]; mode: "brain" | "market" | "arbitrage" };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { messages, mode = "brain" } = body;

  // ── Select system prompt based on mode ──
  const systemPrompt =
    mode === "market"
      ? SYSTEM_PROMPT_MARKET
      : mode === "arbitrage"
      ? SYSTEM_PROMPT_ARBITRAGE
      : SYSTEM_PROMPT_BRAIN;

  // ── Build Anthropic request body ──
  // CRITICAL FIX (Bug 1 & 2): system prompt is NEVER deleted when tools are present.
  // Previously: `delete body.system` was called when withSearch=true — now fixed.
  const anthropicBody: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt, // always present
    messages,
  };

  if (mode === "market" || mode === "arbitrage") {
    anthropicBody.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const anthropicHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };

  if (mode === "market" || mode === "arbitrage") {
    anthropicHeaders["anthropic-beta"] = "web-search-2025-03-05";
  }

  const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: anthropicHeaders,
    body: JSON.stringify(anthropicBody),
  });

  const responseData = await anthropicResp.json();

  return new Response(JSON.stringify(responseData), {
    status: anthropicResp.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
