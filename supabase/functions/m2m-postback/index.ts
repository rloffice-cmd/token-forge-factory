/**
 * M2M Postback v2 — Automated Revenue Bridge
 * On confirmed conversion:
 * 1. Update m2m_ledger
 * 2. Create affiliate_earnings record linked to click
 * 3. Record in treasury_ledger as 'affiliate_revenue'
 * 4. Anti-fraud: flag suspicious partners (CTR > 90%)
 * 5. Notify via Telegram
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logSecurityEvent, getClientIP, checkRateLimit, corsHeaders } from '../_shared/auth-guards.ts';

async function verifyPostbackSignature(payload: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  try {
    const sigValue = signature.replace('sha256=', '');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const expectedSig = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    return sigValue.toLowerCase() === expectedSig.toLowerCase();
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const clientIP = getClientIP(req);

  // Rate limiting
  const isRateLimited = await checkRateLimit(supabase, `postback:${clientIP}`, 60, 1);
  if (isRateLimited) {
    await logSecurityEvent(supabase, 'postback_rate_limited', { endpoint: 'm2m-postback', ip: clientIP });
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const rawBody = await req.text();
    let body: any;
    try { body = JSON.parse(rawBody); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // HMAC verification
    const webhookSecret = Deno.env.get("PARTNERSTACK_WEBHOOK_SECRET");
    if (webhookSecret) {
      const signature = req.headers.get("x-partnerstack-signature") || req.headers.get("x-webhook-signature") || req.headers.get("x-signature");
      const valid = await verifyPostbackSignature(rawBody, signature, webhookSecret);
      if (!valid) {
        await logSecurityEvent(supabase, 'postback_invalid_signature', { endpoint: 'm2m-postback', ip: clientIP });
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const { dispatch_id, status, revenue_usd, metadata, click_id, program_id } = body;

    if (!dispatch_id) {
      return new Response(JSON.stringify({ error: "dispatch_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify dispatch exists
    const { data: dispatch, error: fetchErr } = await supabase
      .from("m2m_ledger").select("id, partner_id, status").eq("id", dispatch_id).maybeSingle();

    if (fetchErr || !dispatch) {
      return new Response(JSON.stringify({ error: "dispatch not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Idempotency
    if (dispatch.status === "confirmed" && status === "confirmed") {
      return new Response(JSON.stringify({ ok: true, message: "already confirmed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const newStatus = status || "confirmed";
    const actualRevenue = revenue_usd ? Number(revenue_usd) : 0;

    // Update dispatch
    await supabase.from("m2m_ledger").update({
      status: newStatus,
      actual_revenue_usd: actualRevenue,
      confirmed_at: newStatus === "confirmed" ? new Date().toISOString() : null,
      postback_log: metadata || {},
    }).eq("id", dispatch_id);

    await logSecurityEvent(supabase, 'postback_received', { endpoint: 'm2m-postback', dispatch_id, status: newStatus, revenue_usd: actualRevenue, ip: clientIP });

    if (newStatus === "confirmed" && actualRevenue > 0) {
      // 1. Update partner stats
      const { data: partner } = await supabase
        .from("m2m_partners").select("id, total_conversions, total_revenue_usd, total_dispatches").eq("id", dispatch.partner_id).maybeSingle();

      if (partner) {
        const newConversions = (partner.total_conversions || 0) + 1;
        const newRevenue = Number(partner.total_revenue_usd || 0) + actualRevenue;
        const dispatches = partner.total_dispatches || 0;

        // Anti-fraud: flag if click-to-lead ratio > 90%
        const suspicious = dispatches > 10 && (newConversions / dispatches) > 0.9;

        await supabase.from("m2m_partners").update({
          total_conversions: newConversions,
          total_revenue_usd: newRevenue,
          ...(suspicious ? { suspicious: true, suspicious_reason: `CTR ${((newConversions/dispatches)*100).toFixed(1)}% > 90% threshold` } : {}),
        }).eq("id", dispatch.partner_id);
      }

      // 2. Create affiliate_earnings record linked to click
      const earningData: any = {
        program_id: program_id || dispatch.partner_id,
        amount_usd: actualRevenue,
        status: 'confirmed',
        earned_at: new Date().toISOString(),
        reference_id: dispatch_id,
        notes: `M2M postback conversion`,
        currency: 'USD',
      };
      if (click_id) earningData.click_id = click_id;

      await supabase.from("affiliate_earnings").insert(earningData);

      // 3. Record in treasury_ledger as 'affiliate_revenue' — audit trail
      await supabase.from("treasury_ledger").insert({
        direction: "IN",
        amount: actualRevenue,
        amount_usd: actualRevenue,
        currency: "USD",
        network: "base",
        source: "affiliate_revenue",
        ref_id: dispatch_id,
        note: `M2M affiliate commission from partner ${dispatch.partner_id}`,
      });

      // 4. Telegram notification
      try {
        const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
        const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
        if (telegramToken && chatId) {
          await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `💰 איתי!!! M2M Postback Confirmed!\nDispatch: ${dispatch_id}\nRevenue: $${actualRevenue.toFixed(2)}`,
              parse_mode: "HTML",
            }),
          });
        }
      } catch (_) { /* Non-critical */ }
    }

    return new Response(JSON.stringify({ ok: true, status: newStatus, revenue: actualRevenue }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Postback error:", err);
    return new Response(JSON.stringify({ error: "internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
