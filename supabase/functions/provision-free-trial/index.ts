/**
 * Provision Free Trial - מנפיק מפתח API חינמי עם 10 קריאות
 * 
 * המטרה: להוריד את חסם הכניסה ולאפשר לאנשים לנסות לפני שמשלמים
 * 
 * FLOW:
 * 1. User submits email
 * 2. Create customer record (if not exists)
 * 3. Check if already used free trial
 * 4. Generate API key with 10 credits
 * 5. Return key (one-time visible)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FREE_TRIAL_CREDITS = 10;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { email } = await req.json();

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    console.log(`🎁 Free Trial request for: ${normalizedEmail}`);

    // 1. Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from('users_customers')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    let customerId: string;

    if (existingCustomer) {
      customerId = existingCustomer.id;
      
      // Check if already used free trial
      const { data: existingTrial } = await supabase
        .from('api_keys')
        .select('id')
        .eq('customer_id', customerId)
        .eq('plan', 'free_trial')
        .maybeSingle();

      if (existingTrial) {
        console.log(`⚠️ Free trial already used for: ${normalizedEmail}`);
        return new Response(
          JSON.stringify({ 
            error: 'כבר השתמשת בתקופת הניסיון. רכוש קרדיטים כדי להמשיך.',
            already_used: true
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Create new customer
      const { data: newCustomer, error: customerError } = await supabase
        .from('users_customers')
        .insert({
          email: normalizedEmail,
          name: 'Free Trial User',
        })
        .select('id')
        .single();

      if (customerError) throw customerError;
      customerId = newCustomer.id;

      // Create credit wallet
      await supabase
        .from('credit_wallets')
        .insert({
          customer_id: customerId,
          credits_balance: FREE_TRIAL_CREDITS,
          total_credits_purchased: FREE_TRIAL_CREDITS,
        });
    }

    // 2. Generate API key
    const rawKey = `sk_trial_${crypto.randomUUID().replace(/-/g, '')}`;
    const keyPrefix = rawKey.substring(0, 12);

    // Hash the key for storage
    const encoder = new TextEncoder();
    const data = encoder.encode(rawKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 3. Create API key record
    const { data: apiKey, error: keyError } = await supabase
      .from('api_keys')
      .insert({
        customer_id: customerId,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        plan: 'free_trial',
        label: 'Free Trial',
        quota_monthly: FREE_TRIAL_CREDITS,
        rate_limit_tier: 'basic',
        status: 'active',
      })
      .select('id')
      .single();

    if (keyError) throw keyError;

    // 4. Add/update credit wallet
    const { data: wallet } = await supabase
      .from('credit_wallets')
      .select('id, credits_balance')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (wallet) {
      await supabase
        .from('credit_wallets')
        .update({ 
          credits_balance: wallet.credits_balance + FREE_TRIAL_CREDITS,
          total_credits_purchased: FREE_TRIAL_CREDITS,
        })
        .eq('id', wallet.id);
    } else {
      await supabase
        .from('credit_wallets')
        .insert({
          customer_id: customerId,
          credits_balance: FREE_TRIAL_CREDITS,
          total_credits_purchased: FREE_TRIAL_CREDITS,
        });
    }

    // 5. Record credit event
    await supabase.from('credit_events').insert({
      customer_id: customerId,
      type: 'credit',
      amount: FREE_TRIAL_CREDITS,
      source: 'free_trial',
      ref_id: apiKey.id,
      metadata: { email: normalizedEmail },
    });

    // 6. Create lead record for marketing (ignore if exists)
    try {
      await supabase.from('leads').insert({
        email: normalizedEmail,
        source: 'free_trial',
        source_type: 'landing_page',
        status: 'trial',
        funnel_stage: 'evaluation',
        acquisition_channel: 'organic',
        customer_id: customerId,
      });
    } catch {
      // Ignore duplicate
    }

    // 7. Log audit event
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000001',
      action: 'free_trial_provisioned',
      metadata: {
        customer_id: customerId,
        email: normalizedEmail,
        credits: FREE_TRIAL_CREDITS,
        api_key_id: apiKey.id,
      },
    });

    console.log(`✅ Free trial provisioned for: ${normalizedEmail}`);

    return new Response(
      JSON.stringify({
        success: true,
        api_key: rawKey,
        credits: FREE_TRIAL_CREDITS,
        message: 'מפתח ה-API שלך! שמור אותו - לא תראה אותו שוב.',
        docs_url: '/api-docs',
        expires_info: 'הקרדיטים לא פגים. השתמש בהם מתי שתרצה.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Free trial error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to provision free trial', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
