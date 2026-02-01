/**
 * Guardian Offer API
 * Create, view, and manage Guardian tier offers
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const offerId = pathParts[pathParts.length - 1];

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // GET /guardian-offer/:id - Get offer details
    if (req.method === 'GET' && offerId && offerId !== 'guardian-offer') {
      const { data: offer, error } = await supabase
        .from('guardian_offers')
        .select('*')
        .eq('id', offerId)
        .maybeSingle();

      if (error || !offer) {
        return new Response(
          JSON.stringify({ error: 'Offer not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const o = offer as any;

      // Mark as viewed if first view
      if (o.status === 'created' || o.status === 'sent') {
        await supabase
          .from('guardian_offers')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', offerId);
      }

      // Check if expired
      if (new Date(o.expires_at) < new Date() && o.status !== 'paid') {
        await supabase
          .from('guardian_offers')
          .update({ status: 'expired' })
          .eq('id', offerId);
        o.status = 'expired';
      }

      return new Response(
        JSON.stringify({
          id: o.id,
          estimated_monthly_loss_usd: o.estimated_monthly_loss_usd,
          reason: o.reason,
          price_usd: o.price_usd,
          status: o.status,
          expires_at: o.expires_at,
          created_at: o.created_at,
          payment_link: o.payment_link,
          // Localized messages
          message_he: getHebrewMessage(o.reason, o.estimated_monthly_loss_usd),
          message_en: getEnglishMessage(o.reason, o.estimated_monthly_loss_usd),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /guardian-offer - Create payment link for offer
    if (req.method === 'POST') {
      const body = await req.json();
      const { offer_id } = body;

      if (!offer_id) {
        return new Response(
          JSON.stringify({ error: 'offer_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: offer, error } = await supabase
        .from('guardian_offers')
        .select('*, users_customers(*)')
        .eq('id', offer_id)
        .maybeSingle();

      if (error || !offer) {
        return new Response(
          JSON.stringify({ error: 'Offer not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const o = offer as any;

      if (o.status === 'paid') {
        return new Response(
          JSON.stringify({ error: 'Offer already paid' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (o.status === 'expired') {
        return new Response(
          JSON.stringify({ error: 'Offer expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create Coinbase Commerce checkout
      const coinbaseApiKey = Deno.env.get('COINBASE_COMMERCE_API_KEY');
      
      if (!coinbaseApiKey) {
        return new Response(
          JSON.stringify({ error: 'Payment system not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const chargeResponse = await fetch('https://api.commerce.coinbase.com/charges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CC-Api-Key': coinbaseApiKey,
          'X-CC-Version': '2018-03-22',
        },
        body: JSON.stringify({
          name: 'Guardian Tier - Monthly Subscription',
          description: `Autonomous protection against payment losses. Estimated savings: $${o.estimated_monthly_loss_usd}/month`,
          pricing_type: 'fixed_price',
          local_price: {
            amount: o.price_usd.toString(),
            currency: 'USD',
          },
          metadata: {
            offer_id: o.id,
            customer_id: o.customer_id,
            type: 'guardian_subscription',
          },
          redirect_url: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/payment-success?type=guardian&offer_id=${o.id}`,
          cancel_url: `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app')}/micro`,
        }),
      });

      if (!chargeResponse.ok) {
        const errorData = await chargeResponse.text();
        console.error('Coinbase error:', errorData);
        return new Response(
          JSON.stringify({ error: 'Failed to create payment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const chargeData = await chargeResponse.json();
      const hostedUrl = chargeData.data.hosted_url;
      const chargeId = chargeData.data.id;

      // Update offer with payment link
      await supabase
        .from('guardian_offers')
        .update({ 
          payment_link: hostedUrl,
          charge_id: chargeId,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', offer_id);

      return new Response(
        JSON.stringify({
          success: true,
          payment_link: hostedUrl,
          charge_id: chargeId,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Guardian offer error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getHebrewMessage(reason: string, lossUsd: number): string {
  const lossFormatted = lossUsd.toLocaleString('he-IL', { maximumFractionDigits: 0 });
  
  switch (reason) {
    case 'wallet_high':
      return `זיהינו פעילות ארנקים בסיכון גבוה. הפסד משוער: $${lossFormatted}/חודש. Guardian מגן עליך אוטומטית.`;
    case 'payment_drift':
      return `יש פער בתשלומים שלך! הפסד משוער: $${lossFormatted}/חודש. Guardian מתקן את זה אוטונומית.`;
    case 'webhook_failures':
      return `ה-Webhooks שלך נכשלים. הפסד משוער: $${lossFormatted}/חודש. Guardian מבטיח שהכל מגיע.`;
    default:
      return `זיהינו בעיות במערכת שלך. הפסד משוער: $${lossFormatted}/חודש. Guardian מונע את זה.`;
  }
}

function getEnglishMessage(reason: string, lossUsd: number): string {
  const lossFormatted = lossUsd.toLocaleString('en-US', { maximumFractionDigits: 0 });
  
  switch (reason) {
    case 'wallet_high':
      return `High-risk wallet activity detected. Est. loss: $${lossFormatted}/mo. Guardian protects you automatically.`;
    case 'payment_drift':
      return `Payment drift detected! Est. loss: $${lossFormatted}/mo. Guardian fixes this autonomously.`;
    case 'webhook_failures':
      return `Your webhooks are failing. Est. loss: $${lossFormatted}/mo. Guardian ensures delivery.`;
    default:
      return `System issues detected. Est. loss: $${lossFormatted}/mo. Guardian prevents this.`;
  }
}
