/**
 * Daily Sweep Edge Function
 * משיכה יומית אוטומטית של כל ההכנסות לארנק שלך
 * Runs every day at 07:00 UTC (10:00 Israel time)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Config
const MIN_SWEEP_USD = 10; // Minimum amount to sweep (avoid dust transactions)
const SWEEP_FEE_USD = 0; // Our platform fee (0 for now)

interface SweepResult {
  success: boolean;
  amount_usd: number;
  amount_eth?: number;
  tx_hash?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('💸 Daily Sweep starting...');

    // 1. Get treasury settings
    const { data: settings } = await supabase
      .from('treasury_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!settings?.payout_wallet_address) {
      const result: SweepResult = {
        success: false,
        amount_usd: 0,
        skipped: true,
        reason: 'No payout wallet configured',
      };
      
      console.log('Sweep skipped: No payout wallet');
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Calculate available balance (IN - OUT)
    const { data: inflows } = await supabase
      .from('treasury_ledger')
      .select('amount_usd')
      .eq('direction', 'IN');

    const { data: outflows } = await supabase
      .from('treasury_ledger')
      .select('amount_usd')
      .eq('direction', 'OUT');

    // Also subtract pending cashout requests
    const { data: pendingCashouts } = await supabase
      .from('cashout_requests')
      .select('amount_usd')
      .in('status', ['pending', 'signed', 'submitted']);

    const totalIn = (inflows || []).reduce((sum, r) => sum + Number(r.amount_usd || 0), 0);
    const totalOut = (outflows || []).reduce((sum, r) => sum + Number(r.amount_usd || 0), 0);
    const pendingTotal = (pendingCashouts || []).reduce((sum, r) => sum + Number(r.amount_usd), 0);
    
    const availableBalance = totalIn - totalOut - pendingTotal;

    console.log(`Balance: $${availableBalance.toFixed(2)} (In: $${totalIn}, Out: $${totalOut}, Pending: $${pendingTotal})`);

    // 3. Check minimum threshold
    if (availableBalance < MIN_SWEEP_USD) {
      const result: SweepResult = {
        success: true,
        amount_usd: 0,
        skipped: true,
        reason: `Balance ($${availableBalance.toFixed(2)}) below minimum ($${MIN_SWEEP_USD})`,
      };

      console.log('Sweep skipped:', result.reason);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Calculate sweep amount (after platform fee)
    const sweepAmount = availableBalance - SWEEP_FEE_USD;

    // 5. Fetch current ETH price
    let ethPriceUsd = 3500; // Fallback
    try {
      const priceResponse = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
      );
      const priceData = await priceResponse.json();
      ethPriceUsd = priceData.ethereum?.usd || 3500;
    } catch (err) {
      console.warn('Failed to fetch ETH price, using fallback:', err);
    }

    const amountEth = sweepAmount / ethPriceUsd;

    // 6. Create cashout request (Human-in-the-loop)
    // Note: This creates a request that needs manual approval via WalletConnect
    const { data: cashoutRequest, error: cashoutError } = await supabase
      .from('cashout_requests')
      .insert({
        amount_dtf: 0, // Not using DTF tokens
        amount_usd: sweepAmount,
        amount_eth: amountEth,
        eth_price_usd: ethPriceUsd,
        wallet_address: settings.payout_wallet_address,
        to_wallet_address: settings.payout_wallet_address,
        network: settings.network || 'ethereum',
        status: 'pending',
      })
      .select()
      .single();

    if (cashoutError) {
      throw new Error(`Failed to create cashout request: ${cashoutError.message}`);
    }

    // 7. Send notification
    const message = [
      `💸 <b>Daily Sweep</b>`,
      ``,
      `סכום: <b>$${sweepAmount.toFixed(2)}</b>`,
      `ב-ETH: <b>${amountEth.toFixed(6)} ETH</b>`,
      `מחיר ETH: <b>$${ethPriceUsd.toFixed(2)}</b>`,
      ``,
      `יעד: <code>${settings.payout_wallet_address.slice(0, 10)}...${settings.payout_wallet_address.slice(-6)}</code>`,
      ``,
      `⏳ ממתין לאישור ידני`,
      ``,
      `📱 <b>פעולה נדרשת:</b>`,
      `היכנס לדשבורד ← Treasury ← אשר משיכה`,
    ].join('\n');

    await supabase.functions.invoke('telegram-notify', {
      body: { message, type: 'daily_sweep' },
    });

    // 8. Audit log
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000001', // Sentinel
      action: 'daily_sweep_created',
      metadata: {
        cashout_id: cashoutRequest.id,
        amount_usd: sweepAmount,
        amount_eth: amountEth,
        eth_price_usd: ethPriceUsd,
        to_wallet: settings.payout_wallet_address,
        available_balance: availableBalance,
      },
    });

    const result: SweepResult = {
      success: true,
      amount_usd: sweepAmount,
      amount_eth: amountEth,
    };

    console.log('Daily sweep completed:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Daily Sweep error:', error);
    
    // Send error notification
    await supabase.functions.invoke('telegram-notify', {
      body: { 
        message: `❌ Daily Sweep Error\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
      },
    });

    return new Response(
      JSON.stringify({ 
        success: false, 
        amount_usd: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
