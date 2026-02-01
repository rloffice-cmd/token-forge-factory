/**
 * Dynamic Pricing Engine
 * Calculates personalized discounts based on lead behavior and urgency
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PricingFactors {
  base_price: number;
  urgency_multiplier: number;
  engagement_discount: number;
  time_decay_discount: number;
  competitor_adjustment: number;
  final_price: number;
  discount_code: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { opportunity_id, lead_id, product_id } = await req.json();

    // Get product base price
    const { data: product } = await supabase
      .from('credit_packs')
      .select('price_usd, credits')
      .eq('id', product_id || 'starter')
      .single();

    const basePrice = product?.price_usd || 29;

    // Calculate urgency from signal
    let urgencyMultiplier = 1.0;
    if (opportunity_id) {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('signal_id, confidence_score')
        .eq('id', opportunity_id)
        .single();

      if (opp?.signal_id) {
        const { data: signal } = await supabase
          .from('demand_signals')
          .select('urgency_score')
          .eq('id', opp.signal_id)
          .single();

        // High urgency = willing to pay more (no discount)
        // Low urgency = needs incentive
        urgencyMultiplier = signal?.urgency_score > 0.7 ? 1.0 : 0.9;
      }
    }

    // Calculate engagement discount
    let engagementDiscount = 0;
    if (lead_id) {
      const { data: interactions } = await supabase
        .from('outreach_queue')
        .select('id, status')
        .eq('lead_id', lead_id);

      // More interactions without conversion = higher discount
      const interactionCount = interactions?.length || 0;
      if (interactionCount >= 3) engagementDiscount = 0.15;
      else if (interactionCount >= 2) engagementDiscount = 0.10;
      else if (interactionCount >= 1) engagementDiscount = 0.05;
    }

    // Time decay discount (older opportunities get bigger discounts)
    let timeDecayDiscount = 0;
    if (opportunity_id) {
      const { data: opp } = await supabase
        .from('opportunities')
        .select('created_at')
        .eq('id', opportunity_id)
        .single();

      if (opp?.created_at) {
        const hoursSinceCreated = (Date.now() - new Date(opp.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursSinceCreated > 72) timeDecayDiscount = 0.25;
        else if (hoursSinceCreated > 24) timeDecayDiscount = 0.15;
        else if (hoursSinceCreated > 6) timeDecayDiscount = 0.05;
      }
    }

    // Calculate final price
    const totalDiscount = Math.min(engagementDiscount + timeDecayDiscount, 0.30); // Max 30% off
    const adjustedPrice = basePrice * urgencyMultiplier * (1 - totalDiscount);
    const finalPrice = Math.max(Math.round(adjustedPrice * 100) / 100, basePrice * 0.7); // Min 70% of base

    // Generate discount code if applicable
    let discountCode: string | null = null;
    if (totalDiscount > 0) {
      const discountPercent = Math.round(totalDiscount * 100);
      discountCode = `SAVE${discountPercent}_${Date.now().toString(36).toUpperCase()}`;
    }

    const pricing: PricingFactors = {
      base_price: basePrice,
      urgency_multiplier: urgencyMultiplier,
      engagement_discount: engagementDiscount,
      time_decay_discount: timeDecayDiscount,
      competitor_adjustment: 0,
      final_price: finalPrice,
      discount_code: discountCode,
    };

    return new Response(
      JSON.stringify(pricing),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Dynamic pricing error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
