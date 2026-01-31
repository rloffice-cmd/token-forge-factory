/**
 * Coinbase Commerce Webhook Handler - PRODUCTION ONLY
 * 
 * CRITICAL RULES:
 * 1. Telegram ONLY on charge:confirmed or charge:resolved
 * 2. All other events: DB only, NO Telegram
 * 3. Signature verification REQUIRED
 * 4. No demo/test mode notifications
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cc-webhook-signature',
};

// Events that trigger Telegram notifications
const TELEGRAM_EVENTS = ['charge:confirmed', 'charge:resolved'];

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
  paymentDetails: { amount: number; currency: string; txHash: string | null }
): Promise<boolean> {
  try {
    const chargeId = chargeData?.id || 'unknown';
    const chargeCode = chargeData?.code || '';
    
    // Build message in Hebrew
    const message = `💰 <b>איתי!!!</b>
נכנסה עסקה אמיתית 🚀

<b>סוג אירוע:</b> ${eventType}
<b>סכום:</b> ${paymentDetails.amount} ${paymentDetails.currency}
<b>רשת:</b> ${chargeData?.payments?.[0]?.network || 'ethereum'}
<b>Charge ID:</b> <code>${chargeId}</code>
${chargeCode ? `<b>Charge Code:</b> <code>${chargeCode}</code>` : ''}
${paymentDetails.txHash ? `<b>TX:</b> <a href="https://etherscan.io/tx/${paymentDetails.txHash}">View</a>` : ''}`;

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
    
    return response.ok;
  } catch (e) {
    console.error('Telegram send failed:', e);
    return false;
  }
}

/**
 * Extract payment details from Coinbase charge
 */
function extractPaymentDetails(chargeData: any): {
  currency: string;
  amount: number;
  network: string;
  txHash: string | null;
} {
  const payments = chargeData?.payments || [];
  const confirmedPayment = payments.find((p: any) => 
    p.status === 'CONFIRMED' || p.status === 'COMPLETED'
  );
  
  if (confirmedPayment) {
    return {
      currency: confirmedPayment.value?.crypto?.currency || 'ETH',
      amount: parseFloat(confirmedPayment.value?.crypto?.amount || '0'),
      network: confirmedPayment.network || 'ethereum',
      txHash: confirmedPayment.transaction_id || null,
    };
  }
  
  // Fallback to first payment
  if (payments.length > 0) {
    const firstPayment = payments[0];
    return {
      currency: firstPayment.value?.crypto?.currency || 'ETH',
      amount: parseFloat(firstPayment.value?.crypto?.amount || '0'),
      network: firstPayment.network || 'ethereum',
      txHash: firstPayment.transaction_id || null,
    };
  }
  
  // Fallback to pricing info
  const pricing = chargeData?.pricing;
  if (pricing?.ethereum) {
    return {
      currency: 'ETH',
      amount: parseFloat(pricing.ethereum.amount || '0'),
      network: 'ethereum',
      txHash: null,
    };
  }
  
  return { currency: 'ETH', amount: 0, network: 'ethereum', txHash: null };
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
      
      // Log security event but NO Telegram
      await supabase.from('notifications').insert({
        event_type: 'security_alert',
        message: 'Webhook rejected: missing signature',
        was_sent: false,
        is_test: false,
        source: 'webhook',
        metadata: { ip: req.headers.get('x-forwarded-for') },
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
      });
      
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event?.type;
    const chargeData = event.event?.data;

    console.log(`✅ Webhook verified: ${eventType}`, { charge_id: chargeData?.id });

    // Find related payment
    const { data: payment } = await supabase
      .from('payments')
      .select('*, users_customers(email)')
      .eq('charge_id', chargeData?.id)
      .single();

    const customerEmail = (payment?.users_customers as any)?.email || 'Unknown';
    const paymentDetails = extractPaymentDetails(chargeData);
    
    // Determine if Telegram should be sent
    const shouldSendTelegram = TELEGRAM_EVENTS.includes(eventType) && 
                               TELEGRAM_BOT_TOKEN && 
                               TELEGRAM_CHAT_ID &&
                               paymentDetails.amount > 0;

    // Process by event type
    switch (eventType) {
      case 'charge:created':
        if (payment) {
          await supabase
            .from('payments')
            .update({ status: 'pending' })
            .eq('id', payment.id);
        }
        
        await supabase.from('notifications').insert({
          event_type: eventType,
          charge_id: chargeData?.id,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          message: `Charge created: ${chargeData?.id}`,
          was_sent: false, // NO Telegram for created
          is_test: false,
          source: 'webhook',
          metadata: { raw_event: event },
        });
        break;

      case 'charge:pending':
        if (payment) {
          await supabase
            .from('payments')
            .update({ status: 'pending' })
            .eq('id', payment.id);
        }
        
        await supabase.from('notifications').insert({
          event_type: eventType,
          charge_id: chargeData?.id,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          message: `Payment pending: ${chargeData?.id}`,
          was_sent: false,
          is_test: false,
          source: 'webhook',
          metadata: { raw_event: event },
        });
        break;

      case 'charge:confirmed':
      case 'charge:resolved': {
        // Update payment status
        if (payment) {
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

          // Add to treasury ledger (INSERT-ONLY)
          await supabase
            .from('treasury_ledger')
            .insert({
              job_id: payment.id,
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
                updated_at: new Date().toISOString(),
              })
              .eq('id', wallet.id);
          } else {
            await supabase
              .from('credit_wallets')
              .insert({
                customer_id: payment.customer_id,
                credits_balance: payment.credits_purchased,
              });
          }
        }

        // Send Telegram ONLY for confirmed/resolved with amount > 0
        let telegramSent = false;
        if (shouldSendTelegram) {
          telegramSent = await sendTelegramAlert(
            TELEGRAM_BOT_TOKEN!,
            TELEGRAM_CHAT_ID!,
            eventType,
            chargeData,
            paymentDetails
          );
          console.log(`📱 Telegram sent: ${telegramSent}`);
        }

        // Log notification
        await supabase.from('notifications').insert({
          event_type: eventType,
          charge_id: chargeData?.id,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          message: `💰 Payment confirmed: $${payment?.amount_usd || 0} USD (${paymentDetails.amount} ${paymentDetails.currency})`,
          was_sent: telegramSent,
          is_test: false,
          source: 'webhook',
          metadata: { 
            tx_hash: paymentDetails.txHash,
            customer_email: customerEmail,
            credits_purchased: payment?.credits_purchased,
          },
        });

        // Audit log
        await supabase.from('audit_logs').insert({
          job_id: payment?.id || '00000000-0000-0000-0000-000000000000',
          action: 'PAYMENT_CONFIRMED',
          metadata: {
            customer_id: payment?.customer_id,
            customer_email: customerEmail,
            credits_added: payment?.credits_purchased,
            amount_usd: payment?.amount_usd,
            amount_crypto: paymentDetails.amount,
            currency: paymentDetails.currency,
            network: paymentDetails.network,
            tx_hash: paymentDetails.txHash,
            charge_id: chargeData?.id,
            telegram_sent: telegramSent,
            source: 'coinbase_webhook',
          },
        });
        break;
      }

      case 'charge:failed':
        if (payment) {
          await supabase
            .from('payments')
            .update({ status: 'failed' })
            .eq('id', payment.id);
        }

        await supabase.from('notifications').insert({
          event_type: eventType,
          charge_id: chargeData?.id,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          message: `Payment failed: ${chargeData?.id}`,
          was_sent: false, // NO Telegram for failures
          is_test: false,
          source: 'webhook',
          metadata: { reason: chargeData?.timeline?.slice(-1)?.[0]?.status },
        });

        // Audit log for failed payments
        await supabase.from('audit_logs').insert({
          job_id: payment?.id || '00000000-0000-0000-0000-000000000000',
          action: 'PAYMENT_FAILED',
          metadata: {
            customer_id: payment?.customer_id,
            charge_id: chargeData?.id,
            reason: chargeData?.timeline?.slice(-1)?.[0]?.status,
            source: 'coinbase_webhook',
          },
        });
        break;

      default:
        console.log('Unhandled event type:', eventType);
        
        await supabase.from('notifications').insert({
          event_type: eventType,
          charge_id: chargeData?.id,
          message: `Unhandled event: ${eventType}`,
          was_sent: false,
          is_test: false,
          source: 'webhook',
          metadata: { raw_event: event },
        });
    }

    return new Response(
      JSON.stringify({ 
        received: true, 
        event_type: eventType,
        telegram_sent: TELEGRAM_EVENTS.includes(eventType) && paymentDetails.amount > 0,
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
