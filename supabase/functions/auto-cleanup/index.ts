/**
 * Auto-Cleanup — Archive stale leads and signals
 * 
 * Runs daily: Archives leads inactive for 30+ days
 * Keeps DB lean by moving old data to 'archived' status
 * 
 * SECURITY: INTERNAL_CRON - Requires x-cron-secret header
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyCronSecret, unauthorizedResponse, logSecurityEvent, corsHeaders } from "../_shared/auth-guards.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const authResult = verifyCronSecret(req);
  if (!authResult.authorized) {
    await logSecurityEvent(supabase, "cron_unauthorized", {
      endpoint: "auto-cleanup",
      error: authResult.error,
    });
    return unauthorizedResponse(authResult.error!, "auto-cleanup");
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Archive old leads
    const { count: leadsArchived } = await supabase
      .from("leads")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .in("status", ["new", "contacted"])
      .lt("updated_at", thirtyDaysAgo)
      .select("id", { count: "exact", head: true });

    // Archive old demand_signals
    const { count: signalsArchived } = await supabase
      .from("demand_signals")
      .update({ status: "archived" })
      .in("status", ["new", "scored"])
      .lt("created_at", thirtyDaysAgo)
      .select("id", { count: "exact", head: true });

    // Archive old outreach_jobs that are gated/deferred
    const { count: jobsArchived } = await supabase
      .from("outreach_jobs")
      .update({ status: "archived" })
      .in("status", ["gated", "deferred", "failed"])
      .lt("created_at", thirtyDaysAgo)
      .select("id", { count: "exact", head: true });

    const result = {
      leads_archived: leadsArchived || 0,
      signals_archived: signalsArchived || 0,
      jobs_archived: jobsArchived || 0,
      cutoff_date: thirtyDaysAgo,
    };

    // Audit log
    await supabase.from("audit_logs").insert({
      job_id: "00000000-0000-0000-0000-000000000000",
      action: "auto-cleanup:completed",
      metadata: result,
    });

    console.log(`🧹 Cleanup: ${result.leads_archived} leads, ${result.signals_archived} signals, ${result.jobs_archived} jobs archived`);

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-cleanup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
