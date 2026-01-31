/**
 * Coinbase Commerce Webhook Handler
 * 
 * PRODUCTION-GRADE: Real ETH revenue tracking
 * CRITICAL: Verifies webhook signature before processing
 * Handles payment confirmation and credits allocation
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cc-webhook-signature',
};

/**
 * Verify Coinbase Commerce webhook signature
 * CRITICAL: Never trust unverified webhooks - FAIL HARD
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    // Constant-time comparison to prevent timing attacks
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
 * Send Telegram notification
 */
async function sendTelegram(
  botToken: string, 
  chatId: string, 
  message: string
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (e) {
    console.error('Telegram send failed:', e);
  }
}

/**
 * Extract payment details from Coinbase charge data
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
  
  if (payments.length > 0) {
    const firstPayment = payments[0];
    return {
      currency: firstPayment.value?.crypto?.currency || 'ETH',
      amount: parseFloat(firstPayment.value?.crypto?.amount || '0'),
      network: firstPayment.network || 'ethereum',
      txHash: firstPayment.transaction_id || null,
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

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-cc-webhook-signature');

    if (!signature) {
      console.error('SECURITY: Missing webhook signature - REJECTED');
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
          '🚨 <b>אזהרת אבטחה!</b>\n\nWebhook ללא חתימה נדחה'
        );
      }
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      console.error('SECURITY: Invalid webhook signature - REJECTED');
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
          '🚨 <b>אזהרת אבטחה!</b>\n\nWebhook עם חתימה לא תקינה נדחה'
        );
      }
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event?.type;
    const chargeData = event.event?.data;

    console.log(`Webhook verified: ${eventType}`, { charge_id: chargeData?.id });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*, users_customers(email)')
      .eq('charge_id', chargeData?.id)
      .single();

    if (findError || !payment) {
      console.error('Payment not found for charge:', chargeData?.id);
      return new Response(
        JSON.stringify({ received: true, warning: 'Payment not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerEmail = (payment.users_customers as any)?.email || 'Unknown';

    switch (eventType) {
      case 'charge:created':
        await supabase
          .from('payments')
          .update({ status: 'pending' })
          .eq('id', payment.id);
        break;

      case 'charge:confirmed': {
        const paymentDetails = extractPaymentDetails(chargeData);
        
        const expectedUsd = payment.amount_usd;
        const receivedUsd = chargeData?.pricing?.local?.amount;
        
        if (receivedUsd && Math.abs(expectedUsd - parseFloat(receivedUsd)) > 1) {
          console.error('AMOUNT MISMATCH:', { expected: expectedUsd, received: receivedUsd });
          if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
            await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
              `⚠️ <b>חוסר התאמה בסכום!</b>\n\nצפי: $${expectedUsd}\nהתקבל: $${receivedUsd}\nCharge: ${chargeData?.id}`
            );
          }
        }

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
            charge_id: chargeData?.id,
            charge_code: payment.charge_code,
          },
        });

        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
          const txLink = paymentDetails.txHash 
            ? `\n<a href="https://etherscan.io/tx/${paymentDetails.txHash}">צפה ב-Etherscan</a>`
            : '';
          
          await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
            `💰 <b>תשלום אושר!</b>\n\nסכום: $${payment.amount_usd} USD\n${paymentDetails.currency}: ${paymentDetails.amount}\nקרדיטים: +${payment.credits_purchased}\nלקוח: ${customerEmail}${txLink}`
          );
        }
        break;
      }

      case 'charge:failed':
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('id', payment.id);

        await supabase.from('audit_logs').insert({
          job_id: payment.id,
          action: 'PAYMENT_FAILED',
          metadata: {
            customer_id: payment.customer_id,
            customer_email: customerEmail,
            charge_id: chargeData?.id,
            reason: chargeData?.timeline?.slice(-1)?.[0]?.status,
          },
        });

        if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
          await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
            `❌ <b>תשלום נכשל</b>\n\nסכום: $${payment.amount_usd} USD\nלקוח: ${customerEmail}`
          );
        }
        break;

      case 'charge:pending':
        await supabase
          .from('payments')
          .update({ status: 'pending' })
          .eq('id', payment.id);
        break;

      default:
        console.log('Unhandled event type:', eventType);
    }

    return new Response(
      JSON.stringify({ received: true, event_type: eventType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
        `🚨 <b>שגיאת Webhook!</b>\n\n${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
