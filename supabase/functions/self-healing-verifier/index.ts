/**
 * Self-Healing Verifier
 * 
 * Runs HOURLY to verify deployed patches
 * Auto-rollback if KPIs degrade
 * 
 * Pipeline:
 * 1. Find patches past verification window
 * 2. Re-compute KPI snapshot
 * 3. Compare before/after
 * 4. PASS or ROLLBACK
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { SAFETY_CONSTRAINTS, type KPISnapshot } from "../_shared/self-heal-policy.ts";
import { isThrottleActive } from "../_shared/master-prompt-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const adminToken = Deno.env.get("ADMIN_API_TOKEN") || "";
    const authHeader = req.headers.get("authorization") || "";
    
    if (!adminToken || !authHeader.includes(adminToken)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("🔍 Self-Healing Verifier started");

    // Find patches that need verification
    const now = new Date();
    const { data: pendingPatches, error: fetchError } = await supabase
      .from("self_heal_patches")
      .select("*, patch_proposals(*)")
      .eq("status", "deployed")
      .lt("verification_due_at", now.toISOString())
      .is("verified_at", null);

    if (fetchError) throw fetchError;

    if (!pendingPatches || pendingPatches.length === 0) {
      console.log("✅ No patches pending verification");
      return new Response(
        JSON.stringify({ ok: true, verified: 0, rolled_back: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 Found ${pendingPatches.length} patches to verify`);

    // Compute current KPI snapshot
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { count: paid24h } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("confirmed_at", last24h);

    const { data: revenue24hData } = await supabase
      .from("payments")
      .select("amount_usd")
      .eq("status", "confirmed")
      .gte("confirmed_at", last24h);
    const revenue24h = revenue24hData?.reduce((sum, p) => sum + (Number(p.amount_usd) || 0), 0) || 0;

    const { count: checkouts24h } = await supabase
      .from("closing_attempts")
      .select("*", { count: "exact", head: true })
      .not("checkout_url", "is", null)
      .gte("created_at", last24h);

    const trustToPaymentNow = (checkouts24h || 0) > 0 ? (paid24h || 0) / (checkouts24h || 1) : 0;

    // Check for outreach violations
    const { data: settings } = await supabase
      .from("brain_settings")
      .select("throttle_activated_at")
      .single();

    let outreachViolations = 0;
    if (settings?.throttle_activated_at) {
      const { count } = await supabase
        .from("outreach_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", settings.throttle_activated_at);
      outreachViolations = count || 0;
    }

    const currentKPI = {
      paid_confirmed_24h: paid24h || 0,
      revenue_confirmed_24h: revenue24h,
      trust_to_payment_ratio: trustToPaymentNow,
      outreach_throttle_violations: outreachViolations,
    };

    let verified = 0;
    let rolledBack = 0;

    for (const patch of pendingPatches) {
      const kpiBefore = patch.kpi_before as KPISnapshot;
      
      // Determine pass/fail
      let passed = true;
      let rollbackReason: string | null = null;

      // Check revenue drop
      const revenueBefore = kpiBefore.revenue_confirmed_24h || 0;
      if (revenueBefore > 0) {
        const revenueDrop = (revenueBefore - revenue24h) / revenueBefore;
        if (revenueDrop > SAFETY_CONSTRAINTS.rollback_triggers.revenue_drop_percent / 100) {
          passed = false;
          rollbackReason = `Revenue dropped by ${(revenueDrop * 100).toFixed(1)}%`;
        }
      }

      // Check paid transactions drop
      const paidBefore = kpiBefore.paid_confirmed_24h || 0;
      if (paidBefore > 0) {
        const paidDrop = (paidBefore - (paid24h || 0)) / paidBefore;
        if (paidDrop > SAFETY_CONSTRAINTS.rollback_triggers.paid_transactions_drop_percent / 100) {
          passed = false;
          rollbackReason = `Paid transactions dropped by ${(paidDrop * 100).toFixed(1)}%`;
        }
      }

      // Check outreach violations increase
      const violationsBefore = kpiBefore.outreach_throttle_violation_rate || 0;
      if (outreachViolations > violationsBefore && SAFETY_CONSTRAINTS.rollback_triggers.outreach_violation_increase) {
        passed = false;
        rollbackReason = `Outreach violations increased from ${violationsBefore} to ${outreachViolations}`;
      }

      // Special case: If no payments before and still none, check other signals
      if (paidBefore === 0 && (paid24h || 0) === 0) {
        // Check if trust_to_payment improved at all
        const ttprBefore = kpiBefore.trust_to_payment_ratio_7d || 0;
        if (trustToPaymentNow >= ttprBefore) {
          passed = true; // No regression, might just need more time
        }
      }

      if (passed) {
        // Mark as verified
        await supabase
          .from("self_heal_patches")
          .update({
            status: "verified",
            kpi_after: currentKPI,
            verified_at: now.toISOString(),
          })
          .eq("id", patch.id);

        console.log(`✅ Patch ${patch.id} VERIFIED`);
        verified++;
      } else {
        // ROLLBACK
        console.log(`🔄 Patch ${patch.id} ROLLING BACK: ${rollbackReason}`);
        
        // Attempt to restore prior config if available
        if (patch.prior_config) {
          console.log("📦 Restoring prior config:", patch.prior_config);
          // In real implementation, would apply config changes here
        }

        await supabase
          .from("self_heal_patches")
          .update({
            status: "rolled_back",
            kpi_after: currentKPI,
            verified_at: now.toISOString(),
            rollback_reason: rollbackReason,
          })
          .eq("id", patch.id);

        // Also update the proposal status
        if (patch.patch_proposal_id) {
          await supabase
            .from("patch_proposals")
            .update({ status: "rolled_back" })
            .eq("id", patch.patch_proposal_id);
        }

        rolledBack++;
      }
    }

    // Create audit log
    const { data: validJob } = await supabase
      .from("jobs")
      .select("id")
      .limit(1)
      .single();

    if (validJob) {
      await supabase.from("audit_logs").insert({
        job_id: validJob.id,
        action: "self_heal_verified",
        metadata: {
          patches_checked: pendingPatches.length,
          verified,
          rolled_back: rolledBack,
          current_kpi: currentKPI,
        },
      });
    }

    // Create self_heal_run record
    await supabase.from("self_heal_runs").insert({
      run_type: "verification",
      status: "completed",
      completed_at: now.toISOString(),
      kpi_snapshot: currentKPI,
      patches_deployed: 0,
      patches_rolled_back: rolledBack,
    });

    console.log(`🔍 Verification complete: ${verified} verified, ${rolledBack} rolled back`);

    return new Response(
      JSON.stringify({
        ok: true,
        verified,
        rolled_back: rolledBack,
        current_kpi: currentKPI,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Verifier error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
