/**
 * Micro Product: Webhook Health Check
 * Price: $0.25 per call
 * Returns: reachable, response_time_ms, status_code
 * 
 * SECURITY: SSRF Protection - blocks private IPs, localhost, link-local addresses
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

const PRODUCT_NAME = 'webhook-check';
const PRODUCT_PRICE = MICRO_PRICING[PRODUCT_NAME];
const TIMEOUT_MS = 5000; // 5 second timeout

// Estimated loss defaults for this product
const LOSS_DEFAULTS = {
  unreachable: 300,
  slow: 150,
};

// SSRF Protection: Block private/internal addresses
function isBlockedUrl(urlString: string): { blocked: boolean; reason?: string } {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    
    // Block localhost variants
    if (hostname === 'localhost' || 
        hostname === '127.0.0.1' || 
        hostname === '0.0.0.0' ||
        hostname === '::1' ||
        hostname.endsWith('.localhost')) {
      return { blocked: true, reason: 'localhost_blocked' };
    }
    
    // Block .local TLD
    if (hostname.endsWith('.local')) {
      return { blocked: true, reason: 'local_tld_blocked' };
    }
    
    // Block internal hostnames
    if (hostname === 'metadata' || 
        hostname === 'metadata.google.internal' ||
        hostname.includes('internal')) {
      return { blocked: true, reason: 'internal_hostname_blocked' };
    }
    
    // Check for IP addresses
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    
    if (match) {
      const [, a, b, c] = match.map(Number);
      
      // Block RFC1918 private ranges
      // 10.0.0.0/8
      if (a === 10) {
        return { blocked: true, reason: 'private_ip_10' };
      }
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) {
        return { blocked: true, reason: 'private_ip_172' };
      }
      // 192.168.0.0/16
      if (a === 192 && b === 168) {
        return { blocked: true, reason: 'private_ip_192' };
      }
      // 127.0.0.0/8 loopback
      if (a === 127) {
        return { blocked: true, reason: 'loopback_ip' };
      }
      // 169.254.0.0/16 link-local (AWS metadata, etc.)
      if (a === 169 && b === 254) {
        return { blocked: true, reason: 'link_local_ip' };
      }
      // 0.0.0.0/8
      if (a === 0) {
        return { blocked: true, reason: 'zero_network' };
      }
    }
    
    // Block non-http(s) protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { blocked: true, reason: 'invalid_protocol' };
    }
    
    return { blocked: false };
  } catch {
    return { blocked: true, reason: 'invalid_url' };
  }
}

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

    // SSRF Protection: Check if URL is blocked
    const ssrfCheck = isBlockedUrl(webhook_url);
    if (ssrfCheck.blocked) {
      return new Response(
        JSON.stringify({ 
          error: 'URL not allowed for security reasons',
          reason: ssrfCheck.reason,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        redirect: 'manual', // Don't follow redirects - SSRF protection
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

    if (!reachable) {
      severity = 9;
      estimatedLossUsd = LOSS_DEFAULTS.unreachable;
    } else if (statusCode !== expected_status) {
      severity = 7;
      estimatedLossUsd = LOSS_DEFAULTS.unreachable / 2;
    } else if (responseTimeMs > 800) {
      severity = 4;
      estimatedLossUsd = LOSS_DEFAULTS.slow;
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

    // Record event - sanitize URL (don't store query params which may contain secrets)
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
