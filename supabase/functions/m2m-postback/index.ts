import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
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

    // Prevent double-confirm
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
            text: `💰 M2M Postback Confirmed!\nDispatch: ${dispatch_id}\nRevenue: $${actualRevenue.toFixed(2)}`,
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
