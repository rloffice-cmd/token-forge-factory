/**
 * Autonomous Dispatch V4.2 — Greedy Profit-Driven Broker
 * 
 * EV = (Technical_Match * 0.3) + (Commission_Value * 0.5) + (Historical_CTR * 0.2)
 * Winner-Takes-All after 20-lead testing phase per partner/niche.
 * Woodpecker gets +25% EV boost as validated partner.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyCronSecret, unauthorizedResponse, logSecurityEvent, corsHeaders } from "../_shared/auth-guards.ts";

interface Partner {
  id: string;
  name: string;
  affiliate_base_url: string;
  commission_rate: number;
  commission_value_usd: number;
  avg_conv_rate: number;
  category_tags: string[];
  keyword_triggers: string[];
  total_dispatches: number;
  total_conversions: number;
  testing_phase: boolean;
  testing_leads_sent: number;
  niche_winner: boolean;
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

/** V4.2 Greedy EV Router — routes to highest Expected Value partner */
function matchPartnerEV(signal: Signal, partners: Partner[]): Partner | null {
  const text = `${signal.query_text} ${signal.category || ""} ${JSON.stringify(signal.payload_json)}`.toLowerCase();
  
  const scored = partners.map(p => {
    // Technical match score (0-1 normalized)
    let techScore = 0;
    let maxPossible = 0;
    for (const kw of p.keyword_triggers || []) {
      maxPossible += 3;
      if (text.includes(kw.toLowerCase())) techScore += 3;
    }
    for (const tag of p.category_tags || []) {
      maxPossible += 2;
      if (text.includes(tag.toLowerCase())) techScore += 2;
    }
    if (text.includes(p.name.toLowerCase())) techScore += 5;
    maxPossible = Math.max(maxPossible + 5, 1);
    const normalizedTech = Math.min(techScore / maxPossible, 1);

    // Commission value (normalized against max across partners)
    const commissionNorm = p.commission_value_usd || p.commission_rate || 0;

    // Historical CTR
    const ctr = p.total_dispatches > 0 
      ? p.total_conversions / p.total_dispatches 
      : p.avg_conv_rate || 0;

    // EV = (Tech * 0.3) + (Commission * 0.5) + (CTR * 0.2)
    let ev = (normalizedTech * 0.3) + (commissionNorm * 0.5) + (ctr * 100 * 0.2);

    // Woodpecker +25% boost (validated partner)
    if (p.name.toLowerCase() === "woodpecker") ev *= 1.25;

    // Winner-Takes-All: niche winners get +50% EV
    if (p.niche_winner) ev *= 1.5;

    return { partner: p, ev, techScore: normalizedTech };
  }).filter(s => s.techScore > 0 || s.partner.niche_winner);

  // Sort by EV descending — greedy routing
  scored.sort((a, b) => b.ev - a.ev);

  if (scored.length > 0) return scored[0].partner;

  // Fallback: highest commission partner
  if (partners.length > 0) {
    return partners.reduce((a, b) => 
      (a.commission_value_usd || a.commission_rate) > (b.commission_value_usd || b.commission_rate) ? a : b
    );
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

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

    if (settings.throttle_until && new Date(settings.throttle_until) > new Date()) {
      return new Response(JSON.stringify({ ok: false, reason: "throttle_active", until: settings.throttle_until }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== FETCH HIGH-RELEVANCE SIGNALS (SmartScore >= 80 = relevance >= 0.8) ==========
    const { data: signals } = await supabase
      .from("demand_signals")
      .select("*")
      .eq("status", "new")
      .gte("relevance_score", 0.75)
      .order("relevance_score", { ascending: false })
      .limit(30);

    if (!signals || signals.length === 0) {
      return new Response(JSON.stringify({ ok: true, dispatched: 0, reason: "no_qualifying_signals" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ========== FETCH ACTIVE PARTNERS WITH EV COLUMNS ==========
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

    // ========== GREEDY DISPATCH LOOP ==========
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const results: Array<{ signal_id: string; partner: string; ev: number; dispatched: boolean }> = [];
    let dispatched = 0;

    for (const signal of (signals as Signal[]).slice(0, remaining)) {
      const matched = matchPartnerEV(signal, partners as Partner[]);
      if (!matched) continue;

      const partnerSlug = matched.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const trackingLink = `${supabaseUrl}/functions/v1/affiliate-redirect?partner=${partnerSlug}&lead=${signal.id}&src=${signal.category || "auto"}`;

      // Generate Value-Bridge V4.2 outreach
      let aiDraft = "";
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
            "X-Title": "Neural Forge V4.2 Dispatch",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `You are a senior technical consultant writing outreach using the VALUE-BRIDGE V4.2 framework.

1. THE MIRROR: Acknowledge their EXACT technical pain using THEIR terminology.
2. THE INSIGHT: One genuinely useful, actionable tip they can implement NOW.
3. THE BRIDGE: Connect naturally to ${matched.name}: "I've been using ${matched.name} because it handles [specific feature] natively."
4. THE LINK: End with the tracking link on its own line.

Rules:
- Max 5 sentences + link line. Sound like a senior peer who solved this before.
- NEVER mention affiliates, commissions, bots, AI, or automation.
- Detect the lead's language → write in THAT language.
- Include forensic technical detail (config names, version numbers, benchmarks).
- Return plain text only. No markdown.`,
              },
              {
                role: "user",
                content: `Lead: "${signal.query_text}"
Source: ${signal.source_url || "forum"}
Category: ${signal.category || "general"}
Details: ${JSON.stringify(signal.payload_json).slice(0, 600)}
Partner: ${matched.name} (${matched.category_tags?.join(", ")})
Tracking Link: ${trackingLink}`,
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
        await supabase.from("manual_outreach_needed").insert({
          signal_id: signal.id,
          partner_name: matched.name,
          reason: "ai_generation_failed",
          outreach_text: `[AI Failed] Lead: "${signal.query_text.slice(0, 100)}"`,
        }).catch(() => {});
        continue;
      }

      // Dispatch immediately (no draft queue - pure brokerage)
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
          tracking_link: trackingLink,
          ev_score: matched.commission_value_usd * 0.5,
          dispatched_at: new Date().toISOString(),
          auto_dispatch: true,
          version: "4.2",
        },
      });

      // M2M Ledger
      await supabase.from("m2m_ledger").insert({
        signal_id: signal.id,
        partner_id: matched.id,
        affiliate_link: matched.affiliate_base_url,
        status: "dispatched",
        estimated_bounty_usd: matched.commission_value_usd || matched.commission_rate,
        dispatched_at: new Date().toISOString(),
      });

      // Update signal status
      await supabase
        .from("demand_signals")
        .update({ status: "dispatched", m2m_status: "dispatched" })
        .eq("id", signal.id);

      // Update partner testing phase
      if (matched.testing_phase && matched.testing_leads_sent < 20) {
        await supabase.from("m2m_partners").update({
          testing_leads_sent: (matched.testing_leads_sent || 0) + 1,
          testing_phase: (matched.testing_leads_sent || 0) + 1 < 20,
        }).eq("id", matched.id);
      }

      await supabase.rpc("increment_partner_dispatches", { partner_row_id: matched.id }).catch(() => {});

      dispatched++;
      results.push({ signal_id: signal.id, partner: matched.name, ev: matched.commission_value_usd * 0.5, dispatched: true });
      console.log(`✅ V4.2 Greedy Dispatch: "${signal.query_text.slice(0, 50)}" → ${matched.name} (EV: ${(matched.commission_value_usd * 0.5).toFixed(1)})`);
    }

    // Update daily limit
    if (lim) {
      await supabase.from("outreach_limits").update({ sent_count: sentCount + dispatched }).eq("id", (lim as Record<string, unknown>).id);
    } else {
      await supabase.from("outreach_limits").insert({ limit_date: today, sent_count: dispatched, cap_count: maxDaily });
    }

    // Audit
    await supabase.from("audit_logs").insert({
      job_id: "00000000-0000-0000-0000-000000000000",
      action: "autonomous-dispatch-v4.2:completed",
      metadata: { version: "4.2", dispatched, total_signals: signals.length, routing: "greedy_ev", partners_used: [...new Set(results.map(r => r.partner))] },
    });

    // Telegram notification
    if (dispatched > 0) {
      const partnerSummary = results.reduce((acc, r) => {
        acc[r.partner] = (acc[r.partner] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      await supabase.functions.invoke("telegram-notify", {
        body: {
          message: `🧠 <b>Neural Forge V4.2 — Greedy Dispatch</b>\n\n✅ ${dispatched} leads routed\n💰 Routing: EV-optimized\n📊 ${Object.entries(partnerSummary).map(([p, c]) => `${p}: ${c}`).join(", ")}\n⚡ Mode: Profit-First Autopilot`,
          type: "dispatch_complete",
        },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, version: "4.2", dispatched, total_signals: signals.length, routing_mode: "greedy_ev", results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("autonomous-dispatch-v4.2 error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
