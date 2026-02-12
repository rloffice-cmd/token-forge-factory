/**
 * Outreach Limiter — Domain Warm-Up Logic
 * 
 * Rules:
 * - Day 1-3: Max 20 emails/day
 * - Day 4+: Increase by 20% daily (compound)
 * - If limit reached, move leads to 'queued' for next day
 * - Tracks daily count in system_metrics table
 * 
 * Called BEFORE any email send to check/enforce limits.
 * Can also be called standalone to get current warm-up status.
 * 
 * SECURITY: INTERNAL_CRON + ADMIN_API_TOKEN
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const BASE_DAILY_LIMIT = 20;
const WARMUP_DAYS = 3;
const DAILY_INCREASE_RATE = 0.20; // 20% daily increase after warm-up period

function calculateDailyLimit(daysSinceStart: number): number {
  if (daysSinceStart < WARMUP_DAYS) return BASE_DAILY_LIMIT;
  const extraDays = daysSinceStart - WARMUP_DAYS;
  return Math.floor(BASE_DAILY_LIMIT * Math.pow(1 + DAILY_INCREASE_RATE, extraDays + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const cronSecret = req.headers.get("x-cron-secret");
  const adminToken = req.headers.get("x-admin-token");
  const authHeader = req.headers.get("authorization") || "";
  const expectedCron = Deno.env.get("CRON_SECRET");
  const expectedAdmin = Deno.env.get("ADMIN_API_TOKEN");

  if (cronSecret !== expectedCron && adminToken !== expectedAdmin && !(expectedAdmin && authHeader.includes(expectedAdmin))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action || "check"; // "check" | "increment" | "status"

    const today = new Date().toISOString().slice(0, 10);

    // Get warm-up start date
    const { data: startMetric } = await supabase
      .from("system_metrics")
      .select("*")
      .eq("metric_name", "warmup_start_date")
      .eq("metric_type", "outreach")
      .maybeSingle();

    let warmupStartDate: string;
    if (!startMetric) {
      warmupStartDate = today;
      await supabase.from("system_metrics").insert({
        metric_name: "warmup_start_date",
        metric_value: 0,
        metric_type: "outreach",
        dimensions: { start_date: today },
      });
    } else {
      warmupStartDate = (startMetric.dimensions as any)?.start_date || today;
    }

    const daysSinceStart = Math.floor(
      (new Date(today).getTime() - new Date(warmupStartDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const dailyLimit = calculateDailyLimit(daysSinceStart);

    // Get today's send count
    const { data: todayMetric } = await supabase
      .from("system_metrics")
      .select("*")
      .eq("metric_name", `emails_sent_${today}`)
      .eq("metric_type", "outreach")
      .maybeSingle();

    const sentToday = todayMetric?.metric_value || 0;
    const canSend = sentToday < dailyLimit;
    const remaining = Math.max(0, dailyLimit - sentToday);

    if (action === "increment") {
      const incrementBy = body.count || 1;
      const newCount = sentToday + incrementBy;

      if (todayMetric) {
        await supabase.from("system_metrics")
          .update({ metric_value: newCount })
          .eq("id", todayMetric.id);
      } else {
        await supabase.from("system_metrics").insert({
          metric_name: `emails_sent_${today}`,
          metric_value: incrementBy,
          metric_type: "outreach",
          dimensions: { date: today, limit: dailyLimit, warmup_day: daysSinceStart },
        });
      }

      // If limit reached, queue remaining leads
      if (newCount >= dailyLimit) {
        const { count } = await supabase
          .from("auto_leads")
          .update({ status: "queued" })
          .eq("status", "discovered")
          .select("id", { count: "exact", head: true });

        console.log(`📬 Daily limit reached (${newCount}/${dailyLimit}). Queued ${count || 0} leads for tomorrow.`);
      }

      return new Response(JSON.stringify({
        ok: true,
        sent_today: newCount,
        daily_limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - newCount),
        warmup_day: daysSinceStart,
        can_send: newCount < dailyLimit,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // "check" or "status"
    return new Response(JSON.stringify({
      ok: true,
      can_send: canSend,
      sent_today: sentToday,
      daily_limit: dailyLimit,
      remaining,
      warmup_day: daysSinceStart,
      warmup_start: warmupStartDate,
      warmup_phase: daysSinceStart < WARMUP_DAYS ? "warming_up" : "scaled",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("outreach-limiter error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
