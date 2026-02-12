import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * PayPal Payout Edge Function
 * Uses PayPal NVP (Name-Value Pair) API for MassPay
 * Protected by ADMIN_API_TOKEN
 */

const PAYPAL_NVP_ENDPOINT = "https://api-3t.paypal.com/nvp";

interface PayoutRequest {
  email: string;
  amount_usd: number;
  note?: string;
  cashout_id?: string;
}

async function executePayPalPayout(payout: PayoutRequest): Promise<{
  success: boolean;
  correlation_id?: string;
  error?: string;
}> {
  const username = Deno.env.get("PAYPAL_API_USERNAME");
  const password = Deno.env.get("PAYPAL_API_PASSWORD");
  const signature = Deno.env.get("PAYPAL_API_SIGNATURE");

  if (!username || !password || !signature) {
    throw new Error("PayPal API credentials not configured");
  }

  const params = new URLSearchParams({
    METHOD: "MassPay",
    VERSION: "93",
    USER: username,
    PWD: password,
    SIGNATURE: signature,
    RECEIVERTYPE: "EmailAddress",
    CURRENCYCODE: "USD",
    L_EMAIL0: payout.email,
    L_AMT0: payout.amount_usd.toFixed(2),
    L_NOTE0: payout.note || "Lead-Forge Payout",
    L_UNIQUEID0: payout.cashout_id || `payout-${Date.now()}`,
  });

  const response = await fetch(PAYPAL_NVP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const text = await response.text();
  const result = Object.fromEntries(new URLSearchParams(text));

  if (result.ACK === "Success" || result.ACK === "SuccessWithWarning") {
    return {
      success: true,
      correlation_id: result.CORRELATIONID,
    };
  }

  return {
    success: false,
    correlation_id: result.CORRELATIONID,
    error: `${result.L_SHORTMESSAGE0 || "Unknown error"}: ${result.L_LONGMESSAGE0 || ""}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: require admin token
    const adminToken = Deno.env.get("ADMIN_API_TOKEN");
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!adminToken || token !== adminToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { email, amount_usd, note, cashout_id } = body;

    if (!email || !amount_usd || amount_usd <= 0) {
      return new Response(
        JSON.stringify({ error: "email and positive amount_usd required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute payout
    const result = await executePayPalPayout({ email, amount_usd, note, cashout_id });

    // Record in treasury ledger
    if (result.success) {
      await supabase.from("treasury_ledger").insert({
        direction: "OUT",
        amount: amount_usd,
        amount_usd: amount_usd,
        source: "paypal_payout",
        ref_id: cashout_id || result.correlation_id,
        note: `PayPal payout to ${email}`,
        tx_hash: result.correlation_id,
      });

      // Update cashout request if provided
      if (cashout_id) {
        await supabase
          .from("cashout_requests")
          .update({
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
            tx_hash: result.correlation_id,
          })
          .eq("id", cashout_id);
      }

      // Telegram notification
      try {
        const telegramToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
        const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
        if (telegramToken && chatId) {
          await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `💸 PayPal Payout Sent!\nTo: ${email}\nAmount: $${amount_usd.toFixed(2)}\nCorrelation: ${result.correlation_id}`,
            }),
          });
        }
      } catch (_) {
        // Non-critical
      }
    }

    return new Response(
      JSON.stringify(result),
      { status: result.success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("PayPal payout error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
