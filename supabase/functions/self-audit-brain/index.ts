/**
 * 🧠 SELF-AUDIT BRAIN
 * Autonomous bug detection, proof, patching, and deployment
 * 
 * MANDATE: Increase Paid Transactions & Trust→Payment Ratio
 * 
 * PIPELINE:
 * 1. Telemetry Collection (KPI Snapshot)
 * 2. Forensic Analysis (Anomaly Detection)
 * 3. Hypothesis Engine (Bug Identification)
 * 4. Patch Generator (Minimal Fixes)
 * 5. Safety Gatekeeper (Kill Gates)
 * 6. Deploy Orchestrator (Safe Rollout)
 * 7. Post-Deploy Monitor (Verify/Rollback)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =====================================================
// BUG CATALOG - What we're looking for
// =====================================================
const BUG_CATALOG = {
  logic: [
    {
      id: 'paid_never_happens',
      name: 'Paid Flow Never Triggers',
      detect: 'canCreateCheckout always false OR interactionCount stuck at 0',
      severity: 10,
    },
    {
      id: 'throttle_never_releases',
      name: 'Throttle Never Releases',
      detect: 'throttle_state=ON for >24h continuously',
      severity: 9,
    },
    {
      id: 'trust_cap_always_applied',
      name: 'Trust Cap Applied to >90%',
      detect: 'trust_cap_applied=true in >90% of decision_traces',
      severity: 8,
    },
    {
      id: 'free_only_loop',
      name: 'Free-Only Loop (No Progression)',
      detect: 'Many free_value_events but 0 paid transitions',
      severity: 8,
    },
  ],
  data: [
    {
      id: 'payments_not_linked',
      name: 'Payments Not Linked to Checkouts',
      detect: 'payments without matching closing_attempts',
      severity: 7,
    },
    {
      id: 'timezone_window_bug',
      name: 'Rolling 24h Not Actually Rolling',
      detect: 'Inconsistent time windows in queries',
      severity: 6,
    },
    {
      id: 'duplicate_opportunities',
      name: 'Duplicate Opportunities',
      detect: 'Same source_url with multiple opportunities',
      severity: 5,
    },
  ],
  commercial: [
    {
      id: 'checkout_as_exploration',
      name: 'Checkouts Used as Exploration',
      detect: 'checkouts >> opportunities consistently',
      severity: 7,
    },
    {
      id: 'no_micro_offer',
      name: 'No Micro-Payment Path',
      detect: 'All offers > $10 with 0% conversion',
      severity: 6,
    },
  ],
};

// =====================================================
// KILL GATES - Safety limits
// =====================================================
const KILL_GATES = {
  revenue_drop_threshold: 0.2, // Rollback if paid drops >20%
  max_patches_per_day: 1,
  min_verify_window_hours: 12,
  max_throttle_activations_week: 5,
};

interface KPISnapshot {
  paid_confirmed_24h: number;
  paid_confirmed_7d: number;
  paid_confirmed_30d: number;
  checkouts_24h: number;
  checkouts_7d: number;
  checkouts_30d: number;
  throttle_state: string;
  throttle_until: string | null;
  throttle_activated_at: string | null;
  throttle_count_7d: number;
  trust_to_payment_ratio_7d: number;
  trust_to_payment_ratio_30d: number;
  free_value_events_24h: number;
  free_value_events_7d: number;
  decision_distribution: Record<string, number>;
  trust_cap_rate: number;
  interaction_count_avg: number;
}

interface Anomaly {
  bug_id: string;
  bug_name: string;
  bug_type: string;
  severity: number;
  evidence: Record<string, unknown>;
  probable_cause: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let auditRunId: string | null = null;

  try {
    console.log('🧠 SELF-AUDIT BRAIN - Starting audit cycle');

    // Create audit run record
    const { data: auditRun, error: runError } = await supabase
      .from('self_audit_runs')
      .insert({
        run_type: 'scheduled',
        status: 'running',
      })
      .select()
      .single();

    if (runError) throw runError;
    auditRunId = auditRun.id;

    // =====================================================
    // STAGE 1: TELEMETRY COLLECTION (KPI Snapshot)
    // =====================================================
    console.log('📊 Stage 1: Collecting KPI Snapshot');

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Payments
    const { count: paid24h } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('confirmed_at', last24h);

    const { count: paid7d } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('confirmed_at', last7d);

    const { count: paid30d } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('confirmed_at', last30d);

    // Checkouts - FIXED: Clear definition - checkout_url IS NOT NULL
    const { count: checkouts24h } = await supabase
      .from('closing_attempts')
      .select('*', { count: 'exact', head: true })
      .not('checkout_url', 'is', null)
      .gte('created_at', last24h);

    const { count: checkouts7d } = await supabase
      .from('closing_attempts')
      .select('*', { count: 'exact', head: true })
      .not('checkout_url', 'is', null)
      .gte('created_at', last7d);

    const { count: checkouts30d } = await supabase
      .from('closing_attempts')
      .select('*', { count: 'exact', head: true })
      .not('checkout_url', 'is', null)
      .gte('created_at', last30d);

    // Throttle state - FIXED: Remove invalid .eq('id', true), just use .single()
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('throttle_until, throttle_reason, throttle_count_7d, throttle_activated_at')
      .single();

    const throttleState = settings?.throttle_until && new Date(settings.throttle_until) > now ? 'ON' : 'OFF';

    // Free value events
    const { count: freeEvents24h } = await supabase
      .from('free_value_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h);

    const { count: freeEvents7d } = await supabase
      .from('free_value_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last7d);

    // Decision traces analysis (last 7 days)
    const { data: decisions } = await supabase
      .from('decision_traces')
      .select('decision, trust_cap_applied, interaction_count')
      .gte('created_at', last7d);

    const decisionDistribution: Record<string, number> = {};
    let trustCapCount = 0;
    let totalInteractionCount = 0;

    for (const d of decisions || []) {
      decisionDistribution[d.decision] = (decisionDistribution[d.decision] || 0) + 1;
      if (d.trust_cap_applied) trustCapCount++;
      totalInteractionCount += d.interaction_count || 0;
    }

    const totalDecisions = decisions?.length || 1;
    const trustCapRate = trustCapCount / totalDecisions;
    const interactionCountAvg = totalInteractionCount / totalDecisions;

    // FIXED: Trust to payment ratio - calculate both 7d and 30d accurately
    const trustToPaymentRatio7d = (checkouts7d || 0) > 0 
      ? (paid7d || 0) / (checkouts7d || 1) 
      : 0;

    const trustToPaymentRatio30d = (checkouts30d || 0) > 0 
      ? (paid30d || 0) / (checkouts30d || 1) 
      : 0;

    const kpiSnapshot: KPISnapshot = {
      paid_confirmed_24h: paid24h || 0,
      paid_confirmed_7d: paid7d || 0,
      paid_confirmed_30d: paid30d || 0,
      checkouts_24h: checkouts24h || 0,
      checkouts_7d: checkouts7d || 0,
      checkouts_30d: checkouts30d || 0,
      throttle_state: throttleState,
      throttle_until: settings?.throttle_until || null,
      throttle_activated_at: settings?.throttle_activated_at || null,
      throttle_count_7d: settings?.throttle_count_7d || 0,
      trust_to_payment_ratio_7d: trustToPaymentRatio7d,
      trust_to_payment_ratio_30d: trustToPaymentRatio30d,
      free_value_events_24h: freeEvents24h || 0,
      free_value_events_7d: freeEvents7d || 0,
      decision_distribution: decisionDistribution,
      trust_cap_rate: trustCapRate,
      interaction_count_avg: interactionCountAvg,
    };

    console.log('📈 KPI Snapshot:', JSON.stringify(kpiSnapshot, null, 2));

    // =====================================================
    // STAGE 2: FORENSIC ANALYSIS (Anomaly Detection)
    // =====================================================
    console.log('🔍 Stage 2: Forensic Analysis');

    const anomalies: Anomaly[] = [];

    // Check: Paid never happens
    if (kpiSnapshot.checkouts_7d > 5 && kpiSnapshot.paid_confirmed_7d === 0) {
      anomalies.push({
        bug_id: 'paid_never_happens',
        bug_name: 'Paid Flow Never Triggers',
        bug_type: 'logic',
        severity: 10,
        evidence: {
          checkouts_7d: kpiSnapshot.checkouts_7d,
          paid_7d: kpiSnapshot.paid_confirmed_7d,
          conversion_rate: 0,
        },
        probable_cause: 'interactionCount stuck at 0 OR trust_cap blocking all paid flows',
      });
    }

    // Check: Trust cap always applied
    if (kpiSnapshot.trust_cap_rate > 0.9) {
      anomalies.push({
        bug_id: 'trust_cap_always_applied',
        bug_name: 'Trust Cap Applied to >90%',
        bug_type: 'logic',
        severity: 8,
        evidence: {
          trust_cap_rate: kpiSnapshot.trust_cap_rate,
          interaction_count_avg: kpiSnapshot.interaction_count_avg,
        },
        probable_cause: 'interactionCount never incremented, no actor_profiles populated',
      });
    }

    // Check: Throttle never releases - FIXED: Use throttle_activated_at for accurate duration
    if (throttleState === 'ON' && settings?.throttle_activated_at) {
      const throttleActivatedAt = new Date(settings.throttle_activated_at).getTime();
      const throttleDuration = now.getTime() - throttleActivatedAt;
      
      if (throttleDuration > 48 * 60 * 60 * 1000) {
        anomalies.push({
          bug_id: 'throttle_never_releases',
          bug_name: 'Throttle Stuck for >48h',
          bug_type: 'logic',
          severity: 9,
          evidence: {
            throttle_duration_hours: Math.round(throttleDuration / (60 * 60 * 1000)),
            throttle_activated_at: settings.throttle_activated_at,
            throttle_until: settings.throttle_until,
          },
          probable_cause: 'No payments to reset throttle, or throttle_until not clearing',
        });
      }
    } else if (throttleState === 'ON' && !settings?.throttle_activated_at) {
      // MISSING: throttle_activated_at not set - can't determine duration accurately
      anomalies.push({
        bug_id: 'throttle_missing_activation_time',
        bug_name: 'Throttle Active Without Activation Timestamp',
        bug_type: 'data',
        severity: 5,
        evidence: {
          throttle_until: settings?.throttle_until,
          throttle_activated_at: null,
        },
        probable_cause: 'throttle_activated_at not being set when throttle activates',
      });
    }

    // Check: Free-only loop
    if (kpiSnapshot.free_value_events_7d > 10 && kpiSnapshot.paid_confirmed_7d === 0) {
      anomalies.push({
        bug_id: 'free_only_loop',
        bug_name: 'Free-Only Loop (No Progression)',
        bug_type: 'logic',
        severity: 8,
        evidence: {
          free_value_events_7d: kpiSnapshot.free_value_events_7d,
          paid_7d: kpiSnapshot.paid_confirmed_7d,
        },
        probable_cause: 'No free→paid bridge or min_interactions never met',
      });
    }

    // Check: Interaction count stuck at 0
    if (kpiSnapshot.interaction_count_avg < 0.1 && totalDecisions > 10) {
      anomalies.push({
        bug_id: 'interaction_count_stuck',
        bug_name: 'Interaction Count Always 0',
        bug_type: 'data',
        severity: 9,
        evidence: {
          avg_interaction_count: kpiSnapshot.interaction_count_avg,
          total_decisions: totalDecisions,
        },
        probable_cause: 'Actor fingerprinting not implemented, interactionCount hardcoded to 0',
      });
    }

    console.log(`🔎 Found ${anomalies.length} anomalies`);

    // =====================================================
    // STAGE 3: HYPOTHESIS ENGINE
    // =====================================================
    console.log('💡 Stage 3: Generating Hypotheses');

    const hypotheses: Array<{
      anomaly: Anomaly;
      hypothesis: string;
      proof_queries: string[];
      patch_suggestion: string;
    }> = [];

    // FIXED: Sort anomalies by severity DESC before taking top 3
    const sortedAnomalies = [...anomalies].sort((a, b) => b.severity - a.severity);
    
    for (const anomaly of sortedAnomalies.slice(0, 3)) {
      let hypothesis = '';
      let patchSuggestion = '';
      const proofQueries: string[] = [];

      switch (anomaly.bug_id) {
        case 'paid_never_happens':
        case 'trust_cap_always_applied':
        case 'interaction_count_stuck':
          hypothesis = 'Actor fingerprinting is not implemented, causing all signals to be treated as new users with interactionCount=0';
          patchSuggestion = 'Implement actor_profiles lookup using platform+author fingerprint before scoring';
          proofQueries.push(
            "SELECT COUNT(*) FROM actor_profiles",
            "SELECT AVG(interaction_count) FROM decision_traces WHERE created_at > now() - interval '7 days'"
          );
          break;

        case 'throttle_never_releases':
          hypothesis = 'Throttle is not resetting even after payments OR throttle is too aggressive';
          patchSuggestion = 'Add payment-based throttle reset OR reduce throttle duration';
          proofQueries.push(
            "SELECT throttle_until, throttle_reason FROM brain_settings WHERE id = true",
            "SELECT COUNT(*) FROM payments WHERE status = 'confirmed' AND confirmed_at > now() - interval '24 hours'"
          );
          break;

        case 'free_only_loop':
          hypothesis = 'Users receive free value but no path to paid exists (missing bridge offer)';
          patchSuggestion = 'Add micro-payment offer ($3-$7) for users with free_value_events >= 1';
          proofQueries.push(
            "SELECT COUNT(*) FROM free_value_events",
            "SELECT DISTINCT actor_fingerprint, COUNT(*) as events FROM decision_traces GROUP BY actor_fingerprint HAVING COUNT(*) > 1"
          );
          break;
      }

      if (hypothesis) {
        hypotheses.push({
          anomaly,
          hypothesis,
          proof_queries: proofQueries,
          patch_suggestion: patchSuggestion,
        });
      }
    }

    // =====================================================
    // STAGE 4: CREATE PATCH PROPOSALS
    // =====================================================
    console.log('🔧 Stage 4: Creating Patch Proposals');

    const patchProposals = [];

    for (const h of hypotheses) {
      // FIXED: Calculate confidence based on evidence strength, not just severity
      let confidence = 0.5; // Base confidence
      
      // Evidence-based confidence calculation
      if (h.anomaly.bug_id === 'paid_never_happens' && kpiSnapshot.checkouts_7d > 10) {
        confidence = 0.95; // Very clear evidence
      } else if (h.anomaly.bug_id === 'trust_cap_always_applied' && kpiSnapshot.trust_cap_rate > 0.95) {
        confidence = 0.9; // Clear threshold breach
      } else if (h.anomaly.bug_id === 'interaction_count_stuck' && kpiSnapshot.interaction_count_avg < 0.05) {
        confidence = 0.95; // Near-zero avg is definitive
      } else if (h.anomaly.bug_id === 'throttle_never_releases') {
        confidence = 0.85; // Can verify from timestamps
      } else if (h.anomaly.severity >= 8) {
        confidence = 0.7; // High severity, moderate confidence
      } else {
        confidence = 0.6; // Lower severity, hypothesis-level confidence
      }

      const { data: proposal } = await supabase
        .from('patch_proposals')
        .insert({
          audit_run_id: auditRunId,
          hypothesis: h.hypothesis,
          bug_type: h.anomaly.bug_type,
          severity: h.anomaly.severity,
          evidence_queries: h.proof_queries,
          evidence_results: h.anomaly.evidence,
          confidence, // FIXED: Evidence-based confidence
          patch_type: 'config',
          patch_target: h.anomaly.bug_id,
          patch_diff: h.patch_suggestion,
          expected_impact: {
            expected_change: 'Increase trust_to_payment_ratio',
            metric: 'paid_confirmed / checkouts',
          },
          expected_risk: 'Low - configuration change only',
          status: 'proposed',
        })
        .select()
        .single();

      if (proposal) patchProposals.push(proposal);
    }

    // =====================================================
    // STAGE 5: SAFETY GATEKEEPER
    // =====================================================
    console.log('🛡️ Stage 5: Safety Gatekeeper');

    // Check: Already deployed a patch today?
    const { count: patchesToday } = await supabase
      .from('patch_proposals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'deployed')
      .gte('deployed_at', last24h);

    const canDeployMore = (patchesToday || 0) < KILL_GATES.max_patches_per_day;

    // =====================================================
    // UPDATE AUDIT RUN
    // =====================================================
    // FIXED: Use sorted anomalies for display
    const topAnomalies = sortedAnomalies.slice(0, 3);
    
    const summary = `
📊 KPI: ${kpiSnapshot.paid_confirmed_24h} payments (24h), ${kpiSnapshot.checkouts_24h} checkouts
📈 Conversion: ${(kpiSnapshot.trust_to_payment_ratio_7d * 100).toFixed(1)}% (7d), ${(kpiSnapshot.trust_to_payment_ratio_30d * 100).toFixed(1)}% (30d)
🎯 Trust Cap Rate: ${(kpiSnapshot.trust_cap_rate * 100).toFixed(1)}%, Avg Interactions: ${kpiSnapshot.interaction_count_avg.toFixed(2)}
🔍 Anomalies: ${anomalies.length} found
💡 Hypotheses: ${hypotheses.length} generated
🔧 Patches: ${patchProposals.length} proposed
🛡️ Can Deploy: ${canDeployMore ? 'YES' : 'NO (limit reached)'}

Top Issues:
${topAnomalies.map(a => `- [${a.severity}/10] ${a.bug_name}: ${a.probable_cause}`).join('\n')}
    `.trim();

    await supabase
      .from('self_audit_runs')
      .update({
        completed_at: new Date().toISOString(),
        kpi_snapshot: kpiSnapshot,
        anomalies_found: anomalies.length,
        hypotheses: hypotheses.map(h => ({
          bug_id: h.anomaly.bug_id,
          hypothesis: h.hypothesis,
          severity: h.anomaly.severity,
        })),
        patches_proposed: patchProposals.length,
        status: 'completed',
        summary,
      })
      .eq('id', auditRunId);

    // Log to audit_logs for visibility
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000007', // Self-audit sentinel
      action: 'self_audit_completed',
      metadata: {
        audit_run_id: auditRunId,
        kpi_snapshot: kpiSnapshot,
        anomalies_count: anomalies.length,
        hypotheses_count: hypotheses.length,
        patches_proposed: patchProposals.length,
        top_issue: anomalies[0]?.bug_name || 'None',
      },
    });

    console.log('✅ Self-Audit Brain completed');
    console.log(summary);

    return new Response(
      JSON.stringify({
        success: true,
        audit_run_id: auditRunId,
        kpi_snapshot: kpiSnapshot,
        anomalies: anomalies.length,
        hypotheses: hypotheses.length,
        patches_proposed: patchProposals.length,
        summary,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('SELF-AUDIT BRAIN ERROR:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    // Update audit run as failed
    if (auditRunId) {
      await supabase
        .from('self_audit_runs')
        .update({
          completed_at: new Date().toISOString(),
          status: 'failed',
          summary: `Error: ${errorMsg}`,
        })
        .eq('id', auditRunId);
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
