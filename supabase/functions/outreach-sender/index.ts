/**
 * Outreach Sender - Kill Gates + Rate Limit + Telegram Send
 * שליחה אוטומטית עם Kill Gates, Rate Limiter ו-Self-Heal
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

function escapeHtml(s: string): string {
  return (s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildMessage(job: Record<string, unknown>): string {
  const lead = (job.lead_payload || {}) as Record<string, unknown>;
  const threadUrl = (lead.thread_url || lead.url || "") as string;
  const title = (lead.thread_title || lead.title || "") as string;
  const author = (lead.author_handle || lead.author || "") as string;
  const conf = Number(job.confidence || 0);

  const header = 
    `🎯 <b>HIGH INTENT</b> (${Math.round(conf * 100)}%)\n` +
    `Topic: <b>${escapeHtml(job.intent_topic as string || "unknown")}</b>\n` +
    `Source: <b>${escapeHtml(job.source as string || "unknown")}</b>\n`;

  const leadLine = 
    (title ? `\n🧵 <b>${escapeHtml(title)}</b>\n` : "\n") +
    (author ? `👤 ${escapeHtml(author)}\n` : "") +
    (threadUrl ? `🔗 ${escapeHtml(threadUrl)}\n` : "");

  // CTA - auto-generate from Supabase URL if not set
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] || "";
  const defaultLanding = projectRef ? `https://${projectRef}.lovable.app/landing` : "";
  const cta = Deno.env.get("MICRO_LANDING_URL") || defaultLanding;
  const ctaLine = cta ? `\n👉 <b>Try Micro:</b> ${escapeHtml(cta)}\n` : "";

  const draft = `\n✍️ <b>Auto Draft</b>:\n${escapeHtml((job.revised_text || job.draft_text || "") as string)}\n`;

  return header + leadLine + ctaLine + draft;
}

async function telegramSend(text: string): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const token = mustEnv("TELEGRAM_BOT_TOKEN");
  const chatId = mustEnv("TELEGRAM_CHAT_ID");

  const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const json = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, json };
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

    // ========== SEND ==========
    await supabase
      .from("outreach_jobs")
      .update({
        status: "sending",
        attempts: (job.attempts || 0) + 1,
      })
      .eq("id", jobId);

    const message = buildMessage(job);
    console.log(`📨 Sending to Telegram: ${message.slice(0, 100)}...`);

    const tg = await telegramSend(message);

    if (!tg.ok) {
      const retryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
      console.error(`❌ Telegram failed: ${tg.status}`, tg.json);

      // Check if dead (too many attempts)
      const attempts = (job.attempts || 0) + 1;
      const newStatus = attempts >= 5 ? "dead" : "failed";

      await supabase
        .from("outreach_jobs")
        .update({
          status: newStatus,
          provider_response: tg.json || {},
          gate_fail_reason: `telegram_failed:${tg.status}`,
          next_retry_at: newStatus === "failed" ? retryAt : null,
        })
        .eq("id", jobId);

      return new Response(
        JSON.stringify({ ok: false, sent: false, error: "telegram_failed", status: tg.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messageId = (tg.json?.result as Record<string, unknown>)?.message_id?.toString() || null;
    console.log(`✅ Sent! message_id: ${messageId}`);

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
        provider_message_id: messageId,
        provider_response: tg.json || {},
        gate_fail_reason: null,
        next_retry_at: null,
      })
      .eq("id", jobId);

    return new Response(
      JSON.stringify({ ok: true, sent: true, message_id: messageId }),
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
