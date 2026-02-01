/**
 * Micro Product: Wallet Risk Ping
 * Price: $0.02 per call
 * Returns: risk_level, flags, confidence
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
  ESTIMATED_LOSS_DEFAULTS,
} from "../_shared/micro-utils.ts";

const PRODUCT_NAME = 'wallet-risk';
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
    const { wallet_address, chain_id = 1 } = body;

    if (!wallet_address || typeof wallet_address !== 'string') {
      return new Response(
        JSON.stringify({ error: 'wallet_address is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize address
    const normalizedAddress = wallet_address.toLowerCase().trim();

    // ===== RISK ANALYSIS LOGIC =====
    // In production, this would call external APIs (Chainalysis, TRM Labs, etc.)
    // For now, we use heuristics and patterns
    
    const flags: string[] = [];
    let riskScore = 0;

    // Check denylist
    const { data: denylistHit } = await supabase
      .from('denylist')
      .select('reason')
      .eq('value', normalizedAddress)
      .eq('type', 'wallet')
      .eq('active', true)
      .maybeSingle();

    if (denylistHit) {
      flags.push('blacklist_hit');
      riskScore += 50;
    }

    // Check if address has suspicious patterns (simplified heuristics)
    // Pattern: New address (short history), high-value transactions
    if (normalizedAddress.startsWith('0x000') || normalizedAddress.includes('dead')) {
      flags.push('suspicious_pattern');
      riskScore += 20;
    }

    // Simulate mixer interaction check (in production: check against known mixer addresses)
    const mixerPatterns = ['tornado', 'blender', 'mixer'];
    const addressLower = normalizedAddress.toLowerCase();
    if (mixerPatterns.some(p => addressLower.includes(p))) {
      flags.push('mixer_interaction');
      riskScore += 40;
    }

    // Determine risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    let severity: number;
    if (riskScore >= 50) {
      riskLevel = 'HIGH';
      severity = 9;
    } else if (riskScore >= 20) {
      riskLevel = 'MEDIUM';
      severity = 5;
    } else {
      riskLevel = 'LOW';
      severity = 1;
    }

    // Calculate confidence (higher with more data points)
    const confidence = Math.min(0.95, 0.6 + (flags.length * 0.1));

    // Get estimated loss
    const estimatedLossUsd = (ESTIMATED_LOSS_DEFAULTS[PRODUCT_NAME] as Record<string, number>)[riskLevel];

    // Build output
    const output = {
      risk_level: riskLevel,
      flags,
      confidence: parseFloat(confidence.toFixed(2)),
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
      { wallet_address: normalizedAddress, chain_id },
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
    console.error('Wallet risk check error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
