/**
 * Outreach Sender - SILENT MODE
 * 
 * NOTIFICATION POLICY (STRICT):
 * ❌ NO Telegram notifications for leads/outreach
 * ❌ NO Telegram for high-intent signals
 * ✅ Only LOG to database and console
 * 
 * Telegram is reserved ONLY for:
 * - Confirmed payments (coinbase-webhook)
 * - Daily summary (daily-autonomous-report)
 * - CRITICAL/FATAL system errors
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const adminToken = Deno.env.get("ADMIN_API_TOKEN") || "";
    const authHeader = req.headers.get("authorization") || "";

    if (!adminToken || !authHeader.includes(adminToken)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      mustEnv("SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const body = await req.json();
    const jobId = body.job_id;

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: "job_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // ========== SILENT MODE: Log only, NO Telegram ==========
    // Per notification policy: Telegram reserved for payments, daily report, critical errors only
    
    console.log(`📝 Job ${jobId} logged (SILENT MODE - no Telegram)`);
    console.log(`   Source: ${job.source}, Topic: ${job.intent_topic}, Confidence: ${conf}`);

    // Increment daily limit for tracking purposes
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

    // Mark as processed (not "sent" since we didn't actually send to Telegram)
    await supabase
      .from("outreach_jobs")
      .update({
        status: "processed", // Changed from "sent" - indicates logged but not notified
        provider_response: { silent_mode: true, reason: "notification_policy" },
        gate_fail_reason: null,
        next_retry_at: null,
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ ok: true, logged: true, silent_mode: true }),
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
