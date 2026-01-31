/**
 * Provision API Key - Auto-generates API key after confirmed payment
 * 
 * RULES:
 * 1. Only called from coinbase-webhook after confirmed/resolved
 * 2. Creates key only if customer doesn't have active one (mode=create_if_missing)
 * 3. Stores ONLY hash, never plaintext
 * 4. Delivers key via api_key_deliveries table (15-min TTL)
 * 5. NO Telegram - only logged in daily report
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate secure random API key
 */
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'sk_live_';
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < 32; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

/**
 * Hash API key using SHA-256 with pepper
 */
async function hashApiKey(plaintext: string, pepper: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext + pepper);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Determine tier based on pack purchased
 */
function determineTier(packId: string | null): string {
  if (!packId) return 'basic';
  const lower = packId.toLowerCase();
  if (lower.includes('business') || lower.includes('enterprise')) return 'business';
  if (lower.includes('pro') || lower.includes('professional')) return 'pro';
  return 'basic';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const API_KEY_PEPPER = Deno.env.get('API_KEY_PEPPER') || 'default-pepper-change-me-in-production';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { customer_id, payment_id, mode = 'create_if_missing' } = await req.json();

    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify customer exists
    const { data: customer, error: customerError } = await supabase
      .from('users_customers')
      .select('id, email')
      .eq('id', customer_id)
      .single();

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing active API key
    const { data: existingKeys } = await supabase
      .from('api_keys')
      .select('id, key_prefix, status, rate_limit_tier')
      .eq('customer_id', customer_id)
      .eq('status', 'active');

    if (existingKeys && existingKeys.length > 0 && mode === 'create_if_missing') {
      // Customer already has active key
      return new Response(
        JSON.stringify({ 
          success: true,
          action: 'exists',
          message: 'Customer already has an active API key',
          key_prefix: existingKeys[0].key_prefix,
          tier: existingKeys[0].rate_limit_tier,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get payment info for tier determination
    let tier = 'basic';
    if (payment_id) {
      const { data: payment } = await supabase
        .from('payments')
        .select('pack_id, credits_purchased')
        .eq('id', payment_id)
        .single();
      
      if (payment) {
        tier = determineTier(payment.pack_id);
      }
    }

    // Generate new API key
    const plaintextKey = generateApiKey();
    const keyHash = await hashApiKey(plaintextKey, API_KEY_PEPPER);
    const keyPrefix = plaintextKey.substring(0, 12); // sk_live_XXXX

    // Insert API key (hash only)
    const { data: apiKey, error: insertError } = await supabase
      .from('api_keys')
      .insert({
        customer_id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        label: 'default',
        status: 'active',
        rate_limit_tier: tier,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create API key:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create API key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create temporary delivery record (15-min TTL)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    
    await supabase
      .from('api_key_deliveries')
      .insert({
        api_key_id: apiKey.id,
        customer_id,
        plaintext_key: plaintextKey,
        expires_at: expiresAt,
        delivered: false,
      });

    // Log to audit
    // Use a sentinel job_id for non-job audit logs
    const SENTINEL_JOB_ID = 'a0000000-0000-0000-0000-000000000001';
    
    await supabase.from('audit_logs').insert({
      job_id: SENTINEL_JOB_ID,
      action: 'API_KEY_PROVISIONED',
      metadata: {
        customer_id,
        payment_id,
        api_key_id: apiKey.id,
        key_prefix: keyPrefix,
        tier,
        delivery_expires_at: expiresAt,
      },
    });

    console.log(`✅ API key provisioned for customer ${customer_id}, tier: ${tier}`);

    return new Response(
      JSON.stringify({
        success: true,
        action: 'created',
        api_key_id: apiKey.id,
        key_prefix: keyPrefix,
        tier,
        delivery_expires_at: expiresAt,
        // Note: plaintext key is in api_key_deliveries, not returned here
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Provision API key error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
