/**
 * Checkout Recovery Sequence
 * Sends 15% welcome discount to abandoned leads via Telegram
 * Targets leads with closing_attempts but no confirmed payment
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Find abandoned checkouts: closing_attempts with no matching confirmed payment
    const { data: abandoned, error } = await supabase
      .from("closing_attempts")
      .select("id, opportunity_id, checkout_url, metadata_json, created_at")
      .eq("result", "pending")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(250);

    if (error) throw error;

    const results = { total_abandoned: abandoned?.length || 0, recovered: 0, messages_sent: 0 };

    if (!abandoned || abandoned.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No abandoned checkouts found", ...results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate discount code
    const discountCode = `WELCOME15_${Date.now().toString(36).toUpperCase()}`;

    // Get frontend URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] || "app";
    const frontendUrl = `https://${projectRef}.lovable.app`;

    // Build recovery messages and queue them
    const uniqueOpps = new Set<string>();
    
    for (const attempt of abandoned) {
      const oppId = attempt.opportunity_id;
      if (uniqueOpps.has(oppId)) continue;
      uniqueOpps.add(oppId);

      // Get opportunity details
      const { data: opp } = await supabase
        .from("opportunities")
        .select("id, signal_id_v2, composite_score, offer_id")
        .eq("id", oppId)
        .single();

      if (!opp) continue;

      // Get offer details
      const { data: offer } = await supabase
        .from("offers")
        .select("code, name, name_he")
        .eq("id", opp.offer_id)
        .single();

      const offerName = offer?.name_he || offer?.name || "שירות מקצועי";
      const offerCode = offer?.code || "starter";

      // Build recovery landing URL with discount
      const recoveryUrl = `${frontendUrl}/landing?offer=${offerCode}&discount=${discountCode}&recovery=true`;

      const recoveryMessage = 
        `🔔 *הצעה מיוחדת עבורך*\n\n` +
        `שמנו לב שהתעניינת ב-${offerName} אך לא השלמת את הרכישה.\n\n` +
        `🎁 *קוד הנחה 15%: ${discountCode}*\n` +
        `✅ תקף ל-48 שעות בלבד\n` +
        `✅ 100% החזר כספי - 7 ימים\n\n` +
        `🔗 לרכישה במחיר מיוחד: ${recoveryUrl}\n\n` +
        `_הנחה חד-פעמית • תשלום מאובטח_`;

      // Queue to outreach
      await supabase.from("outreach_jobs").insert({
        type: "recovery",
        channel: "telegram",
        payload: {
          opportunity_id: oppId,
          message: recoveryMessage,
          discount_code: discountCode,
          recovery_url: recoveryUrl,
        },
        status: "ready_to_send",
      });

      // Update closing attempt
      await supabase
        .from("closing_attempts")
        .update({
          result: "recovery_sent",
          metadata_json: {
            ...((attempt.metadata_json as Record<string, unknown>) || {}),
            recovery_discount: discountCode,
            recovery_sent_at: new Date().toISOString(),
          },
        })
        .eq("id", attempt.id);

      results.messages_sent++;
    }

    results.recovered = results.messages_sent;

    // Send Telegram summary
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
    if (botToken && chatId) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔄 <b>Checkout Recovery Deployed</b>\n\n` +
            `📊 Abandoned: ${results.total_abandoned}\n` +
            `📨 Recovery Messages: ${results.messages_sent}\n` +
            `🎁 Discount: 15% (${discountCode})\n` +
            `⏰ Valid: 48 hours`,
          parse_mode: "HTML",
        }),
      }).catch(console.error);
    }

    console.log(`✅ Recovery: ${results.messages_sent} messages sent from ${results.total_abandoned} abandoned checkouts`);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Recovery error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
