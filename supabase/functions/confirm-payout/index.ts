/**
 * Confirm Payout Edge Function V2
 * CRITICAL: Now verifies TX on-chain before confirming
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http, formatEther } from 'https://esm.sh/viem@2';
import { mainnet, sepolia } from 'https://esm.sh/viem@2/chains';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConfirmPayoutInput {
  request_id: string;
  tx_hash: string;
  status: 'signed' | 'submitted' | 'confirmed' | 'failed';
  error_message?: string;
}

// Get public client for chain verification
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const input: ConfirmPayoutInput = await req.json();
    
    if (!input.request_id) {
      return new Response(
        JSON.stringify({ error: 'Missing request_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get existing request
    const { data: existing, error: fetchError } = await supabase
      .from('cashout_requests')
      .select('*')
      .eq('id', input.request_id)
      .single();
    
    if (fetchError) throw fetchError;
    if (!existing) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const updates: Record<string, unknown> = { status: input.status };
    
    if (input.status === 'signed') {
      updates.signed_at = new Date().toISOString();
    } else if (input.status === 'submitted') {
      updates.submitted_at = new Date().toISOString();
      if (input.tx_hash) {
        updates.tx_hash = input.tx_hash;
      }
    } else if (input.status === 'confirmed') {
      // CRITICAL: Verify TX on chain before confirming
      const txHash = input.tx_hash || existing.tx_hash;
      
      if (!txHash) {
        return new Response(
          JSON.stringify({ error: 'Cannot confirm without tx_hash' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      try {
        const client = getPublicClient(existing.network);
        
        // Get transaction receipt
        const receipt = await client.getTransactionReceipt({
          hash: txHash as `0x${string}`,
        });
        
        if (!receipt) {
          return new Response(
            JSON.stringify({ 
              error: 'Transaction not found on chain',
              status: 'pending',
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Check if successful
        if (receipt.status !== 'success') {
          updates.status = 'failed';
          updates.error_message = 'Transaction reverted on chain';
        } else {
          // Get transaction details
          const tx = await client.getTransaction({
            hash: txHash as `0x${string}`,
          });
          
          // Verify destination matches
          if (tx.to?.toLowerCase() !== existing.wallet_address.toLowerCase()) {
            return new Response(
              JSON.stringify({ 
                error: 'Transaction destination mismatch',
                expected: existing.wallet_address,
                actual: tx.to,
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          // Verify amount (with 1% tolerance for gas)
          const expectedWei = BigInt(Math.floor(existing.amount_eth * 1e18));
          const tolerance = expectedWei / BigInt(100); // 1% tolerance
          
          if (tx.value < expectedWei - tolerance) {
            return new Response(
              JSON.stringify({ 
                error: 'Transaction value mismatch',
                expected: formatEther(expectedWei),
                actual: formatEther(tx.value),
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          updates.confirmed_at = new Date().toISOString();
          
          // Create verified ledger OUT entry
          const { error: ledgerError } = await supabase
            .from('treasury_ledger')
            .insert({
              amount: existing.amount_dtf,
              asset: 'DTF-TOKEN',
              direction: 'OUT',
              tx_hash: txHash,
              job_id: existing.id,
            });
          
          if (ledgerError) {
            console.error('Failed to create ledger entry:', ledgerError);
          }
          
          console.log(`✅ Verified payout: ${formatEther(tx.value)} ETH to ${tx.to}`);
        }
      } catch (verifyError) {
        console.error('Chain verification failed:', verifyError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to verify transaction on chain',
            details: verifyError instanceof Error ? verifyError.message : 'Unknown error',
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else if (input.status === 'failed') {
      if (input.error_message) {
        updates.error_message = input.error_message;
      }
    }
    
    // Update request
    const { data: updated, error: updateError } = await supabase
      .from('cashout_requests')
      .update(updates)
      .eq('id', input.request_id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Send Telegram notification for confirmed payouts
    if (updates.status === 'confirmed') {
      try {
        const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
        
        if (telegramToken && chatId) {
          const txHash = input.tx_hash || existing.tx_hash;
          const explorerUrl = existing.network === 'sepolia'
            ? `https://sepolia.etherscan.io/tx/${txHash}`
            : `https://etherscan.io/tx/${txHash}`;
          
          const message = `✅ *משיכה אושרה (Verified On-Chain)*\n\n` +
            `💰 סכום: ${existing.amount_eth?.toFixed(6)} ETH\n` +
            `💵 שווי: $${existing.amount_usd?.toFixed(2)}\n` +
            `📍 יעד: \`${existing.wallet_address.slice(0, 10)}...\`\n` +
            `🔗 [צפה ב-Etherscan](${explorerUrl})`;
          
          await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: message,
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
            }),
          });
        }
      } catch (notifyError) {
        console.error('Telegram notification failed:', notifyError);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        request: updated,
        verified: input.status === 'confirmed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error confirming payout:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
