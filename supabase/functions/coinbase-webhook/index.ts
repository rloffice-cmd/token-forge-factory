/**
 * Coinbase Commerce Webhook Handler
 * 
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
 * CRITICAL: Never trust unverified webhooks
 */
function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    return signature === expectedSignature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
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
    console.error('Missing COINBASE_COMMERCE_WEBHOOK_SECRET');
    return new Response(
      JSON.stringify({ error: 'Webhook not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-cc-webhook-signature');

    if (!signature) {
      console.error('Missing webhook signature');
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL: Verify signature
    if (!verifySignature(rawBody, signature, WEBHOOK_SECRET)) {
      console.error('Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event?.type;
    const chargeData = event.event?.data;

    console.log(`Webhook received: ${eventType}`, { charge_id: chargeData?.id });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Helper to send Telegram notification
    async function sendTelegram(message: string) {
      if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML',
          }),
        });
      } catch (e) {
        console.error('Telegram send failed:', e);
      }
    }

    // Find payment by charge_id
    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*')
      .eq('charge_id', chargeData?.id)
      .single();

    if (findError || !payment) {
      console.error('Payment not found for charge:', chargeData?.id);
      // Still return 200 to acknowledge receipt
      return new Response(
        JSON.stringify({ received: true, warning: 'Payment not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (eventType) {
      case 'charge:created':
        // Update status to pending
        await supabase
          .from('payments')
          .update({ status: 'pending' })
          .eq('id', payment.id);
        break;

      case 'charge:confirmed':
        // CRITICAL: Payment confirmed - add credits
        const timeline = chargeData?.timeline || [];
        const confirmedEvent = timeline.find((t: any) => t.status === 'COMPLETED');
        
        // Get ETH amount from payments array
        const ethPayment = chargeData?.payments?.find((p: any) => p.network === 'ethereum');
        const amountEth = ethPayment?.value?.crypto?.amount || null;

        // Update payment status
        await supabase
          .from('payments')
          .update({
            status: 'confirmed',
            confirmed_at: new Date().toISOString(),
            amount_eth: amountEth ? parseFloat(amountEth) : null,
            metadata: {
              ...payment.metadata,
              confirmed_data: chargeData,
            },
          })
          .eq('id', payment.id);

        // Add credits to customer wallet
        const { data: wallet } = await supabase
          .from('credit_wallets')
          .select('*')
          .eq('customer_id', payment.customer_id)
          .single();

        if (wallet) {
          // Update existing wallet
          await supabase
            .from('credit_wallets')
            .update({
              credits_balance: wallet.credits_balance + payment.credits_purchased,
              updated_at: new Date().toISOString(),
            })
            .eq('id', wallet.id);
        } else {
          // Create new wallet
          await supabase
            .from('credit_wallets')
            .insert({
              customer_id: payment.customer_id,
              credits_balance: payment.credits_purchased,
            });
        }

        // Audit log
        await supabase.from('audit_logs').insert({
          job_id: payment.id,
          action: 'PAYMENT_CONFIRMED',
          metadata: {
            customer_id: payment.customer_id,
            credits_added: payment.credits_purchased,
            amount_usd: payment.amount_usd,
            amount_eth: amountEth,
            charge_id: chargeData?.id,
          },
        });

        // Send Telegram notification
        await sendTelegram(
          `💰 <b>תשלום אושר!</b>\n\n` +
          `סכום: $${payment.amount_usd} USD\n` +
          `${amountEth ? `ETH: ${amountEth}\n` : ''}` +
          `קרדיטים: +${payment.credits_purchased}\n` +
          `לקוח: ${payment.customer_id.substring(0, 8)}...`
        );
        break;

      case 'charge:failed':
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('id', payment.id);

        // Audit log
        await supabase.from('audit_logs').insert({
          job_id: payment.id,
          action: 'PAYMENT_FAILED',
          metadata: {
            customer_id: payment.customer_id,
            charge_id: chargeData?.id,
            reason: chargeData?.timeline?.slice(-1)?.[0]?.status,
          },
        });

        await sendTelegram(
          `❌ <b>תשלום נכשל</b>\n\n` +
          `סכום: $${payment.amount_usd} USD\n` +
          `לקוח: ${payment.customer_id.substring(0, 8)}...`
        );
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
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
