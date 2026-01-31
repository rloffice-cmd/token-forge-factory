/**
 * Auto-Closer Bot - Autonomous Deal Closing
 * שליחת לינקים לתשלום, מעקב ורספונדים, וסגירת עסקאות אוטומטית
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Closing strategies based on engagement
const CLOSING_STRATEGIES = {
  high_intent: {
    approach: 'Direct offer with urgency',
    discount: 20,
    message_style: 'confident, solution-focused',
  },
  medium_intent: {
    approach: 'Value demonstration first',
    discount: 10,
    message_style: 'helpful, educational',
  },
  low_intent: {
    approach: 'Soft touch with free trial',
    discount: 0,
    message_style: 'casual, no-pressure',
  },
};

interface EngagedLead {
  id: string;
  source_url: string;
  source_type: string;
  title: string;
  content: string;
  author?: string;
  relevance_score: number;
  engagement_score: number;
  last_interaction: string;
  status: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const coinbaseApiKey = Deno.env.get('COINBASE_COMMERCE_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('💰 Auto-Closer processing engaged leads...');

    // Get leads that have engaged (replied, clicked, etc.)
    const { data: engagedLeads } = await supabase
      .from('leads')
      .select('*')
      .in('status', ['replied', 'interested', 'engaged'])
      .order('engagement_score', { ascending: false })
      .limit(10);

    if (!engagedLeads || engagedLeads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No engaged leads to close' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${engagedLeads.length} engaged leads...`);

    let dealsAttempted = 0;
    let paymentsCreated = 0;

    for (const lead of engagedLeads as EngagedLead[]) {
      // Determine closing strategy
      const strategy = lead.engagement_score >= 80 ? 'high_intent' :
                       lead.engagement_score >= 50 ? 'medium_intent' : 'low_intent';
      
      const strategyConfig = CLOSING_STRATEGIES[strategy];
      
      // Determine the best package to offer
      const { data: packs } = await supabase
        .from('credit_packs')
        .select('*')
        .eq('is_active', true)
        .order('price_usd', { ascending: true });
      
      if (!packs || packs.length === 0) continue;

      // Select pack based on lead's apparent needs
      const recommendedPack = strategy === 'high_intent' ? packs[packs.length - 1] :
                              strategy === 'medium_intent' ? packs[Math.floor(packs.length / 2)] :
                              packs[0];

      // Calculate final price with potential discount
      const originalPrice = recommendedPack.price_usd;
      const discount = strategyConfig.discount;
      const finalPrice = originalPrice * (1 - discount / 100);

      // Generate personalized closing message
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Auto Closer',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are an expert at closing deals with a ${strategyConfig.message_style} approach.

Strategy: ${strategyConfig.approach}
${discount > 0 ? `Discount to offer: ${discount}%` : 'No discount, emphasize value'}

Rules:
1. Be genuine, not pushy
2. Reference their specific need
3. Explain how our service solves their problem
4. Include a clear call-to-action with the payment link
5. Create urgency if high intent, value if medium, curiosity if low
6. Keep it concise (3-4 sentences)

Product: AI Automation Service - ${recommendedPack.name}
Original price: $${originalPrice}
${discount > 0 ? `Special price for them: $${finalPrice}` : ''}

Return JSON with:
- closing_message: The message to send
- urgency_element: What creates urgency
- value_proposition: Main value point`
            },
            {
              role: 'user',
              content: `Lead info:
Their need: "${lead.title}"
Context: "${lead.content.slice(0, 300)}"
Source: ${lead.source_type}
Engagement level: ${lead.engagement_score}%
Last interaction: ${lead.last_interaction}

Write a closing message for this lead.`
            }
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResponse.ok) {
        console.warn(`AI failed for lead: ${lead.id}`);
        continue;
      }

      const aiData = await aiResponse.json();
      const closingData = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');
      
      if (!closingData.closing_message) continue;

      // Create Coinbase Commerce charge for this lead
      const chargeResponse = await fetch('https://api.commerce.coinbase.com/charges', {
        method: 'POST',
        headers: {
          'X-CC-Api-Key': coinbaseApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${recommendedPack.name} - Special Offer`,
          description: `AI Automation Service - ${recommendedPack.credits} Credits${discount > 0 ? ` (${discount}% discount)` : ''}`,
          pricing_type: 'fixed_price',
          local_price: {
            amount: finalPrice.toFixed(2),
            currency: 'USD',
          },
          metadata: {
            lead_id: lead.id,
            pack_id: recommendedPack.id,
            discount_percent: discount,
            strategy: strategy,
            source: 'auto_closer',
          },
          redirect_url: `${supabaseUrl.replace('.supabase.co', '')}/payment-success`,
          cancel_url: `${supabaseUrl.replace('.supabase.co', '')}/landing`,
        }),
      });

      if (!chargeResponse.ok) {
        console.warn(`Failed to create charge for lead: ${lead.id}`);
        continue;
      }

      const chargeData = await chargeResponse.json();
      const paymentLink = chargeData.data?.hosted_url;

      if (!paymentLink) continue;

      // Store the closing attempt
      await supabase.from('closing_attempts').insert({
        lead_id: lead.id,
        pack_id: recommendedPack.id,
        strategy: strategy,
        original_price: originalPrice,
        offered_price: finalPrice,
        discount_percent: discount,
        charge_id: chargeData.data?.id,
        charge_code: chargeData.data?.code,
        payment_url: paymentLink,
        closing_message: closingData.closing_message,
        status: 'sent',
      });

      // Queue the closing message
      await supabase.from('outreach_queue').insert({
        lead_id: lead.id,
        source_url: lead.source_url,
        message_type: 'closing',
        channel: lead.source_type,
        message_content: `${closingData.closing_message}\n\n🔗 Get started: ${paymentLink}`,
        status: 'queued',
        scheduled_for: new Date().toISOString(),
        metadata: {
          payment_url: paymentLink,
          charge_id: chargeData.data?.id,
          offered_price: finalPrice,
        },
      });

      // Update lead status
      await supabase
        .from('leads')
        .update({ status: 'closing_sent' })
        .eq('id', lead.id);

      dealsAttempted++;
      paymentsCreated++;

      console.log(`Closing sent to lead ${lead.id} - $${finalPrice} (${strategy})`);
    }

    // Notify about closing attempts
    if (dealsAttempted > 0) {
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `💰 <b>Auto-Closer Report</b>\n\nDeals attempted: ${dealsAttempted}\nPayment links created: ${paymentsCreated}\n\n⏳ Waiting for conversions...`,
          type: 'closer_report',
        },
      });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000004', // Sentinel for auto-closer
      action: 'auto_close_attempt',
      metadata: {
        leads_processed: engagedLeads.length,
        deals_attempted: dealsAttempted,
        payments_created: paymentsCreated,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        leads_processed: engagedLeads.length,
        deals_attempted: dealsAttempted,
        payments_created: paymentsCreated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Auto-Closer error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
