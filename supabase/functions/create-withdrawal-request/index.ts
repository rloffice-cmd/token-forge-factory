/**
 * Create Withdrawal Request
 * 
 * Creates a cashout request from Treasury Safe to Payout Wallet
 * CRITICAL: Does NOT send funds - only creates a proposal for Safe owner to sign
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http, formatEther } from 'npm:viem@2';
import { mainnet } from 'npm:viem@2/chains';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
};

interface WithdrawalRequest {
  amount_eth: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ADMIN_TOKEN = Deno.env.get('ADMIN_API_TOKEN');
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

  try {
    // Verify admin token
    const adminHeader = req.headers.get('x-admin-token');
    if (ADMIN_TOKEN && adminHeader !== ADMIN_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { amount_eth }: WithdrawalRequest = await req.json();

    if (!amount_eth || amount_eth <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get treasury settings
    const { data: settings, error: settingsError } = await supabase
      .from('treasury_settings')
      .select('*')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: 'הגדרות Treasury לא נמצאו' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { treasury_safe_address, payout_wallet_address, min_withdrawal_eth } = settings;

    // Validate addresses are configured
    if (!treasury_safe_address) {
      return new Response(
        JSON.stringify({ error: 'כתובת Treasury Safe לא מוגדרת' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payout_wallet_address) {
      return new Response(
        JSON.stringify({ error: 'כתובת ארנק יעד (Payout) לא מוגדרת' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate addresses are different (CRITICAL SECURITY CHECK)
    if (treasury_safe_address.toLowerCase() === payout_wallet_address.toLowerCase()) {
      return new Response(
        JSON.stringify({ error: 'כספת Safe חייבת להיות כתובת שונה מארנק פרטי' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check minimum withdrawal
    if (amount_eth < min_withdrawal_eth) {
      return new Response(
        JSON.stringify({ error: `סכום מינימלי למשיכה: ${min_withdrawal_eth} ETH` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check on-chain balance
    const client = createPublicClient({
      chain: mainnet,
      transport: http('https://eth.llamarpc.com'),
    });

    const safeBalance = await client.getBalance({ 
      address: treasury_safe_address as `0x${string}` 
    });
    const safeBalanceEth = parseFloat(formatEther(safeBalance));

    // Check pending withdrawals
    const { data: pending } = await supabase
      .from('cashout_requests')
      .select('amount_eth')
      .in('status', ['pending', 'proposed', 'signed', 'submitted']);

    const pendingTotal = (pending || []).reduce(
      (sum, p) => sum + (p.amount_eth || 0), 
      0
    );

    const availableBalance = safeBalanceEth - pendingTotal;

    if (amount_eth > availableBalance) {
      return new Response(
        JSON.stringify({ 
          error: `יתרה לא מספיקה. זמין: ${availableBalance.toFixed(6)} ETH (כולל בקשות ממתינות)` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ETH price
    let ethPrice = 3500;
    try {
      const priceRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
      );
      const priceData = await priceRes.json();
      ethPrice = priceData.ethereum?.usd || 3500;
    } catch (e) {
      console.warn('Failed to fetch ETH price, using fallback');
    }

    const amount_usd = amount_eth * ethPrice;
    const amount_dtf = amount_usd / 0.42; // DTF rate

    // Create withdrawal request
    const { data: cashout, error: insertError } = await supabase
      .from('cashout_requests')
      .insert({
        amount_eth,
        amount_usd,
        amount_dtf,
        eth_price_usd: ethPrice,
        wallet_address: payout_wallet_address, // Where funds will go
        to_wallet_address: payout_wallet_address,
        safe_address: treasury_safe_address, // Where funds come from
        network: settings.network || 'ethereum',
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create cashout:', insertError);
      return new Response(
        JSON.stringify({ error: 'שגיאה ביצירת בקשת משיכה' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: cashout.id,
      action: 'WITHDRAWAL_REQUESTED',
      metadata: {
        amount_eth,
        amount_usd,
        from_safe: treasury_safe_address,
        to_wallet: payout_wallet_address,
        eth_price: ethPrice,
      },
    });

    // Send Telegram notification
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: 
              `🏦 <b>בקשת משיכה חדשה</b>\n\n` +
              `סכום: ${amount_eth} ETH (~$${amount_usd.toFixed(2)})\n` +
              `מ: ${treasury_safe_address.substring(0, 10)}...\n` +
              `אל: ${payout_wallet_address.substring(0, 10)}...\n\n` +
              `⚠️ נא לאשר ב-Safe UI`,
            parse_mode: 'HTML',
          }),
        });
      } catch (e) {
        console.error('Telegram send failed:', e);
      }
    }

    // Build Safe URL
    const safeUrl = `https://app.safe.global/home?safe=eth:${treasury_safe_address}`;

    return new Response(
      JSON.stringify({
        success: true,
        cashout_id: cashout.id,
        amount_eth,
        amount_usd,
        from_safe: treasury_safe_address,
        to_wallet: payout_wallet_address,
        safe_url: safeUrl,
        message: 'בקשת משיכה נוצרה. יש לאשר ב-Safe UI.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Withdrawal request error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
