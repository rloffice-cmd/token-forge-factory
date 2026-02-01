import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase credentials");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate metrics for yesterday (or today if forced)
    const body = await req.json().catch(() => ({}));
    const targetDate = body.date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const startOfDay = `${targetDate}T00:00:00Z`;
    const endOfDay = `${targetDate}T23:59:59Z`;

    // Fetch all metrics in parallel
    const [
      signalsResult,
      oppsResult,
      paidResult,
      outreachResult,
      fulfillmentResult,
    ] = await Promise.all([
      // Signals count
      supabase
        .from("demand_signals")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay),
      
      // Opportunities breakdown
      supabase
        .from("opportunities")
        .select("id, status, auto_approved")
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay),
      
      // Paid payments
      supabase
        .from("payments")
        .select("id, amount_usd")
        .eq("status", "confirmed")
        .gte("confirmed_at", startOfDay)
        .lte("confirmed_at", endOfDay),
      
      // Outreach sent
      supabase
        .from("outreach_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay),
      
      // Fulfillment jobs
      supabase
        .from("fulfillment_jobs")
        .select("id, status")
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay),
    ]);

    const signals_count = signalsResult.count || 0;
    const opps = oppsResult.data || [];
    const opp_count = opps.length;
    const approved_count = opps.filter((o: any) => o.auto_approved).length;
    const checkouts_created = opps.filter((o: any) => 
      ["offered", "checkout_created", "paid", "fulfilled"].includes(o.status)
    ).length;
    
    const payments = paidResult.data || [];
    const paid_count = payments.length;
    const revenue_usd = payments.reduce((sum: number, p: any) => sum + (p.amount_usd || 0), 0);
    
    const outreach_sent = outreachResult.count || 0;
    
    const fulfillments = fulfillmentResult.data || [];
    const completed_fulfillments = fulfillments.filter((f: any) => f.status === "completed").length;
    const fulfillment_success_rate = fulfillments.length > 0 
      ? completed_fulfillments / fulfillments.length 
      : null;
    
    const conversion_rate = opp_count > 0 ? paid_count / opp_count : null;

    // Upsert metrics for the day
    const { error: upsertError } = await supabase
      .from("brain_metrics_daily")
      .upsert({
        day: targetDate,
        signals_count,
        opp_count,
        approved_count,
        checkouts_created,
        paid_count,
        revenue_usd,
        fulfillment_success_rate,
        outreach_sent,
        conversion_rate,
      }, { onConflict: "day" });

    if (upsertError) throw upsertError;

    console.log(`[brain-daily-metrics] Saved metrics for ${targetDate}:`, {
      signals_count,
      opp_count,
      approved_count,
      checkouts_created,
      paid_count,
      revenue_usd,
      outreach_sent,
      conversion_rate,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        day: targetDate,
        metrics: {
          signals_count,
          opp_count,
          approved_count,
          checkouts_created,
          paid_count,
          revenue_usd,
          outreach_sent,
          fulfillment_success_rate,
          conversion_rate,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[brain-daily-metrics] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
