/**
 * Autonomous Dispatch V1.0 — Full No-Human-In-The-Loop
 * 
 * Runs on cron: every 6 hours
 * 1. Pulls high-relevance leads (score >= 80) from demand_signals
 * 2. Matches each to best m2m_partner by keyword/category
 * 3. Generates Value-Bridge V3.0 outreach via AI
 * 4. Injects affiliate link and dispatches immediately (no draft queue)
 * 5. Logs to m2m_ledger for revenue tracking
 * 
 * SECURITY: INTERNAL_CRON - Requires x-cron-secret header
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyCronSecret, unauthorizedResponse, logSecurityEvent, corsHeaders } from "../_shared/auth-guards.ts";

interface Partner {
  id: string;
  name: string;
  affiliate_base_url: string;
  commission_rate: number;
  category_tags: string[];
  keyword_triggers: string[];
}

interface Signal {
  id: string;
  query_text: string;
  source_url: string;
  category: string | null;
  relevance_score: number;
  payload_json: Record<string, unknown>;
  source_id: string | null;
}

function matchPartner(signal: Signal, partners: Partner[]): Partner | null {
  const text = `${signal.query_text} ${signal.category || ""} ${JSON.stringify(signal.payload_json)}`.toLowerCase();
  let best: Partner | null = null;
  let bestScore = 0;

  for (const p of partners) {
    let score = 0;
    for (const kw of p.keyword_triggers || []) {
      if (text.includes(kw.toLowerCase())) score += 3;
    }
    for (const tag of p.category_tags || []) {
      if (text.includes(tag.toLowerCase())) score += 2;
    }
    if (text.includes(p.name.toLowerCase())) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  // Fallback: highest commission partner
  if (!best && partners.length > 0) {
    best = partners.reduce((a, b) => a.commission_rate > b.commission_rate ? a : b);
  }

  return best;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Security: Verify cron secret
  const authResult = verifyCronSecret(req);
  if (!authResult.authorized) {
    await logSecurityEvent(supabase, "cron_unauthorized", {
      endpoint: "autonomous-dispatch",
      error: authResult.error,
    });
    return unauthorizedResponse(authResult.error!, "autonomous-dispatch");
  }

  try {
    // ========== SAFETY CHECKS ==========
    const { data: settings } = await supabase
      .from("brain_settings")
      .select("brain_enabled, outreach_enabled, emergency_stop, throttle_until, max_daily_outreach")
      .single();

    if (settings?.emergency_stop) {
      return new Response(JSON.stringify({ ok: false, reason: "emergency_stop" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!settings?.brain_enabled || !settings?.outreach_enabled) {
      return new Response(JSON.stringify({ ok: false, reason: "outreach_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Throttle check
    if (settings.throttle_until && new Date(settings.throttle_until) > new Date()) {
      return new Response(JSON.stringify({ ok: false, reason: "throttle_active", until: settings.throttle_until }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== FETCH HIGH-RELEVANCE SIGNALS ==========
    const { data: signals } = await supabase
      .from("demand_signals")
      .select("*")
      .eq("status", "new")
      .gte("relevance_score", 0.8)
      .order("relevance_score", { ascending: false })
      .limit(20);

    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ ok: true, dispatched: 0, reason: "no_qualifying_signals" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== FETCH ACTIVE PARTNERS ==========
    const { data: partners } = await supabase
      .from("m2m_partners")
      .select("*")
      .eq("is_active", true);

    if (!partners || partners.length === 0) {
      return new Response(JSON.stringify({ ok: false, reason: "no_active_partners" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== DAILY CAP CHECK ==========
    const today = new Date().toISOString().slice(0, 10);
    const { data: lim } = await supabase
      .from("outreach_limits")
      .select("*")
      .eq("limit_date", today)
      .maybeSingle();

    const sentCount = Number((lim as Record<string, unknown>)?.sent_count || 0);
    const maxDaily = settings.max_daily_outreach || 100;
    const remaining = maxDaily - sentCount;

    if (remaining <= 0) {
      return new Response(JSON.stringify({ ok: false, reason: "daily_cap_reached", sent: sentCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== AUTO-DISPATCH LOOP ==========
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const results: Array<{ signal_id: string; partner: string; dispatched: boolean }> = [];
    let dispatched = 0;

    for (const signal of (signals as Signal[]).slice(0, remaining)) {
      const matched = matchPartner(signal, partners as Partner[]);
      if (!matched) continue;

      const partnerSlug = matched.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      if (!matched) continue;

      // Generate Value-Bridge outreach via AI
      let aiDraft = "";
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
            "X-Title": "Autonomous Dispatch V1",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You write technical outreach using the VALUE-BRIDGE V4.0 framework. Structure:

Phase 1 — THE MIRROR: Acknowledge the EXACT technical pain using THEIR terminology. Show you understand deeply.
Phase 2 — THE INSIGHT: Provide ONE genuinely useful, actionable technical tip they can implement immediately. This builds trust.
Phase 3 — THE RECOMMENDATION: Connect the insight to ${matched.name} naturally. Example: "To automate this at scale, I've been using ${matched.name} because it handles [specific feature] natively."
Phase 4 — THE LINK: End with the internal tracking link on its own line. No "click here" — just the URL.

Rules:
- Max 5 sentences + link. Sound like a senior peer.
- NEVER mention affiliates, commissions, bots, or AI.
- Detect the lead's language → write in THAT language exactly.
- Use forensic technical proof (specific config details, version numbers, etc.).
- Return plain text only.`,
              },
              {
                role: "user",
                content: `Lead: "${signal.query_text}"
Source: ${signal.source_url || "forum"}
Category: ${signal.category || "general"}
Details: ${JSON.stringify(signal.payload_json).slice(0, 600)}
Partner: ${matched.name} (${matched.category_tags?.join(", ")})
Link: ${supabaseUrl}/functions/v1/affiliate-redirect?partner=${partnerSlug}&lead=${signal.id}&src=${signal.category || "auto"}`,
              },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          aiDraft = aiData.choices?.[0]?.message?.content || "";
        }
      } catch {
        console.warn(`AI generation failed for signal ${signal.id}`);
      }

      if (!aiDraft) {
        // Log to manual_outreach_needed table if AI generation fails
        await supabase.from("manual_outreach_needed").insert({
          signal_id: signal.id,
          partner_name: matched.name,
          reason: "ai_generation_failed",
          outreach_text: `[AI Generation Failed] Lead: "${signal.query_text.slice(0, 100)}"`,
        }).catch(() => {}); // Silent fail to avoid blocking dispatch loop
        continue;
      }

      // Create outreach job directly as 'sent' (no draft queue)
      await supabase.from("outreach_jobs").insert({
        source: signal.category || "auto",
        channel: "auto",
        destination: "community",
        intent_topic: matched.category_tags?.join(", ") || matched.name,
        confidence: signal.relevance_score,
        draft_text: aiDraft,
        revised_text: aiDraft,
        lead_payload: {
          thread_title: signal.query_text,
          thread_url: signal.source_url,
          author_handle: (signal.payload_json as Record<string, unknown>)?.author || "unknown",
        },
        status: "sent",
        provider_response: {
          partner: matched.name,
          affiliate_link: matched.affiliate_base_url,
          dispatched_at: new Date().toISOString(),
          auto_dispatch: true,
        },
      });

      // Log to m2m_ledger
      await supabase.from("m2m_ledger").insert({
        signal_id: signal.id,
        partner_id: matched.id,
        affiliate_link: matched.affiliate_base_url,
        status: "dispatched",
        estimated_bounty_usd: matched.commission_rate,
        dispatched_at: new Date().toISOString(),
      });

      // Mark signal as processed
      await supabase
        .from("demand_signals")
        .update({ status: "dispatched", m2m_status: "dispatched" })
        .eq("id", signal.id);

      // Update partner dispatch count
      await supabase.rpc("increment_partner_dispatches", { partner_row_id: matched.id }).catch(() => {});

      dispatched++;
      results.push({ signal_id: signal.id, partner: matched.name, dispatched: true });
      
      // Log successful dispatch
      await supabase.from("manual_outreach_needed").insert({
        signal_id: signal.id,
        partner_name: matched.name,
        outreach_text: aiDraft,
        reason: "auto_dispatched_success",
        resolved_at: new Date().toISOString(),
      }).catch(() => {}); // Silent logging
      
      console.log(`✅ Auto-dispatched: "${signal.query_text.slice(0, 60)}" → ${matched.name}`);
    }

    // Update daily limit
    if (lim) {
      await supabase
        .from("outreach_limits")
        .update({ sent_count: sentCount + dispatched })
        .eq("id", (lim as Record<string, unknown>).id);
    } else {
      await supabase.from("outreach_limits").insert({
        limit_date: today,
        sent_count: dispatched,
        cap_count: maxDaily,
      });
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      job_id: "00000000-0000-0000-0000-000000000000",
      action: "autonomous-dispatch:completed",
      metadata: { dispatched, total_signals: signals.length, partners_used: [...new Set(results.map((r) => r.partner))] },
    });

    // Telegram summary if dispatched > 0
    if (dispatched > 0) {
      const partnerSummary = results.reduce((acc, r) => {
        acc[r.partner] = (acc[r.partner] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      await supabase.functions.invoke("telegram-notify", {
        body: {
          message: `🤖 <b>Autonomous Dispatch Complete</b>\n\n✅ ${dispatched} leads dispatched\n📊 ${Object.entries(partnerSummary).map(([p, c]) => `${p}: ${c}`).join(", ")}\n⚡ Mode: Full Autopilot`,
          type: "dispatch_complete",
        },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, dispatched, total_signals: signals.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("autonomous-dispatch error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
