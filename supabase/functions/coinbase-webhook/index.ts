/**
 * Coinbase Commerce Webhook Handler - PRODUCTION ONLY V2
 * 
 * CRITICAL RULES (KILL GATES):
 * 1. NO payment in DB → NO Telegram, NO Ledger, just log
 * 2. Telegram ONLY on charge:confirmed/resolved with amount > 0
 * 3. Duplicate Ledger prevention via payment_id/tx_hash check
 * 4. All events logged to notifications table
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cc-webhook-signature',
};

// Events that CAN trigger Telegram (but only if all conditions met)
const TELEGRAM_ELIGIBLE_EVENTS = ['charge:confirmed', 'charge:resolved'];

/**
 * Verify Coinbase Commerce webhook signature
 * CRITICAL: Reject ALL unverified webhooks
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    if (signature.length !== expectedSignature.length) return false;
    let result = 0;
    for (let i = 0; i < signature.length; i++) {
      result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    return result === 0;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Send Telegram notification - ONLY for real confirmed payments
 */
async function sendTelegramAlert(
  botToken: string, 
  chatId: string, 
  eventType: string,
  chargeData: any,
  paymentDetails: { amount: number; currency: string; txHash: string | null; network: string },
  amountUsd: number
): Promise<boolean> {
  try {
    const chargeId = chargeData?.id || 'unknown';
    const chargeCode = chargeData?.code || '';
    
    // Build message in Hebrew
    const message = `💰 <b>איתי!!!</b>
נכנסה עסקה אמיתית 🚀

<b>סוג אירוע:</b> ${eventType}
<b>סכום USD:</b> $${amountUsd.toFixed(2)}
<b>סכום קריפטו:</b> ${paymentDetails.amount} ${paymentDetails.currency}
<b>רשת:</b> ${paymentDetails.network}
<b>Charge ID:</b> <code>${chargeId}</code>
${chargeCode ? `<b>Charge Code:</b> <code>${chargeCode}</code>` : ''}
${paymentDetails.txHash ? `<b>TX:</b> <a href="https://etherscan.io/tx/${paymentDetails.txHash}">View on Etherscan</a>` : ''}`;

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    
    const result = await response.json();
    console.log(`📱 Telegram API response:`, result.ok ? 'Success' : result.description);
    return response.ok && result.ok;
  } catch (e) {
    console.error('Telegram send failed:', e);
    return false;
  }
}

/**
 * Extract payment details from Coinbase charge
 * IMPROVED: Better fallback logic to avoid 0 amounts
 */
function extractPaymentDetails(chargeData: any): {
  currency: string;
  amount: number;
  network: string;
  txHash: string | null;
} {
  const payments = chargeData?.payments || [];
  
  // Priority 1: Find confirmed/completed payment
  const confirmedPayment = payments.find((p: any) => 
    p.status === 'CONFIRMED' || p.status === 'COMPLETED'
  );
  
  if (confirmedPayment) {
    const cryptoValue = confirmedPayment.value?.crypto;
    return {
      currency: cryptoValue?.currency || 'ETH',
      amount: parseFloat(cryptoValue?.amount || '0'),
      network: detectNetwork(confirmedPayment.network, chargeData),
      txHash: confirmedPayment.transaction_id || null,
    };
  }
  
  // Priority 2: Any payment with value
  const anyPaymentWithValue = payments.find((p: any) => 
    p.value?.crypto?.amount && parseFloat(p.value.crypto.amount) > 0
  );
  
  if (anyPaymentWithValue) {
    const cryptoValue = anyPaymentWithValue.value?.crypto;
    return {
      currency: cryptoValue?.currency || 'ETH',
      amount: parseFloat(cryptoValue?.amount || '0'),
      network: detectNetwork(anyPaymentWithValue.network, chargeData),
      txHash: anyPaymentWithValue.transaction_id || null,
    };
  }
  
  // Priority 3: Pricing info (when payment array is empty but charge has pricing)
  const pricing = chargeData?.pricing;
  if (pricing) {
    // Try ethereum first
    if (pricing.ethereum?.amount && parseFloat(pricing.ethereum.amount) > 0) {
      return {
        currency: 'ETH',
        amount: parseFloat(pricing.ethereum.amount),
        network: 'ethereum',
        txHash: null,
      };
    }
    
    // Try Base if available
    if (pricing.base?.amount && parseFloat(pricing.base.amount) > 0) {
      return {
        currency: 'ETH',
        amount: parseFloat(pricing.base.amount),
        network: 'base',
        txHash: null,
      };
    }
    
    // Try USDC
    if (pricing.usdc?.amount && parseFloat(pricing.usdc.amount) > 0) {
      return {
        currency: 'USDC',
        amount: parseFloat(pricing.usdc.amount),
        network: 'ethereum',
        txHash: null,
      };
    }
    
    // Fallback to local price (USD)
    if (pricing.local?.amount && parseFloat(pricing.local.amount) > 0) {
      // Estimate ETH from USD (rough, but better than 0)
      const usdAmount = parseFloat(pricing.local.amount);
      return {
        currency: 'USD',
        amount: usdAmount,
        network: 'unknown',
        txHash: null,
      };
    }
  }
  
  // Last resort: return 0
  return { currency: 'ETH', amount: 0, network: 'ethereum', txHash: null };
}

/**
 * Detect network from payment data
 */
function detectNetwork(networkFromPayment: string | undefined, chargeData: any): string {
  if (networkFromPayment) {
    const normalized = networkFromPayment.toLowerCase();
    if (normalized.includes('base')) return 'base';
    if (normalized.includes('polygon')) return 'polygon';
    if (normalized.includes('ethereum') || normalized === 'mainnet') return 'ethereum';
    return normalized;
  }
  
  // Check if Base is mentioned anywhere in charge data
  const chargeStr = JSON.stringify(chargeData).toLowerCase();
  if (chargeStr.includes('base')) return 'base';
  
  return 'ethereum';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const WEBHOOK_SECRET = Deno.env.get('COINBASE_COMMERCE_WEBHOOK_SECRET');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

  if (!WEBHOOK_SECRET) {
    console.error('CRITICAL: Missing COINBASE_COMMERCE_WEBHOOK_SECRET');
    return new Response(
      JSON.stringify({ error: 'Webhook not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-cc-webhook-signature');

    // SECURITY: Reject requests without signature
    if (!signature) {
      console.error('SECURITY: Missing webhook signature - REJECTED');
      
      await supabase.from('notifications').insert({
        event_type: 'security_alert',
        message: 'Webhook rejected: missing signature',
        was_sent: false,
        is_test: false,
        source: 'webhook',
        metadata: { ip: req.headers.get('x-forwarded-for'), reason: 'missing_signature' },
      });
      
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify signature
    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      console.error('SECURITY: Invalid webhook signature - REJECTED');
      
      await supabase.from('notifications').insert({
        event_type: 'security_alert',
        message: 'Webhook rejected: invalid signature',
        was_sent: false,
        is_test: false,
        source: 'webhook',
        metadata: { reason: 'invalid_signature' },
      });
      
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event?.type;
    const chargeData = event.event?.data;
    const chargeId = chargeData?.id;

    console.log(`✅ Webhook verified: ${eventType}`, { charge_id: chargeId });

    // ========== KILL GATE #1: Find payment in DB ==========
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, users_customers(email)')
      .eq('charge_id', chargeId)
      .single();

    // CRITICAL: If no payment found, DO NOT proceed with Telegram or Ledger
    if (paymentError || !payment) {
      console.warn(`⚠️ KILL GATE: No payment found for charge_id=${chargeId}`);
      
      await supabase.from('notifications').insert({
        event_type: eventType,
        charge_id: chargeId,
        message: `Ignored: unknown_charge_id - no payment record found`,
        was_sent: false,
        is_test: false,
        source: 'webhook',
        metadata: { 
          reason: 'unknown_charge_id',
          raw_event: event,
        },
      });
      
      return new Response(
        JSON.stringify({ 
          received: true, 
          ignored: true,
          reason: 'unknown_charge_id',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerEmail = (payment.users_customers as any)?.email || 'Unknown';
    const paymentDetails = extractPaymentDetails(chargeData);
    
    // Track if Telegram was actually sent
    let telegramSent = false;
    let ledgerInserted = false;
    let ledgerSkippedDuplicate = false;

    // Process by event type
    switch (eventType) {
      case 'charge:created':
        await supabase
          .from('payments')
          .update({ status: 'pending' })
          .eq('id', payment.id);
        
        await supabase.from('notifications').insert({
          event_type: eventType,
          charge_id: chargeId,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          message: `Charge created: ${chargeId}`,
          was_sent: false,
          is_test: false,
          source: 'webhook',
        });
        break;

      case 'charge:pending':
        await supabase
          .from('payments')
          .update({ status: 'pending' })
          .eq('id', payment.id);
        
        await supabase.from('notifications').insert({
          event_type: eventType,
          charge_id: chargeId,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          message: `Payment pending: ${chargeId}`,
          was_sent: false,
          is_test: false,
          source: 'webhook',
        });
        break;

      case 'charge:confirmed':
      case 'charge:resolved': {
        // Update payment status
        await supabase
          .from('payments')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            amount_eth: paymentDetails.amount,
            metadata: {
              ...payment.metadata,
              confirmed_data: chargeData,
              tx_hash: paymentDetails.txHash,
              currency: paymentDetails.currency,
              network: paymentDetails.network,
            },
          })
          .eq('id', payment.id);

        // ========== KILL GATE #2: Duplicate Ledger Prevention ==========
        const duplicateCheckConditions = [];
        
        // Check by payment_id
        duplicateCheckConditions.push(
          supabase
            .from('treasury_ledger')
            .select('id')
            .eq('payment_id', payment.id)
            .limit(1)
        );
        
        // Check by tx_hash if exists
        if (paymentDetails.txHash) {
          duplicateCheckConditions.push(
            supabase
              .from('treasury_ledger')
              .select('id')
              .eq('tx_hash', paymentDetails.txHash)
              .limit(1)
          );
        }

        const duplicateResults = await Promise.all(duplicateCheckConditions);
        const hasDuplicate = duplicateResults.some(result => 
          result.data && result.data.length > 0
        );

        if (hasDuplicate) {
          console.warn(`⚠️ DUPLICATE BLOCKED: Ledger entry already exists for payment_id=${payment.id}`);
          ledgerSkippedDuplicate = true;
          
          await supabase.from('notifications').insert({
            event_type: eventType,
            charge_id: chargeId,
            amount: paymentDetails.amount,
            currency: paymentDetails.currency,
            message: `Duplicate ledger entry blocked for payment ${payment.id}`,
            was_sent: false,
            is_test: false,
            source: 'webhook',
            metadata: { 
              reason: 'duplicate_ledger_blocked',
              payment_id: payment.id,
              tx_hash: paymentDetails.txHash,
            },
          });
        } else {
          // Insert to treasury ledger (INSERT-ONLY)
          // Use Sentinel ID for job_id since payments are not jobs
          const SENTINEL_JOB_ID = 'a0000000-0000-0000-0000-000000000001';
          
          const { error: ledgerError } = await supabase
            .from('treasury_ledger')
            .insert({
              job_id: SENTINEL_JOB_ID,
              amount: paymentDetails.amount,
              asset: paymentDetails.currency,
              currency: paymentDetails.currency,
              amount_usd: payment.amount_usd,
              direction: 'IN',
              tx_hash: paymentDetails.txHash,
              payment_id: payment.id,
              payer_email: customerEmail,
              charge_code: payment.charge_code,
              network: paymentDetails.network,
            });

          if (ledgerError) {
            console.error('Ledger insert error:', ledgerError);
          } else {
            ledgerInserted = true;
            console.log(`✅ Ledger entry created for payment ${payment.id}`);
          }
        }

        // Update credit wallet
        const { data: wallet } = await supabase
          .from('credit_wallets')
          .select('*')
          .eq('customer_id', payment.customer_id)
          .single();

        if (wallet) {
          await supabase
            .from('credit_wallets')
            .update({
              credits_balance: wallet.credits_balance + payment.credits_purchased,
              total_credits_purchased: (wallet.total_credits_purchased || 0) + payment.credits_purchased,
              updated_at: new Date().toISOString(),
            })
            .eq('id', wallet.id);
        } else {
          await supabase
            .from('credit_wallets')
            .insert({
              customer_id: payment.customer_id,
              credits_balance: payment.credits_purchased,
              total_credits_purchased: payment.credits_purchased,
            });
        }

        // Insert credit event (INSERT-ONLY ledger)
        await supabase.from('credit_events').insert({
          customer_id: payment.customer_id,
          type: 'credit_add',
          amount: payment.credits_purchased,
          source: 'payment',
          ref_id: payment.id,
          metadata: {
            charge_id: chargeId,
            amount_usd: payment.amount_usd,
            pack_id: payment.pack_id,
          },
        });

        // Provision API Key automatically
        let apiKeyProvisioned = false;
        try {
          const provisionResponse = await fetch(
            `${SUPABASE_URL}/functions/v1/provision-api-key`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                customer_id: payment.customer_id,
                payment_id: payment.id,
                mode: 'create_if_missing',
              }),
            }
          );
          const provisionResult = await provisionResponse.json();
          apiKeyProvisioned = provisionResult.success === true;
          console.log(`🔑 API Key provision result:`, provisionResult);
        } catch (provisionError) {
          console.error('API Key provision error:', provisionError);
        }

        // ========== TELEGRAM: Only if ALL conditions met ==========
        const shouldSendTelegram = 
          TELEGRAM_ELIGIBLE_EVENTS.includes(eventType) &&
          payment !== null && // Payment exists in DB
          paymentDetails.amount > 0 && // Has real amount
          !!TELEGRAM_BOT_TOKEN && 
          !!TELEGRAM_CHAT_ID;

        if (shouldSendTelegram) {
          telegramSent = await sendTelegramAlert(
            TELEGRAM_BOT_TOKEN!,
            TELEGRAM_CHAT_ID!,
            eventType,
            chargeData,
            paymentDetails,
            Number(payment.amount_usd)
          );
          console.log(`📱 Telegram result: ${telegramSent ? 'SENT' : 'FAILED'}`);
        } else {
          console.log(`📱 Telegram skipped - conditions not met:`, {
            eventTypeOk: TELEGRAM_ELIGIBLE_EVENTS.includes(eventType),
            paymentExists: payment !== null,
            amountOk: paymentDetails.amount > 0,
            tokensConfigured: !!TELEGRAM_BOT_TOKEN && !!TELEGRAM_CHAT_ID,
          });
        }

        // Log notification
        await supabase.from('notifications').insert({
          event_type: eventType,
          charge_id: chargeId,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          message: `💰 Payment confirmed: $${payment.amount_usd} USD (${paymentDetails.amount} ${paymentDetails.currency})`,
          was_sent: telegramSent,
          is_test: false,
          source: 'webhook',
          metadata: { 
            tx_hash: paymentDetails.txHash,
            customer_email: customerEmail,
            credits_purchased: payment.credits_purchased,
            ledger_inserted: ledgerInserted,
            ledger_skipped_duplicate: ledgerSkippedDuplicate,
            network: paymentDetails.network,
          },
        });

        // Audit log
        await supabase.from('audit_logs').insert({
          job_id: payment.id,
          action: 'PAYMENT_CONFIRMED',
          metadata: {
            customer_id: payment.customer_id,
            customer_email: customerEmail,
            credits_added: payment.credits_purchased,
            amount_usd: payment.amount_usd,
            amount_crypto: paymentDetails.amount,
            currency: paymentDetails.currency,
            network: paymentDetails.network,
            tx_hash: paymentDetails.txHash,
            charge_id: chargeId,
            telegram_sent: telegramSent,
            ledger_inserted: ledgerInserted,
            ledger_skipped_duplicate: ledgerSkippedDuplicate,
            api_key_provisioned: apiKeyProvisioned,
            source: 'coinbase_webhook',
          },
        });
        break;
      }

      case 'charge:failed':
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('id', payment.id);

        await supabase.from('notifications').insert({
          event_type: eventType,
          charge_id: chargeId,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          message: `Payment failed: ${chargeId}`,
          was_sent: false,
          is_test: false,
          source: 'webhook',
          metadata: { reason: chargeData?.timeline?.slice(-1)?.[0]?.status },
        });

        await supabase.from('audit_logs').insert({
          job_id: payment.id,
          action: 'PAYMENT_FAILED',
          metadata: {
            customer_id: payment.customer_id,
            charge_id: chargeId,
            reason: chargeData?.timeline?.slice(-1)?.[0]?.status,
            source: 'coinbase_webhook',
          },
        });
        break;

      default:
        console.log('Unhandled event type:', eventType);
        
        await supabase.from('notifications').insert({
          event_type: eventType,
          charge_id: chargeId,
          message: `Unhandled event: ${eventType}`,
          was_sent: false,
          is_test: false,
          source: 'webhook',
        });
    }

    // ========== RESPONSE: Use actual boolean, not computed ==========
    return new Response(
      JSON.stringify({ 
        received: true, 
        event_type: eventType,
        telegram_sent: telegramSent,
        ledger_inserted: ledgerInserted,
        ledger_skipped_duplicate: ledgerSkippedDuplicate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    await supabase.from('notifications').insert({
      event_type: 'error',
      message: `Webhook error: ${error instanceof Error ? error.message : 'Unknown'}`,
      was_sent: false,
      is_test: false,
      source: 'webhook',
      metadata: { error: String(error) },
    });
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
