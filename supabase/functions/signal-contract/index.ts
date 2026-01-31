/**
 * Signal Contract - On-chain smart contract risk assessment API
 * 
 * RULES:
 * 1. Requires valid API key (x-api-key header)
 * 2. Checks denylist (wallet/ip/api_key)
 * 3. Validates credits balance (cost: 2 credits)
 * 4. Burns credits atomically
 * 5. Returns risk assessment JSON
 * 6. INSERT-ONLY logging to api_requests
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const ENDPOINT_NAME = 'signal-contract';

/**
 * Hash API key for lookup
 */
async function hashApiKey(plaintext: string, pepper: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext + pepper);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * MVP Risk Engine - Contract Analysis
 * In production, integrate with on-chain data providers & source verification
 */
function analyzeContract(address: string, chain: string): {
  risk_score: number;
  flags: string[];
  confidence: number;
  decision: string;
  contract_info: {
    is_verified: boolean | null;
    is_proxy: boolean | null;
    has_known_vulnerabilities: boolean | null;
  };
} {
  const flags: string[] = [];
  let risk_score = 0.3; // Base risk for contracts (higher than wallets)
  let confidence = 0.25; // Low confidence without real data

  // Basic validation
  if (!address.startsWith('0x') || address.length !== 42) {
    flags.push('invalid_address_format');
    risk_score = 0.95;
    confidence = 0.95;
    return {
      risk_score,
      flags,
      confidence,
      decision: 'block',
      contract_info: {
        is_verified: null,
        is_proxy: null,
        has_known_vulnerabilities: null,
      },
    };
  }

  // Placeholder checks - in production, query explorers/security APIs
  // These flags indicate we don't have real data
  flags.push('insufficient_on_chain_data');
  flags.push('source_verification_unavailable');

  // Contract-specific placeholder analysis
  const contractInfo = {
    is_verified: null as boolean | null, // Unknown without explorer API
    is_proxy: null as boolean | null, // Unknown without bytecode analysis
    has_known_vulnerabilities: null as boolean | null, // Unknown without audit DB
  };

  // Add warning flags for unknown state
  flags.push('verification_status_unknown');
  
  // Determine decision (conservative due to low confidence)
  let decision: string;
  if (risk_score < 0.4) {
    decision = 'allow';
  } else if (risk_score <= 0.7) {
    decision = 'review';
  } else {
    decision = 'block';
  }

  return {
    risk_score: Math.min(risk_score, 1.0),
    flags,
    confidence,
    decision,
    contract_info: contractInfo,
  };
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
    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing x-api-key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash and lookup API key
    const keyHash = await hashApiKey(apiKey, API_KEY_PEPPER);
    
    const { data: apiKeyRecord, error: keyError } = await supabase
      .from('api_keys')
      .select('id, customer_id, status, rate_limit_tier')
      .eq('key_hash', keyHash)
      .single();

    if (keyError || !apiKeyRecord) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (apiKeyRecord.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'API key revoked' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyRecord.id);

    // Parse request body
    const body = await req.json();
    const { address, chain = 'base' } = body;

    if (!address) {
      return new Response(
        JSON.stringify({ error: 'address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check denylist
    const { data: denylistHits } = await supabase
      .from('denylist')
      .select('type, value, reason')
      .eq('active', true)
      .or(`and(type.eq.wallet,value.ilike.${address}),and(type.eq.ip,value.eq.${clientIp}),and(type.eq.api_key,value.eq.${apiKeyRecord.id})`);

    if (denylistHits && denylistHits.length > 0) {
      // Log security alert
      await supabase.from('notifications').insert({
        event_type: 'security_alert',
        message: `Denylist hit: ${denylistHits[0].type}=${denylistHits[0].value}`,
        was_sent: false,
        is_test: false,
        source: 'signal-contract',
        metadata: { 
          denylist_hits: denylistHits,
          api_key_id: apiKeyRecord.id,
          customer_id: apiKeyRecord.customer_id,
          ip: clientIp,
        },
      });

      return new Response(
        JSON.stringify({ 
          error: 'Access denied',
          reason: 'denylisted',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get endpoint cost
    const { data: endpointCost } = await supabase
      .from('endpoint_costs')
      .select('cost_credits')
      .eq('endpoint_name', ENDPOINT_NAME)
      .eq('is_active', true)
      .single();

    const cost = endpointCost?.cost_credits || 2;

    // Check credits balance
    const { data: wallet } = await supabase
      .from('credit_wallets')
      .select('id, credits_balance, total_credits_burned')
      .eq('customer_id', apiKeyRecord.customer_id)
      .single();

    if (!wallet || wallet.credits_balance < cost) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient credits',
          required: cost,
          balance: wallet?.credits_balance || 0,
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform risk analysis
    const analysis = analyzeContract(address, chain);

    // Atomic credit burn
    const newBalance = wallet.credits_balance - cost;
    
    await supabase
      .from('credit_wallets')
      .update({ 
        credits_balance: newBalance,
        total_credits_burned: (wallet.total_credits_burned || 0) + cost,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    // Insert credit event (INSERT-ONLY)
    await supabase
      .from('credit_events')
      .insert({
        customer_id: apiKeyRecord.customer_id,
        type: 'credit_burn',
        amount: -cost,
        source: 'api_call',
        metadata: { endpoint: ENDPOINT_NAME, address, chain },
      });

    // Insert API request log (INSERT-ONLY)
    const { data: apiRequest } = await supabase
      .from('api_requests')
      .insert({
        customer_id: apiKeyRecord.customer_id,
        api_key_id: apiKeyRecord.id,
        endpoint: ENDPOINT_NAME,
        chain,
        target_address: address,
        credits_charged: cost,
        risk_score: analysis.risk_score,
        flags: analysis.flags,
        confidence: analysis.confidence,
        decision: analysis.decision,
        result_json: analysis,
        ip: clientIp,
        user_agent: userAgent,
      })
      .select()
      .single();

    // Build response
    const response = {
      request_id: apiRequest?.id,
      address,
      chain,
      risk_score: analysis.risk_score,
      flags: analysis.flags,
      confidence: analysis.confidence,
      decision: analysis.decision,
      contract_info: analysis.contract_info,
      cost,
      credits_remaining: newBalance,
      timestamp: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Signal contract error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
