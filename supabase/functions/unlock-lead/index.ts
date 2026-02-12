/**
 * Unlock Lead — Delivers full lead data after purchase verification
 * Triggered by successful payment or admin action
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { listing_id, buyer_email, payment_intent_id, webhook_url } = await req.json();

    if (!listing_id || !buyer_email) {
      return new Response(JSON.stringify({ error: 'listing_id and buyer_email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify listing exists and is available
    const { data: listing, error: listingError } = await supabase
      .from('lead_marketplace')
      .select('*')
      .eq('id', listing_id)
      .eq('status', 'available')
      .single();

    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: 'Listing not available' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Record purchase
    const { data: purchase, error: purchaseError } = await supabase
      .from('lead_purchases')
      .insert({
        listing_id,
        buyer_email,
        amount_usd: listing.price_usd,
        payment_intent_id,
        webhook_url,
        delivery_status: 'pending',
      })
      .select()
      .single();

    if (purchaseError) throw purchaseError;

    // Mark listing as sold
    await supabase.from('lead_marketplace').update({
      status: 'sold',
      buyer_email,
      purchased_at: new Date().toISOString(),
    }).eq('id', listing_id);

    // Deliver full data via webhook if provided
    let deliveryStatus = 'delivered';
    if (webhook_url) {
      try {
        const webhookRes = await fetch(webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchase_id: purchase.id,
            lead_data: listing.full_data,
            niche: listing.niche,
            smart_score: listing.smart_score,
            tier: listing.tier,
          }),
        });
        if (!webhookRes.ok) deliveryStatus = 'failed';
      } catch {
        deliveryStatus = 'failed';
      }
    }

    // Send via Telegram as backup delivery
    const telegramToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
    if (telegramToken && chatId) {
      const fullData = listing.full_data as Record<string, unknown>;
      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `💰 LEAD SOLD!\n\nTier: ${listing.tier.toUpperCase()}\nPrice: $${listing.price_usd}\nBuyer: ${buyer_email}\nNiche: ${listing.niche}\n\nFull Data:\n${JSON.stringify(fullData, null, 2).slice(0, 3000)}`,
          parse_mode: 'HTML',
        }),
      });
    }

    // Update delivery status
    await supabase.from('lead_purchases').update({
      delivery_status: deliveryStatus,
      delivered_at: deliveryStatus === 'delivered' ? new Date().toISOString() : null,
    }).eq('id', purchase.id);

    // Log revenue
    await supabase.from('treasury_ledger').insert({
      type: 'lead_sale',
      amount_usd: listing.price_usd,
      currency: 'USD',
      tx_hash: payment_intent_id || `lead_${purchase.id}`,
      network: 'fiat',
      note: `Lead sold: ${listing.tier} tier — ${listing.niche}`,
    });

    return new Response(JSON.stringify({
      success: true,
      purchase_id: purchase.id,
      delivery_status: deliveryStatus,
      lead_data: deliveryStatus === 'delivered' ? listing.full_data : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
