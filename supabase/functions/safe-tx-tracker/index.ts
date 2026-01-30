/**
 * Safe Transaction Tracker Edge Function
 * Monitors Safe Transaction Service for pending payouts and auto-updates status
 * Runs via cron job every minute
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createPublicClient, http, formatEther } from 'https://esm.sh/viem@2';
import { mainnet, sepolia } from 'https://esm.sh/viem@2/chains';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Safe Transaction Service URLs
const SAFE_TX_SERVICE = {
  ethereum: 'https://safe-transaction-mainnet.safe.global',
  sepolia: 'https://safe-transaction-sepolia.safe.global',
};

interface SafeTransaction {
  safeTxHash: string;
  to: string;
  value: string;
  isExecuted: boolean;
  isSuccessful: boolean | null;
  transactionHash: string | null;
  confirmations: Array<{ owner: string; signature: string }>;
  confirmationsRequired: number;
  nonce: number;
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

// Get pending Safe transactions from Transaction Service
async function getSafeTransactions(
  safeAddress: string, 
  network: string
): Promise<SafeTransaction[]> {
  const baseUrl = SAFE_TX_SERVICE[network as keyof typeof SAFE_TX_SERVICE] || SAFE_TX_SERVICE.ethereum;
  
  try {
    const response = await fetch(
      `${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/?limit=20&ordering=-nonce`
    );
    
    if (!response.ok) {
      console.error(`Safe TX Service error: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Failed to fetch Safe transactions:', error);
    return [];
  }
}

// Verify transaction on chain
async function verifyOnChain(
  txHash: string,
  expectedTo: string,
  expectedValue: bigint,
  network: string
): Promise<{ verified: boolean; status: string; error?: string }> {
  try {
    const client = getPublicClient(network);
    
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
    
    if (!receipt) {
      return { verified: false, status: 'pending' };
    }
    
    if (receipt.status !== 'success') {
      return { verified: false, status: 'failed', error: 'Transaction reverted' };
    }
    
    const tx = await client.getTransaction({
      hash: txHash as `0x${string}`,
    });
    
    // Verify destination
    if (tx.to?.toLowerCase() !== expectedTo.toLowerCase()) {
      return { verified: false, status: 'failed', error: 'Destination mismatch' };
    }
    
    // Verify value (1% tolerance)
    const tolerance = expectedValue / BigInt(100);
    if (tx.value < expectedValue - tolerance) {
      return { verified: false, status: 'failed', error: 'Value mismatch' };
    }
    
    return { verified: true, status: 'confirmed' };
  } catch (error) {
    console.error('On-chain verification error:', error);
    return { verified: false, status: 'pending', error: String(error) };
  }
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

    // Get treasury wallet (Safe address)
    const { data: wallet, error: walletError } = await supabase
      .from('treasury_wallet')
      .select('address, network')
      .limit(1)
      .maybeSingle();
    
    if (walletError) throw walletError;
    
    if (!wallet || !wallet.address || wallet.address === '0x0000000000000000000000000000000000000000') {
      return new Response(
        JSON.stringify({ 
          message: 'No treasury wallet configured',
          tracked: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const network = wallet.network || 'ethereum';
    console.log(`📡 Tracking Safe: ${wallet.address} on ${network}`);
    
    // Get pending/submitted cashout requests
    const { data: pendingRequests, error: requestsError } = await supabase
      .from('cashout_requests')
      .select('*')
      .in('status', ['pending', 'signed', 'submitted'])
      .order('created_at', { ascending: false });
    
    if (requestsError) throw requestsError;
    
    if (!pendingRequests || pendingRequests.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No pending requests to track',
          tracked: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📋 Found ${pendingRequests.length} pending requests`);
    
    // Get recent Safe transactions
    const safeTransactions = await getSafeTransactions(wallet.address, network);
    console.log(`🔗 Found ${safeTransactions.length} Safe transactions`);
    
    const updates: Array<{ id: string; status: string; tx_hash?: string }> = [];
    
    for (const request of pendingRequests) {
      // If already has tx_hash, check on-chain status
      if (request.tx_hash) {
        const expectedValue = BigInt(Math.floor((request.amount_eth || 0) * 1e18));
        const verification = await verifyOnChain(
          request.tx_hash,
          request.wallet_address,
          expectedValue,
          network
        );
        
        if (verification.verified && verification.status === 'confirmed') {
          updates.push({ 
            id: request.id, 
            status: 'confirmed',
            tx_hash: request.tx_hash,
          });
          console.log(`✅ Confirmed: ${request.id} - TX: ${request.tx_hash}`);
        } else if (verification.status === 'failed') {
          updates.push({ 
            id: request.id, 
            status: 'failed',
          });
          console.log(`❌ Failed: ${request.id} - ${verification.error}`);
        }
        continue;
      }
      
      // Try to match with Safe transaction
      const expectedValueWei = BigInt(Math.floor((request.amount_eth || 0) * 1e18));
      
      const matchingTx = safeTransactions.find(tx => {
        // Match by destination and approximate value
        if (tx.to.toLowerCase() !== request.wallet_address.toLowerCase()) {
          return false;
        }
        
        const txValue = BigInt(tx.value);
        const tolerance = expectedValueWei / BigInt(100); // 1% tolerance
        
        return txValue >= expectedValueWei - tolerance && 
               txValue <= expectedValueWei + tolerance;
      });
      
      if (matchingTx) {
        console.log(`🔍 Matched request ${request.id} with Safe TX: ${matchingTx.safeTxHash}`);
        
        // Check confirmation status
        const hasEnoughConfirmations = matchingTx.confirmations.length >= matchingTx.confirmationsRequired;
        
        if (matchingTx.isExecuted && matchingTx.transactionHash) {
          // Transaction executed - verify on chain
          const verification = await verifyOnChain(
            matchingTx.transactionHash,
            request.wallet_address,
            expectedValueWei,
            network
          );
          
          if (verification.verified) {
            updates.push({
              id: request.id,
              status: 'confirmed',
              tx_hash: matchingTx.transactionHash,
            });
            console.log(`✅ Auto-confirmed: ${request.id}`);
          } else if (verification.status === 'failed') {
            updates.push({
              id: request.id,
              status: 'failed',
            });
          } else {
            updates.push({
              id: request.id,
              status: 'submitted',
              tx_hash: matchingTx.transactionHash,
            });
          }
        } else if (hasEnoughConfirmations) {
          // Has signatures but not executed yet
          updates.push({
            id: request.id,
            status: 'signed',
          });
          console.log(`✍️ Signed (awaiting execution): ${request.id}`);
        }
      }
    }
    
    // Apply updates
    for (const update of updates) {
      const updateData: Record<string, unknown> = { status: update.status };
      
      if (update.tx_hash) {
        updateData.tx_hash = update.tx_hash;
      }
      
      if (update.status === 'confirmed') {
        updateData.confirmed_at = new Date().toISOString();
        
        // Create ledger entry for confirmed payouts
        const request = pendingRequests.find(r => r.id === update.id);
        if (request) {
          await supabase
            .from('treasury_ledger')
            .insert({
              amount: request.amount_dtf,
              asset: 'DTF-TOKEN',
              direction: 'OUT',
              tx_hash: update.tx_hash,
              job_id: request.id,
            });
        }
      } else if (update.status === 'signed') {
        updateData.signed_at = new Date().toISOString();
      } else if (update.status === 'submitted') {
        updateData.submitted_at = new Date().toISOString();
      }
      
      await supabase
        .from('cashout_requests')
        .update(updateData)
        .eq('id', update.id);
    }
    
    // Send Telegram notification for confirmed payouts
    const confirmed = updates.filter(u => u.status === 'confirmed');
    if (confirmed.length > 0) {
      try {
        const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
        const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
        
        if (telegramToken && chatId) {
          for (const update of confirmed) {
            const request = pendingRequests.find(r => r.id === update.id);
            if (!request) continue;
            
            const explorerUrl = network === 'sepolia'
              ? `https://sepolia.etherscan.io/tx/${update.tx_hash}`
              : `https://etherscan.io/tx/${update.tx_hash}`;
            
            const message = `✅ *משיכה אושרה אוטומטית*\n\n` +
              `💰 סכום: ${request.amount_eth?.toFixed(6)} ETH\n` +
              `💵 שווי: $${request.amount_usd?.toFixed(2)}\n` +
              `📍 יעד: \`${request.wallet_address.slice(0, 10)}...\`\n` +
              `🔗 [צפה ב-Etherscan](${explorerUrl})\n\n` +
              `_זוהה אוטומטית ע״י Safe TX Tracker_`;
            
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
        }
      } catch (notifyError) {
        console.error('Telegram notification failed:', notifyError);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        tracked: pendingRequests.length,
        updated: updates.length,
        confirmed: confirmed.length,
        updates,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in Safe TX Tracker:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
