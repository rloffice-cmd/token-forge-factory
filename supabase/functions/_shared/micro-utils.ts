/**
 * Shared utilities for Micro Product Stack
 * Note: Using 'any' types for new tables until types are regenerated
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Micro product pricing (fallback - DB is source of truth)
export const MICRO_PRICING: Record<string, number> = {
  'wallet-risk': 0.02,
  'webhook-check': 0.25,
  'payment-drift': 2.00,
};

// Daily cap per customer
export const DAILY_CAP_USD = 20;

// Estimated loss defaults for pain scoring
export const ESTIMATED_LOSS_DEFAULTS: Record<string, Record<string, number> | string> = {
  'wallet-risk': { LOW: 0, MEDIUM: 200, HIGH: 1000 },
  'webhook-check': { unreachable: 300, slow: 150 },
  'payment-drift': 'drift_value', // Use actual drift
};

// Create admin Supabase client
export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

// Validate API key and get customer
export async function validateApiKey(
  supabase: SupabaseClient,
  apiKeyHeader: string | null
): Promise<{ valid: boolean; customerId?: string; keyId?: string; error?: string }> {
  if (!apiKeyHeader) {
    return { valid: false, error: 'Missing X-API-Key header' };
  }

  const apiKey = apiKeyHeader.replace('Bearer ', '').trim();
  
  // Hash the key to compare
  const encoder = new TextEncoder();
  const pepper = Deno.env.get('API_KEY_PEPPER') || 'default-pepper';
  const data = encoder.encode(apiKey + pepper);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const { data: keyData, error } = await supabase
    .from('api_keys')
    .select('id, customer_id, status')
    .eq('key_hash', keyHash)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !keyData) {
    return { valid: false, error: 'Invalid or inactive API key' };
  }

  return { valid: true, customerId: (keyData as any).customer_id, keyId: (keyData as any).id };
}

// Check rate limit (daily cap)
export async function checkRateLimit(
  supabase: SupabaseClient,
  customerId: string,
  productPrice: number
): Promise<{ allowed: boolean; remainingUsd: number; error?: string }> {
  const today = new Date().toISOString().split('T')[0];

  // Upsert rate limit record
  const { data: limitData, error: fetchError } = await supabase
    .from('micro_rate_limits')
    .select('*')
    .eq('customer_id', customerId)
    .eq('limit_date', today)
    .maybeSingle();

  if (fetchError) {
    console.error('Rate limit check error:', fetchError);
    return { allowed: false, remainingUsd: 0, error: 'Rate limit check failed' };
  }

  const limit = limitData as any;
  const currentSpent = limit?.spent_usd || 0;
  const cap = limit?.cap_usd || DAILY_CAP_USD;
  const remainingUsd = cap - currentSpent;

  if (currentSpent + productPrice > cap) {
    // Block and update
    if (limit) {
      await supabase
        .from('micro_rate_limits')
        .update({ blocked_at: new Date().toISOString(), hits_count: (limit.hits_count || 0) + 1 })
        .eq('id', limit.id);
    }
    return { allowed: false, remainingUsd, error: 'הגעת לתקרת שימוש יומית ($20). נסה מחר או שדרג ל-Guardian.' };
  }

  return { allowed: true, remainingUsd: remainingUsd - productPrice };
}

// Charge for micro product usage
export async function chargeMicroUsage(
  supabase: SupabaseClient,
  customerId: string,
  product: string,
  priceUsd: number
): Promise<{ success: boolean; error?: string }> {
  const today = new Date().toISOString().split('T')[0];

  // Upsert rate limit with new spending
  const { data: existingData } = await supabase
    .from('micro_rate_limits')
    .select('*')
    .eq('customer_id', customerId)
    .eq('limit_date', today)
    .maybeSingle();

  const existing = existingData as any;

  if (existing) {
    const { error } = await supabase
      .from('micro_rate_limits')
      .update({ 
        spent_usd: existing.spent_usd + priceUsd,
        hits_count: existing.hits_count + 1
      })
      .eq('id', existing.id);
    
    if (error) return { success: false, error: 'Failed to update spending' };
  } else {
    const { error } = await supabase
      .from('micro_rate_limits')
      .insert({
        customer_id: customerId,
        limit_date: today,
        spent_usd: priceUsd,
        hits_count: 1,
        cap_usd: DAILY_CAP_USD
      } as any);
    
    if (error) return { success: false, error: 'Failed to record spending' };
  }

  return { success: true };
}

// Record micro event
export async function recordMicroEvent(
  supabase: SupabaseClient,
  customerId: string,
  product: string,
  severity: number,
  estimatedLossUsd: number,
  costUsd: number,
  rawInput: Record<string, unknown>,
  rawOutput: Record<string, unknown>
): Promise<{ eventId?: string; error?: string }> {
  const { data, error } = await supabase
    .from('micro_events')
    .insert({
      customer_id: customerId,
      product,
      severity,
      estimated_loss_usd: estimatedLossUsd,
      cost_usd: costUsd,
      raw_input: rawInput,
      raw_output: rawOutput
    } as any)
    .select('id')
    .single();

  if (error) return { error: 'Failed to record event' };
  return { eventId: (data as any).id };
}

// Update pain scores
export async function updatePainScores(
  supabase: SupabaseClient,
  customerId: string,
  product: string,
  severity: number,
  estimatedLossUsd: number,
  rawOutput: Record<string, unknown>
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const { data: existingData } = await supabase
    .from('pain_scores')
    .select('*')
    .eq('customer_id', customerId)
    .eq('window_date', today)
    .maybeSingle();

  const existing = existingData as any;

  const updates: Record<string, unknown> = {
    pain_score_total: (existing?.pain_score_total || 0) + severity,
    estimated_loss_usd_total: (existing?.estimated_loss_usd_total || 0) + estimatedLossUsd,
    events_count: (existing?.events_count || 0) + 1,
  };

  // Product-specific updates
  if (product === 'wallet-risk' && rawOutput.risk_level === 'HIGH') {
    updates.wallet_risk_high_count = (existing?.wallet_risk_high_count || 0) + 1;
    updates.top_problem_type = 'wallet_high';
  } else if (product === 'webhook-check' && !rawOutput.reachable) {
    updates.webhook_failures_count = (existing?.webhook_failures_count || 0) + 1;
    updates.top_problem_type = updates.top_problem_type || 'webhook_failures';
  } else if (product === 'payment-drift' && rawOutput.status === 'MISMATCH') {
    updates.payment_drift_total_usd = (existing?.payment_drift_total_usd || 0) + (rawOutput.drift_usd || 0);
    updates.top_problem_type = updates.top_problem_type || 'payment_drift';
  }

  if (existing) {
    await supabase
      .from('pain_scores')
      .update(updates as any)
      .eq('id', existing.id);
  } else {
    await supabase
      .from('pain_scores')
      .insert({
        customer_id: customerId,
        window_date: today,
        ...updates
      } as any);
  }
}

// Trigger auto-offer evaluation via brain
export async function triggerAutoOfferEvaluation(
  customerId: string,
  product: string,
  eventId: string
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const adminToken = Deno.env.get('ADMIN_API_TOKEN');
    
    // Fire and forget - async evaluation
    fetch(`${supabaseUrl}/functions/v1/micro-brain-evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ customer_id: customerId, product, event_id: eventId }),
    }).catch(() => {/* Ignore errors */});
  } catch {
    // Silent fail - evaluation is non-blocking
  }
}
