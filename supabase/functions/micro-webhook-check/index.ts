/**
 * Micro Product: Webhook Health Check
 * Price: $0.25 per call
 * Returns: reachable, response_time_ms, status_code
 * NO retries, NO replay - just diagnosis
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

const PRODUCT_NAME = 'webhook-check';
const PRODUCT_PRICE = MICRO_PRICING[PRODUCT_NAME];
const TIMEOUT_MS = 10000; // 10 second timeout

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
    const { webhook_url, expected_status = 200 } = body;

    if (!webhook_url || typeof webhook_url !== 'string') {
      return new Response(
        JSON.stringify({ error: 'webhook_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(webhook_url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid webhook_url format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== WEBHOOK HEALTH CHECK LOGIC =====
    let reachable = false;
    let statusCode = 0;
    let responseTimeMs = 0;
    let errorMessage: string | undefined;

    const checkStart = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MicroStack-HealthCheck/1.0',
          'X-Health-Check': 'true',
        },
        body: JSON.stringify({ 
          health_check: true, 
          timestamp: new Date().toISOString(),
          source: 'micro-webhook-check'
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      
      responseTimeMs = Date.now() - checkStart;
      statusCode = response.status;
      reachable = true;

    } catch (err: unknown) {
      responseTimeMs = Date.now() - checkStart;
      const error = err as Error;
      
      if (error.name === 'AbortError') {
        errorMessage = 'Timeout exceeded';
        statusCode = 0;
      } else {
        errorMessage = error.message || 'Connection failed';
        statusCode = 0;
      }
    }

    // Calculate severity and estimated loss
    let severity: number;
    let estimatedLossUsd: number;
    const lossDefaults = ESTIMATED_LOSS_DEFAULTS[PRODUCT_NAME] as Record<string, number>;

    if (!reachable) {
      severity = 9;
      estimatedLossUsd = lossDefaults.unreachable;
    } else if (statusCode !== expected_status) {
      severity = 7;
      estimatedLossUsd = lossDefaults.unreachable / 2;
    } else if (responseTimeMs > 800) {
      severity = 4;
      estimatedLossUsd = lossDefaults.slow;
    } else {
      severity = 1;
      estimatedLossUsd = 0;
    }

    // Build output
    const output: Record<string, unknown> = {
      reachable,
      response_time_ms: responseTimeMs,
      status_code: statusCode,
    };

    if (errorMessage) {
      output.error_message = errorMessage;
    }

    if (reachable && statusCode !== expected_status) {
      output.status_mismatch = true;
      output.expected_status = expected_status;
    }

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
      { webhook_url: parsedUrl.origin + parsedUrl.pathname, expected_status },
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
    console.error('Webhook check error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
