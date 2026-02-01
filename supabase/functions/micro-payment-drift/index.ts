/**
 * Micro Product: Payment Drift Detector
 * Price: $2.00 per call
 * Returns: drift_usd, status, confidence
 * Snapshot only - no correction, no recovery
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  createAdminClient,
  validateApiKey,
  checkRateLimit,
  chargeMicroUsage,
  recordMicroEvent,
  updatePainScores,
  triggerAutoOfferEvaluation,
  MICRO_PRICING,
} from "../_shared/micro-utils.ts";

const PRODUCT_NAME = 'payment-drift';
const PRODUCT_PRICE = MICRO_PRICING[PRODUCT_NAME];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createAdminClient();

    // Validate API key
    const apiKeyHeader = req.headers.get('x-api-key') || req.headers.get('authorization');
    const authResult = await validateApiKey(supabase, apiKeyHeader);
    
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerId = authResult.customerId!;

    // Check rate limit
    const rateCheck = await checkRateLimit(supabase, customerId, PRODUCT_PRICE);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: rateCheck.error, remaining_usd: rateCheck.remainingUsd }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse input
    const body = await req.json();
    const { 
      expected_amount_usd, 
      received_amount_usd, 
      time_window_hours = 24,
      reference_id,
      currency = 'USD'
    } = body;

    // Validate required fields
    if (expected_amount_usd === undefined || typeof expected_amount_usd !== 'number') {
      return new Response(
        JSON.stringify({ error: 'expected_amount_usd is required and must be a number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (received_amount_usd === undefined || typeof received_amount_usd !== 'number') {
      return new Response(
        JSON.stringify({ error: 'received_amount_usd is required and must be a number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (expected_amount_usd < 0 || received_amount_usd < 0) {
      return new Response(
        JSON.stringify({ error: 'Amounts must be non-negative' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PAYMENT DRIFT ANALYSIS =====
    const driftUsd = Math.abs(expected_amount_usd - received_amount_usd);
    const driftPercent = expected_amount_usd > 0 
      ? (driftUsd / expected_amount_usd) * 100 
      : (received_amount_usd > 0 ? 100 : 0);

    // Determine status
    let status: 'MATCH' | 'MISMATCH';
    let severity: number;
    let confidence: number;

    // Consider a match if drift is within 1% or $1 (for small amounts)
    const matchThreshold = Math.max(expected_amount_usd * 0.01, 1);
    
    if (driftUsd <= matchThreshold) {
      status = 'MATCH';
      severity = 1;
      confidence = 0.95;
    } else {
      status = 'MISMATCH';
      
      // Severity based on drift percentage
      if (driftPercent >= 50) {
        severity = 10;
        confidence = 0.95;
      } else if (driftPercent >= 20) {
        severity = 8;
        confidence = 0.90;
      } else if (driftPercent >= 10) {
        severity = 6;
        confidence = 0.85;
      } else if (driftPercent >= 5) {
        severity = 4;
        confidence = 0.80;
      } else {
        severity = 2;
        confidence = 0.75;
      }
    }

    // Estimated loss is the actual drift for this product
    const estimatedLossUsd = status === 'MISMATCH' ? driftUsd : 0;

    // Determine drift direction
    let driftDirection: 'none' | 'underpaid' | 'overpaid' = 'none';
    if (driftUsd > matchThreshold) {
      driftDirection = received_amount_usd < expected_amount_usd ? 'underpaid' : 'overpaid';
    }

    // Build output
    const output = {
      drift_usd: parseFloat(driftUsd.toFixed(2)),
      drift_percent: parseFloat(driftPercent.toFixed(2)),
      drift_direction: driftDirection,
      status,
      confidence: parseFloat(confidence.toFixed(2)),
      expected_amount_usd,
      received_amount_usd,
      time_window_hours,
      response_time_ms: Date.now() - startTime,
    };

    // Charge usage
    const chargeResult = await chargeMicroUsage(supabase, customerId, PRODUCT_NAME, PRODUCT_PRICE);
    if (!chargeResult.success) {
      return new Response(
        JSON.stringify({ error: chargeResult.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record event
    const eventResult = await recordMicroEvent(
      supabase,
      customerId,
      PRODUCT_NAME,
      severity,
      estimatedLossUsd,
      PRODUCT_PRICE,
      { expected_amount_usd, received_amount_usd, time_window_hours, reference_id, currency },
      output
    );

    // Update pain scores
    await updatePainScores(supabase, customerId, PRODUCT_NAME, severity, estimatedLossUsd, output);

    // Trigger auto-offer evaluation (async, non-blocking)
    if (eventResult.eventId) {
      triggerAutoOfferEvaluation(customerId, PRODUCT_NAME, eventResult.eventId);
    }

    // Update API key last_used
    if (authResult.keyId) {
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', authResult.keyId);
    }

    return new Response(
      JSON.stringify(output),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Payment drift check error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
