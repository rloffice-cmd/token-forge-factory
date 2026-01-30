/**
 * Create Payout Request Edge Function
 * Validates balance and creates a new payout request
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayoutRequestInput {
  amount_dtf: number;
  wallet_address: string;
  network?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const input: PayoutRequestInput = await req.json();
    
    // Validate input
    if (!input.amount_dtf || input.amount_dtf <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!input.wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(input.wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Calculate available balance
    const { data: ledger, error: ledgerError } = await supabase
      .from('treasury_ledger')
      .select('amount, direction');
    
    if (ledgerError) throw ledgerError;
    
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('cashout_requests')
      .select('amount_dtf')
      .in('status', ['pending', 'signed', 'submitted']);
    
    if (pendingError) throw pendingError;
    
    const totalIn = (ledger || [])
      .filter(e => (e.direction || 'IN') === 'IN')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    const totalOut = (ledger || [])
      .filter(e => e.direction === 'OUT')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    
    const pendingAmount = (pendingRequests || [])
      .reduce((sum, e) => sum + Number(e.amount_dtf), 0);
    
    const availableBalance = totalIn - totalOut - pendingAmount;
    
    // Check balance
    if (input.amount_dtf > availableBalance) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance',
          available: availableBalance,
          requested: input.amount_dtf,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Calculate USD and ETH amounts
    const DTF_USD_RATE = 0.42;
    const ETH_USD_RATE = 3500; // TODO: Fetch from oracle
    
    const amount_usd = input.amount_dtf * DTF_USD_RATE;
    const amount_eth = amount_usd / ETH_USD_RATE;
    
    // Create payout request
    const { data: request, error: insertError } = await supabase
      .from('cashout_requests')
      .insert({
        amount_dtf: input.amount_dtf,
        amount_usd,
        amount_eth,
        eth_price_usd: ETH_USD_RATE,
        wallet_address: input.wallet_address,
        network: input.network || 'ethereum',
        status: 'pending',
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // Build transaction payload for signing
    const txPayload = {
      to: input.wallet_address,
      value: Math.floor(amount_eth * 1e18).toString(), // Convert to wei
      chainId: input.network === 'sepolia' ? 11155111 : 1,
    };
    
    return new Response(
      JSON.stringify({
        success: true,
        request,
        txPayload,
        message: 'Payout request created. Please sign the transaction.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error creating payout request:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
