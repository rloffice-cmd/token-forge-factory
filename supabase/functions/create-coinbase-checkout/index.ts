/**
 * Create Coinbase Commerce Checkout
 * 
 * Creates a payment checkout for credit packs
 * Returns hosted_url for redirect to Coinbase Commerce
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  pack_id: string;
  customer_email: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const COINBASE_API_KEY = Deno.env.get('COINBASE_COMMERCE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!COINBASE_API_KEY) {
      console.error('Missing COINBASE_COMMERCE_API_KEY');
      return new Response(
        JSON.stringify({ error: 'Payment system not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { pack_id, customer_email }: CheckoutRequest = await req.json();
    
    if (!pack_id || !customer_email) {
      return new Response(
        JSON.stringify({ error: 'Missing pack_id or customer_email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get credit pack details
    const { data: pack, error: packError } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('id', pack_id)
      .eq('is_active', true)
      .single();

    if (packError || !pack) {
      return new Response(
        JSON.stringify({ error: 'Invalid pack_id or pack not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create customer
    let { data: customer } = await supabase
      .from('users_customers')
      .select('*')
      .eq('email', customer_email)
      .single();

    if (!customer) {
      const { data: newCustomer, error: createError } = await supabase
        .from('users_customers')
        .insert({ email: customer_email })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create customer:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to create customer' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      customer = newCustomer;
    }

    // Create Coinbase Commerce charge
    const chargeData = {
      name: pack.name,
      description: `${pack.credits} קרדיטים - ${pack.name_he}`,
      pricing_type: 'fixed_price',
      local_price: {
        amount: pack.price_usd.toString(),
        currency: 'USD',
      },
      metadata: {
        pack_id: pack.id,
        customer_id: customer.id,
        credits: pack.credits.toString(),
      },
      redirect_url: `${req.headers.get('origin') || 'https://lovable.dev'}/payment-success`,
      cancel_url: `${req.headers.get('origin') || 'https://lovable.dev'}/payment-cancelled`,
    };

    const coinbaseResponse = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CC-Api-Key': COINBASE_API_KEY,
        'X-CC-Version': '2018-03-22',
      },
      body: JSON.stringify(chargeData),
    });

    if (!coinbaseResponse.ok) {
      const errorText = await coinbaseResponse.text();
      console.error('Coinbase API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create payment' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: charge } = await coinbaseResponse.json();

    // Save payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        customer_id: customer.id,
        provider: 'coinbase_commerce',
        charge_id: charge.id,
        charge_code: charge.code,
        hosted_url: charge.hosted_url,
        pack_id: pack.id,
        credits_purchased: pack.credits,
        amount_usd: pack.price_usd,
        status: 'created',
        metadata: {
          charge_data: charge,
        },
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Failed to save payment:', paymentError);
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: payment?.id || '00000000-0000-0000-0000-000000000000',
      action: 'PAYMENT_CREATED',
      metadata: {
        customer_id: customer.id,
        pack_id: pack.id,
        charge_id: charge.id,
        amount_usd: pack.price_usd,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        hosted_url: charge.hosted_url,
        charge_id: charge.id,
        payment_id: payment?.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
