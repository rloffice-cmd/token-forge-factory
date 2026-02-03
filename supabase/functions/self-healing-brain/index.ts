/**
 * Self-Healing Brain v2
 * 
 * SECURITY: ADMIN_ONLY - Requires x-admin-token header
 * (Already has inline auth check - keeping compatible with admin token)
 * 
 * FULL AUTO - NO HUMAN IN LOOP
 * 
 * Pipeline:
 * 1. KPI Snapshot (money-first)
 * 2. Anomaly Detection (bug catalog)
 * 3. Patch Generation (with evidence)
 * 4. Safety Gatekeeper (kill gates)
 * 5. Patch Execution (auto-deploy)
 * 6. Verification scheduling
 * 
 * Scheduled: Daily 07:00 Israel Time
 * Also callable via Admin API
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyAdminToken, logSecurityEvent, corsHeaders } from '../_shared/auth-guards.ts';
import {
  ANOMALY_CATALOG,
  SAFETY_CONSTRAINTS,
  KPI_DEFINITIONS,
  type KPISnapshot,
  type AnomalyRule,
  isIdentitySplit,
} from "../_shared/self-heal-policy.ts";
import { isThrottleActive } from "../_shared/master-prompt-config.ts";

interface DetectedAnomaly {
  rule_id: string;
  category: string;
  severity: number;
  name: string;
  evidence?: unknown;
  confidence: number;
}

interface PatchProposal {
  anomaly_id: string;
  patch_type: 'config' | 'sql_migration' | 'edge_function' | 'client';
  patch_diff: string;
  proof_queries: string[];
  expected_impact: string;
  risk: 'low' | 'medium' | 'high';
  can_auto_deploy: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Security: Verify admin token using STRICT x-admin-token header only
  const authResult = verifyAdminToken(req);
  
  if (!authResult.authorized) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    await logSecurityEvent(supabase, 'admin_unauthorized', {
      endpoint: 'self-healing-brain',
      ip,
      identifier: `admin:self-healing-brain:${ip}`,
    });
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {

    // Create run record
    const { data: run, error: runError } = await supabase
      .from("self_heal_runs")
      .insert({ run_type: "scheduled", status: "running" })
      .select()
      .single();

    if (runError) throw runError;
    const runId = run.id;

    console.log(`🧠 Self-Healing Brain v2 started - Run ID: ${runId}`);

    // ============================================================
    // STAGE 1: KPI SNAPSHOT (Money-First)
    // ============================================================
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Paid confirmed
    const { count: paid24h } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("confirmed_at", last24h);

    const { count: paid7d } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("confirmed_at", last7d);

    // Revenue
    const { data: revenue24hData } = await supabase
      .from("payments")
      .select("amount_usd")
      .eq("status", "confirmed")
      .gte("confirmed_at", last24h);
    const revenue24h = revenue24hData?.reduce((sum, p) => sum + (Number(p.amount_usd) || 0), 0) || 0;

    const { data: revenue7dData } = await supabase
      .from("payments")
      .select("amount_usd")
      .eq("status", "confirmed")
      .gte("confirmed_at", last7d);
    const revenue7d = revenue7dData?.reduce((sum, p) => sum + (Number(p.amount_usd) || 0), 0) || 0;

    // Checkouts (checkout_url IS NOT NULL = real checkout)
    const { count: checkouts24h } = await supabase
      .from("closing_attempts")
      .select("*", { count: "exact", head: true })
      .not("checkout_url", "is", null)
      .gte("created_at", last24h);

    const { count: checkouts7d } = await supabase
      .from("closing_attempts")
      .select("*", { count: "exact", head: true })
      .not("checkout_url", "is", null)
      .gte("created_at", last7d);

    // Opportunities
    const { count: opps7d } = await supabase
      .from("opportunities")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last7d);

    // Trust to payment ratios
    const trustToPayment7d = (checkouts7d || 0) > 0 ? (paid7d || 0) / (checkouts7d || 1) : 0;

    const { count: checkouts30d } = await supabase
      .from("closing_attempts")
      .select("*", { count: "exact", head: true })
      .not("checkout_url", "is", null)
      .gte("created_at", last30d);

    const { count: paid30d } = await supabase
      .from("payments")
      .select("*", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("confirmed_at", last30d);

    const trustToPayment30d = (checkouts30d || 0) > 0 ? (paid30d || 0) / (checkouts30d || 1) : 0;

    // Throttle state
    const { data: settings } = await supabase
      .from("brain_settings")
      .select("throttle_until, throttle_activated_at, throttle_count_7d")
      .single();

    const throttleState = isThrottleActive(settings?.throttle_until) ? 'ON' : 'OFF';
    let throttleDurationHours: number | null = null;
    if (settings?.throttle_activated_at && throttleState === 'ON') {
      throttleDurationHours = (now.getTime() - new Date(settings.throttle_activated_at).getTime()) / (60 * 60 * 1000);
    }

    // Trust cap rate
    const { count: totalTraces24h } = await supabase
      .from("decision_traces")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last24h);

    const { count: cappedTraces24h } = await supabase
      .from("decision_traces")
      .select("*", { count: "exact", head: true })
      .eq("trust_cap_applied", true)
      .gte("created_at", last24h);

    const trustCapRate = (totalTraces24h || 0) > 0 ? (cappedTraces24h || 0) / (totalTraces24h || 1) : 0;

    // Decision distribution
    const { data: decisionData } = await supabase
      .from("decision_traces")
      .select("decision")
      .gte("created_at", last24h);

    const decisionDistribution = { PAID_OK: 0, FREE_ONLY: 0, BLOCK: 0 };
    for (const d of decisionData || []) {
      if (d.decision === 'PAID_OK') decisionDistribution.PAID_OK++;
      else if (d.decision === 'FREE_ONLY') decisionDistribution.FREE_ONLY++;
      else if (d.decision === 'BLOCK') decisionDistribution.BLOCK++;
    }

    // Identity split rate (fingerprints with 3+ parts = bad)
    const { data: actorProfiles } = await supabase
      .from("actor_profiles")
      .select("fingerprint")
      .limit(1000);

    let identitySplitCount = 0;
    for (const ap of actorProfiles || []) {
      if (isIdentitySplit(ap.fingerprint)) {
        identitySplitCount++;
      }
    }
    const identitySplitRate = (actorProfiles?.length || 0) > 0 
      ? identitySplitCount / (actorProfiles?.length || 1) 
      : 0;

    // Free value event link rate
    const { count: totalFVE } = await supabase
      .from("free_value_events")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last7d);

    const { count: linkedFVE } = await supabase
      .from("free_value_events")
      .select("*", { count: "exact", head: true })
      .not("actor_fingerprint", "is", null)
      .gte("created_at", last7d);

    const fveLinkRate = (totalFVE || 0) > 0 ? (linkedFVE || 0) / (totalFVE || 1) : 0;

    // Outreach throttle violation rate
    let outreachViolationRate = 0;
    if (settings?.throttle_activated_at) {
      const { count: violationCount } = await supabase
        .from("outreach_jobs")
        .select("*", { count: "exact", head: true })
        .eq("status", "sent")
        .gte("created_at", settings.throttle_activated_at);
      outreachViolationRate = violationCount || 0;
    }

    const kpiSnapshot: KPISnapshot = {
      paid_confirmed_24h: paid24h || 0,
      paid_confirmed_7d: paid7d || 0,
      revenue_confirmed_24h: revenue24h,
      revenue_confirmed_7d: revenue7d,
      checkouts_24h: checkouts24h || 0,
      checkouts_7d: checkouts7d || 0,
      trust_to_payment_ratio_7d: trustToPayment7d,
      trust_to_payment_ratio_30d: trustToPayment30d,
      throttle_state: throttleState as 'ON' | 'OFF',
      throttle_until: settings?.throttle_until || null,
      throttle_duration_hours: throttleDurationHours,
      throttle_count_7d: settings?.throttle_count_7d || 0,
      trust_cap_rate: trustCapRate,
      decision_distribution: decisionDistribution,
      actor_identity_split_rate: identitySplitRate,
      free_value_event_link_rate: fveLinkRate,
      outreach_throttle_violation_rate: outreachViolationRate,
      opportunities_7d: opps7d || 0,
    };

    console.log("📊 KPI Snapshot:", JSON.stringify(kpiSnapshot, null, 2));

    // ============================================================
    // STAGE 2: ANOMALY DETECTION
    // ============================================================
    const detectedAnomalies: DetectedAnomaly[] = [];

    for (const rule of ANOMALY_CATALOG) {
      try {
        if (rule.detect(kpiSnapshot)) {
          // Calculate confidence based on data quality
          let confidence = 0.7;
          if (rule.severity >= 9) confidence = 0.9;
          else if (rule.severity >= 7) confidence = 0.8;
          
          // Boost confidence if we have clear evidence
          if (rule.id === 'trust_cap_always' && kpiSnapshot.trust_cap_rate > 0.95) {
            confidence = 0.95;
          }
          if (rule.id === 'paid_never_happens' && kpiSnapshot.checkouts_7d > 10) {
            confidence = 0.95;
          }

          detectedAnomalies.push({
            rule_id: rule.id,
            category: rule.category,
            severity: rule.severity,
            name: rule.name,
            confidence,
          });
          console.log(`🚨 Anomaly detected: ${rule.name} (severity: ${rule.severity})`);
        }
      } catch (e) {
        console.warn(`Failed to check rule ${rule.id}:`, e);
      }
    }

    // Sort by severity DESC
    detectedAnomalies.sort((a, b) => b.severity - a.severity);
    const topAnomalies = detectedAnomalies.slice(0, 3);

    console.log(`📋 Total anomalies: ${detectedAnomalies.length}, Top 3 selected`);

    // ============================================================
    // STAGE 3: PATCH GENERATION
    // ============================================================
    const patchProposals: PatchProposal[] = [];

    for (const anomaly of topAnomalies) {
      const proposal = generatePatch(anomaly, kpiSnapshot);
      if (proposal) {
        patchProposals.push(proposal);
        
        // Store in DB
        await supabase.from("patch_proposals").insert({
          bug_id: anomaly.rule_id,
          severity: anomaly.severity,
          confidence: anomaly.confidence,
          hypothesis: anomaly.name,
          patch_type: proposal.patch_type,
          patch_diff: proposal.patch_diff,
          expected_impact: proposal.expected_impact,
          risk_level: proposal.risk,
          can_auto_deploy: proposal.can_auto_deploy,
          status: 'proposed',
        });
      }
    }

    console.log(`🔧 Patch proposals generated: ${patchProposals.length}`);

    // ============================================================
    // STAGE 4 & 5: SAFETY GATEKEEPER + AUTO-DEPLOY
    // ============================================================
    let patchesDeployed = 0;

    // Check if we already deployed today
    const { count: deployedToday } = await supabase
      .from("self_heal_patches")
      .select("*", { count: "exact", head: true })
      .gte("deployed_at", new Date(now.setHours(0, 0, 0, 0)).toISOString());

    if ((deployedToday || 0) >= SAFETY_CONSTRAINTS.max_patches_per_24h) {
      console.log("⛔ Max patches for today reached, skipping auto-deploy");
    } else {
      // Find best candidate for auto-deploy
      const autoDeployable = patchProposals.filter(p => p.can_auto_deploy && p.risk === 'low');
      
      if (autoDeployable.length > 0) {
        const patch = autoDeployable[0];
        console.log(`🚀 Auto-deploying patch: ${patch.anomaly_id}`);
        
        // Get proposal ID
        const { data: proposalRecord } = await supabase
          .from("patch_proposals")
          .select("id")
          .eq("bug_id", patch.anomaly_id)
          .eq("status", "proposed")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (proposalRecord) {
          // Mark as deployed
          await supabase
            .from("patch_proposals")
            .update({ status: "deployed" })
            .eq("id", proposalRecord.id);

          // Create deployment record
          const verifyDueAt = new Date(
            now.getTime() + SAFETY_CONSTRAINTS.verify_window_hours * 60 * 60 * 1000
          ).toISOString();

          await supabase.from("self_heal_patches").insert({
            patch_proposal_id: proposalRecord.id,
            status: "deployed",
            canary_percent: SAFETY_CONSTRAINTS.canary_percent,
            verify_window_hours: SAFETY_CONSTRAINTS.verify_window_hours,
            kpi_before: kpiSnapshot,
            verification_due_at: verifyDueAt,
          });

          patchesDeployed++;
          console.log(`✅ Patch deployed, verification due: ${verifyDueAt}`);
        }
      }
    }

    // ============================================================
    // FINALIZE RUN
    // ============================================================
    const duration = Date.now() - startTime;

    await supabase
      .from("self_heal_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        kpi_snapshot: kpiSnapshot,
        anomalies_detected: detectedAnomalies,
        patches_proposed: patchProposals.length,
        patches_deployed: patchesDeployed,
      })
      .eq("id", runId);

    // Audit log
    const { data: validJob } = await supabase
      .from("jobs")
      .select("id")
      .limit(1)
      .single();

    if (validJob) {
      await supabase.from("audit_logs").insert({
        job_id: validJob.id,
        action: "self_heal_completed",
        metadata: {
          run_id: runId,
          duration_ms: duration,
          anomalies_count: detectedAnomalies.length,
          patches_deployed: patchesDeployed,
          kpi_snapshot: kpiSnapshot,
        },
      });
    }

    console.log(`🧠 Self-Healing Brain v2 completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        ok: true,
        run_id: runId,
        duration_ms: duration,
        kpi_snapshot: kpiSnapshot,
        anomalies: detectedAnomalies,
        patches_proposed: patchProposals.length,
        patches_deployed: patchesDeployed,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Self-Healing Brain error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============================================================
// PATCH GENERATOR
// ============================================================
function generatePatch(anomaly: DetectedAnomaly, kpi: KPISnapshot): PatchProposal | null {
  switch (anomaly.rule_id) {
    case 'paid_never_happens':
      return {
        anomaly_id: 'paid_never_happens',
        patch_type: 'config',
        patch_diff: `// Lower trust thresholds to allow more paid attempts
TRUST_GATES.PAID_ALLOWED = 75; // was 80
TRUST_CAP.min_interactions_for_paid = 1; // was 2`,
        proof_queries: [
          `SELECT count(*) FROM closing_attempts WHERE checkout_url IS NOT NULL AND created_at > now() - interval '7 days'`,
          `SELECT count(*) FROM payments WHERE status = 'confirmed' AND confirmed_at > now() - interval '7 days'`,
        ],
        expected_impact: 'Increase paid_transactions by allowing more checkouts',
        risk: 'medium',
        can_auto_deploy: false, // Needs verification
      };

    case 'trust_cap_always':
      return {
        anomaly_id: 'trust_cap_always',
        patch_type: 'config',
        patch_diff: `// Reduce trust cap threshold to allow more paid flow
TRUST_CAP.no_history_max = 75; // was 70
TRUST_CAP.min_interactions_for_paid = 1; // was 2`,
        proof_queries: [
          `SELECT count(*) FILTER (WHERE trust_cap_applied) * 100.0 / count(*) FROM decision_traces WHERE created_at > now() - interval '24 hours'`,
        ],
        expected_impact: 'Reduce trust_cap_rate below 0.9',
        risk: 'low',
        can_auto_deploy: true,
      };

    case 'throttle_stuck':
      return {
        anomaly_id: 'throttle_stuck',
        patch_type: 'sql_migration',
        patch_diff: `-- Reset stuck throttle
UPDATE brain_settings SET
  throttle_until = NULL,
  throttle_reason = NULL,
  throttle_activated_at = NULL
WHERE throttle_until < now() + interval '1 hour';`,
        proof_queries: [
          `SELECT throttle_until, throttle_activated_at, now() - throttle_activated_at as duration FROM brain_settings`,
        ],
        expected_impact: 'Release throttle and resume normal operations',
        risk: 'low',
        can_auto_deploy: true,
      };

    case 'identity_split':
      return {
        anomaly_id: 'identity_split',
        patch_type: 'sql_migration',
        patch_diff: `-- Fix identity split: extract actor fingerprint from bad lead_key patterns
UPDATE actor_profiles SET
  fingerprint = split_part(fingerprint, '::', 1) || '::' || split_part(fingerprint, '::', 2)
WHERE fingerprint LIKE '%::%::%';`,
        proof_queries: [
          `SELECT count(*) FROM actor_profiles WHERE fingerprint LIKE '%::%::%'`,
        ],
        expected_impact: 'Fix actor_identity_split_rate to 0',
        risk: 'medium',
        can_auto_deploy: false,
      };

    case 'outreach_throttle_violation':
      return {
        anomaly_id: 'outreach_throttle_violation',
        patch_type: 'edge_function',
        patch_diff: `// outreach-sender MUST check throttle before sending
const { data: settings } = await supabase.from('brain_settings').select('throttle_until').single();
if (isThrottleActive(settings?.throttle_until)) {
  return { ok: false, blocked: true, reason: 'throttle_active' };
}`,
        proof_queries: [
          `SELECT count(*) FROM outreach_jobs WHERE status = 'sent' AND created_at > (SELECT throttle_activated_at FROM brain_settings)`,
        ],
        expected_impact: 'Prevent outreach during throttle',
        risk: 'low',
        can_auto_deploy: true,
      };

    default:
      return null;
  }
}
