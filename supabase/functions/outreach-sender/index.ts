/**
 * Outreach Sender - SILENT MODE + THROTTLE AWARE
 * 
 * NOTIFICATION POLICY (STRICT):
 * ❌ NO Telegram notifications for leads/outreach
 * ❌ NO Telegram for high-intent signals
 * ✅ Only LOG to database and console
 * 
 * THROTTLE POLICY (CRITICAL):
 * ✅ Check throttle_until BEFORE sending
 * ✅ Mark jobs as "deferred" if throttle active
 * ✅ Set next_retry_at to after throttle expires
 * 
 * Telegram is reserved ONLY for:
 * - Confirmed payments (coinbase-webhook)
 * - Daily summary (daily-autonomous-report)
 * - CRITICAL/FATAL system errors
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { isThrottleActive } from "../_shared/master-prompt-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function mustEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: Accept EITHER ADMIN_API_TOKEN or x-cron-secret
    const adminToken = Deno.env.get("ADMIN_API_TOKEN") || "";
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const authHeader = req.headers.get("authorization") || "";
    const cronHeader = req.headers.get("x-cron-secret") || "";

    const isAdminAuth = adminToken && authHeader.includes(adminToken);
    const isCronAuth = cronSecret && cronHeader === cronSecret;

    if (!isAdminAuth && !isCronAuth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      mustEnv("SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // ========== THROTTLE CHECK (BEFORE ANYTHING ELSE) ==========
    const { data: settings } = await supabase
      .from("brain_settings")
      .select("throttle_until, throttle_reason, outreach_enabled")
      .single();

    const throttleUntil = settings?.throttle_until;
    const throttleActive = isThrottleActive(throttleUntil);
    
    // If outreach is disabled globally, reject immediately
    if (settings && !settings.outreach_enabled) {
      console.log("🚫 Outreach disabled globally");
      return new Response(
        JSON.stringify({ ok: false, blocked: true, reason: "outreach_disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const jobId = body.job_id;

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "job_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If throttle is active, defer ALL jobs without processing
    if (throttleActive) {
      const deferUntil = new Date(new Date(throttleUntil!).getTime() + 60 * 60 * 1000).toISOString(); // 1h after throttle expires
      
      console.log(`🚫 Throttle active until ${throttleUntil}, deferring job ${jobId}`);
      
      await supabase
        .from("outreach_jobs")
        .update({
          status: "deferred",
          gate_fail_reason: `throttle_active:${settings?.throttle_reason || 'payment_throttle'}`,
          next_retry_at: deferUntil,
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({ 
          ok: false, 
          deferred: true, 
          reason: "throttle_active",
          throttle_until: throttleUntil,
          next_retry_at: deferUntil
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load job
    const { data: job, error: jobErr } = await supabase
      .from("outreach_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      throw jobErr || new Error("Job not found");
    }

    console.log(`📤 Processing job ${jobId}: status=${job.status}`);

    // Idempotency: only send if queued/failed (retry)
    if (!["queued", "failed"].includes(job.status)) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, status: job.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== KILL GATES ==========
    const lead = (job.lead_payload || {}) as Record<string, unknown>;
    const threadUrl = (lead.thread_url || lead.url) as string;
    const conf = Number(job.confidence || 0);

    // Gate 1: Lead validity - must have thread_url
    if (!threadUrl) {
      console.log(`🚫 Gate: missing_thread_url for job ${jobId}`);
      await supabase
        .from("outreach_jobs")
        .update({ status: "gated", gate_fail_reason: "missing_thread_url" })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({ ok: false, gated: true, reason: "missing_thread_url" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gate 2: Confidence threshold
    const MIN_CONF = Number(Deno.env.get("OUTREACH_MIN_CONFIDENCE") || "0.85");
    if (conf < MIN_CONF) {
      console.log(`🚫 Gate: low_confidence (${conf} < ${MIN_CONF}) for job ${jobId}`);
      await supabase
        .from("outreach_jobs")
        .update({ status: "gated", gate_fail_reason: `low_confidence:${conf}` })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({ ok: false, gated: true, reason: "low_confidence", confidence: conf }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gate 3: Daily cap
    const today = new Date().toISOString().slice(0, 10);
    const CAP = Number(Deno.env.get("OUTREACH_DAILY_CAP") || "20");

    const { data: lim } = await supabase
      .from("outreach_limits")
      .select("*")
      .eq("limit_date", today)
      .maybeSingle();

    const sentCount = Number((lim as Record<string, unknown>)?.sent_count || 0);
    const capCount = Number((lim as Record<string, unknown>)?.cap_count || CAP);

    if (sentCount >= capCount) {
      const retryAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(); // 6h
      console.log(`🚫 Gate: daily_cap_reached (${sentCount}/${capCount}) for job ${jobId}`);
      
      await supabase
        .from("outreach_jobs")
        .update({
          status: "gated",
          gate_fail_reason: "daily_cap_reached",
          next_retry_at: retryAt,
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({ ok: false, gated: true, reason: "daily_cap_reached", sent: sentCount, cap: capCount }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== ACTIVE MODE: Send Hot Leads to Telegram ==========
    console.log(`📤 Processing hot lead job ${jobId}`);
    console.log(`   Source: ${job.source}, Topic: ${job.intent_topic}, Confidence: ${conf}`);

    // Build Telegram message with lead details and AI-drafted response
    const leadTitle = lead.title || lead.author || lead.username || "Unknown Lead";
    const aiDraft = job.ai_draft || job.message_draft || "No draft available";
    
    const telegramMessage = `🎯 <b>Hot Lead Alert!</b>

<b>Source:</b> ${job.source || "Unknown"}
<b>Topic:</b> ${job.intent_topic || "General"}
<b>Confidence:</b> ${Math.round(conf * 100)}%

<b>Lead:</b> ${leadTitle}

<b>AI Draft Response:</b>
<i>${String(aiDraft).slice(0, 500)}${String(aiDraft).length > 500 ? "..." : ""}</i>

🔗 <a href="${threadUrl}">View Original Post</a>`;

    // Send to Telegram
    try {
      await supabase.functions.invoke("telegram-notify", {
        body: {
          message: telegramMessage,
          type: "hot_lead_alert",
        },
      });
      console.log(`✅ Telegram notification sent for job ${jobId}`);
    } catch (telegramError) {
      console.error(`⚠️ Telegram send failed (will continue):`, telegramError);
      // Don't fail the job if Telegram fails - just log it
    }

    // Increment daily limit
    if (lim) {
      await supabase
        .from("outreach_limits")
        .update({ sent_count: sentCount + 1 })
        .eq("id", (lim as Record<string, unknown>).id);
    } else {
      await supabase
        .from("outreach_limits")
        .insert({ limit_date: today, sent_count: 1, cap_count: capCount });
    }

    // Mark as sent
    await supabase
      .from("outreach_jobs")
      .update({
        status: "sent",
        provider_response: { telegram_sent: true, sent_at: new Date().toISOString() },
        gate_fail_reason: null,
        next_retry_at: null,
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ ok: true, sent: true, channel: "telegram" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("outreach-sender error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
