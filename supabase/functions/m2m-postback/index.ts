import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyWebhookToken, logSecurityEvent, getClientIP, checkRateLimit, corsHeaders } from '../_shared/auth-guards.ts';

// HMAC signature verification for PartnerStack/Reditus postbacks
async function verifyPostbackSignature(payload: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;
  try {
    const sigValue = signature.replace('sha256=', '');
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return sigValue.toLowerCase() === expectedSig.toLowerCase();
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const clientIP = getClientIP(req);

  // Rate limiting: Max 60 postbacks per minute per IP
  const isRateLimited = await checkRateLimit(supabase, `postback:${clientIP}`, 60, 1);
  if (isRateLimited) {
    await logSecurityEvent(supabase, 'postback_rate_limited', {
      endpoint: 'm2m-postback',
      ip: clientIP,
    });
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional HMAC verification if PARTNERSTACK_WEBHOOK_SECRET is set
    const webhookSecret = Deno.env.get("PARTNERSTACK_WEBHOOK_SECRET");
    if (webhookSecret) {
      const signature = req.headers.get("x-partnerstack-signature") ||
                        req.headers.get("x-webhook-signature") ||
                        req.headers.get("x-signature");
      const valid = await verifyPostbackSignature(rawBody, signature, webhookSecret);
      if (!valid) {
        await logSecurityEvent(supabase, 'postback_invalid_signature', {
          endpoint: 'm2m-postback',
          ip: clientIP,
        });
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const { dispatch_id, status, revenue_usd, metadata } = body;

    if (!dispatch_id) {
      return new Response(
        JSON.stringify({ error: "dispatch_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify dispatch exists
    const { data: dispatch, error: fetchErr } = await supabase
      .from("m2m_ledger")
      .select("id, partner_id, status")
      .eq("id", dispatch_id)
      .maybeSingle();

    if (fetchErr || !dispatch) {
      return new Response(
        JSON.stringify({ error: "dispatch not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent double-confirm (idempotency)
    if (dispatch.status === "confirmed" && status === "confirmed") {
      return new Response(
        JSON.stringify({ ok: true, message: "already confirmed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newStatus = status || "confirmed";
    const actualRevenue = revenue_usd ? Number(revenue_usd) : 0;

    // Update dispatch
    const { error: updateErr } = await supabase
      .from("m2m_ledger")
      .update({
        status: newStatus,
        actual_revenue_usd: actualRevenue,
        confirmed_at: newStatus === "confirmed" ? new Date().toISOString() : null,
        postback_log: metadata || {},
      })
      .eq("id", dispatch_id);

    if (updateErr) throw updateErr;

    // Log security event for audit trail
    await logSecurityEvent(supabase, 'postback_received', {
      endpoint: 'm2m-postback',
      dispatch_id,
      status: newStatus,
      revenue_usd: actualRevenue,
      ip: clientIP,
    });

    // Update partner stats if confirmed
    if (newStatus === "confirmed" && actualRevenue > 0) {
      const { data: partner } = await supabase
        .from("m2m_partners")
        .select("total_conversions, total_revenue_usd")
        .eq("id", dispatch.partner_id)
        .maybeSingle();

      if (partner) {
        await supabase
          .from("m2m_partners")
          .update({
            total_conversions: (partner.total_conversions || 0) + 1,
            total_revenue_usd: Number(partner.total_revenue_usd || 0) + actualRevenue,
          })
          .eq("id", dispatch.partner_id);
      }

      // Record in treasury ledger
      await supabase.from("treasury_ledger").insert({
        direction: "IN",
        amount: actualRevenue,
        amount_usd: actualRevenue,
        source: "m2m_postback",
        ref_id: dispatch_id,
        note: `M2M commission from partner`,
      });
    }

    // Notify via Telegram
    try {
      const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
      if (telegramToken && chatId && newStatus === "confirmed") {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `💰 M2M Postback Confirmed!\nDispatch: ${dispatch_id}\nRevenue: $${actualRevenue.toFixed(2)}\nIP: ${clientIP}`,
            parse_mode: "HTML",
          }),
        });
      }
    } catch (_) {
      // Non-critical
    }

    return new Response(
      JSON.stringify({ ok: true, status: newStatus, revenue: actualRevenue }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Postback error:", err);
    return new Response(
      JSON.stringify({ error: "internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
