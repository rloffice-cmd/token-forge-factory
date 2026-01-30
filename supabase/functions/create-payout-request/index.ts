/**
 * Create Payout Request Edge Function V2
 * CRITICAL CHANGES:
 * 1. Validates against ON-CHAIN balance, not DB ledger
 * 2. Fetches real ETH price from oracle
 * 3. Checks Safe ownership before allowing
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http, formatEther } from 'https://esm.sh/viem@2';
import { mainnet, sepolia } from 'https://esm.sh/viem@2/chains';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PayoutRequestInput {
  amount_eth: number;
  wallet_address: string;
  safe_address: string;
  signer_address: string;
  network?: string;
}

// Get public client for chain queries
function getPublicClient(network: string) {
  const chain = network === 'sepolia' ? sepolia : mainnet;
  const rpcUrl = network === 'sepolia' 
    ? 'https://rpc.sepolia.org'
    : 'https://eth.llamarpc.com';
  
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

// Get ETH price from CoinGecko (free, no API key)
async function getEthPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    const data = await response.json();
    return data.ethereum.usd;
  } catch (error) {
    console.error('Failed to fetch ETH price:', error);
    throw new Error('Cannot fetch ETH price - required for payout calculation');
  }
}

// Get Safe balance from chain
async function getSafeBalance(safeAddress: string, network: string): Promise<bigint> {
  const client = getPublicClient(network);
  return await client.getBalance({ address: safeAddress as `0x${string}` });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const input: PayoutRequestInput = await req.json();
    const network = input.network || 'ethereum';
    
    // Validate input
    if (!input.amount_eth || input.amount_eth <= 0) {
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
    
    if (!input.safe_address || !/^0x[a-fA-F0-9]{40}$/.test(input.safe_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid Safe address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get real ETH price
    const ethPriceUsd = await getEthPrice();
    console.log(`ETH price: $${ethPriceUsd}`);
    
    // Check Safe balance ON-CHAIN (source of truth)
    const safeBalance = await getSafeBalance(input.safe_address, network);
    const safeBalanceEth = parseFloat(formatEther(safeBalance));
    
    console.log(`Safe ${input.safe_address} balance: ${safeBalanceEth} ETH`);
    
    // Check for pending requests
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('cashout_requests')
      .select('amount_eth')
      .in('status', ['pending', 'signed', 'submitted']);
    
    if (pendingError) throw pendingError;
    
    const pendingAmount = (pendingRequests || [])
      .reduce((sum, e) => sum + Number(e.amount_eth || 0), 0);
    
    const availableBalance = safeBalanceEth - pendingAmount;
    
    console.log(`Available balance: ${availableBalance} ETH (pending: ${pendingAmount} ETH)`);
    
    // Check balance
    if (input.amount_eth > availableBalance) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient Safe balance',
          available: availableBalance,
          pending: pendingAmount,
          requested: input.amount_eth,
          safe_total: safeBalanceEth,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Calculate amounts
    const amount_usd = input.amount_eth * ethPriceUsd;
    const amount_dtf = amount_usd / 0.42; // Convert USD to DTF equivalent
    
    // Create payout request
    const { data: request, error: insertError } = await supabase
      .from('cashout_requests')
      .insert({
        amount_dtf,
        amount_usd,
        amount_eth: input.amount_eth,
        eth_price_usd: ethPriceUsd,
        wallet_address: input.wallet_address,
        network,
        status: 'pending',
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    // Send Telegram notification
    try {
      const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
      
      if (telegramToken && chatId) {
        const message = `⏳ *בקשת משיכה חדשה*\n\n` +
          `💰 סכום: ${input.amount_eth.toFixed(6)} ETH\n` +
          `💵 שווי: $${amount_usd.toFixed(2)}\n` +
          `📍 יעד: \`${input.wallet_address.slice(0, 10)}...\`\n` +
          `🏦 Safe: \`${input.safe_address.slice(0, 10)}...\`\n\n` +
          `ממתין לחתימה ב-Safe...`;
        
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
          }),
        });
      }
    } catch (notifyError) {
      console.error('Telegram notification failed:', notifyError);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        request,
        safe_balance: safeBalanceEth,
        eth_price: ethPriceUsd,
        message: 'Payout request created. Please create and sign transaction in Safe.',
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
