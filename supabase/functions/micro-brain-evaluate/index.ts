/**
 * Brain Evaluate - Pain Detection & Auto-Offer Engine
 * Evaluates customer pain scores and triggers Guardian offers
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate admin token
    const authHeader = req.headers.get('authorization');
    const adminToken = Deno.env.get('ADMIN_API_TOKEN');
    
    if (!authHeader || !authHeader.includes(adminToken || '')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const { customer_id, product, event_id } = body;

    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const today = new Date().toISOString().split('T')[0];

    // Get customer's pain scores for today
    const { data: painData } = await supabase
      .from('pain_scores')
      .select('*')
      .eq('customer_id', customer_id)
      .eq('window_date', today)
      .maybeSingle();

    const pain = painData as any;
    if (!pain) {
      return new Response(
        JSON.stringify({ evaluated: true, offer_triggered: false, reason: 'No pain data' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active rules
    const { data: rulesData } = await supabase
      .from('auto_offer_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    const rules = (rulesData || []) as any[];

    // Check if customer already has an active offer
    const { data: existingOffer } = await supabase
      .from('guardian_offers')
      .select('id, status')
      .eq('customer_id', customer_id)
      .in('status', ['created', 'sent', 'viewed'])
      .maybeSingle();

    if (existingOffer) {
      return new Response(
        JSON.stringify({ evaluated: true, offer_triggered: false, reason: 'Active offer exists' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Evaluate rules
    let triggeredRule: any = null;
    let offerReason: string | null = null;

    for (const rule of rules) {
      let triggered = false;

      switch (rule.rule_type) {
        case 'wallet_high':
          if (pain.wallet_risk_high_count >= rule.threshold_value) {
            triggered = true;
            offerReason = 'wallet_high';
          }
          break;

        case 'payment_drift':
          if (pain.payment_drift_total_usd >= rule.threshold_value) {
            triggered = true;
            offerReason = 'payment_drift';
          }
          break;

        case 'webhook_failures':
          if (pain.webhook_failures_count >= rule.threshold_value) {
            triggered = true;
            offerReason = 'webhook_failures';
          }
          break;

        case 'combined':
          // Combined score threshold
          if (pain.pain_score_total >= rule.threshold_value) {
            triggered = true;
            offerReason = 'combined';
          }
          break;
      }

      if (triggered) {
        triggeredRule = rule;
        break;
      }
    }

    if (!triggeredRule) {
      return new Response(
        JSON.stringify({ 
          evaluated: true, 
          offer_triggered: false, 
          reason: 'No rules matched',
          pain_summary: {
            pain_score_total: pain.pain_score_total,
            estimated_loss_usd_total: pain.estimated_loss_usd_total,
            wallet_risk_high_count: pain.wallet_risk_high_count,
            webhook_failures_count: pain.webhook_failures_count,
            payment_drift_total_usd: pain.payment_drift_total_usd,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Guardian offer
    const estimatedMonthlyLoss = pain.estimated_loss_usd_total * 30; // Extrapolate to monthly

    const { data: offer, error: offerError } = await supabase
      .from('guardian_offers')
      .insert({
        customer_id,
        estimated_monthly_loss_usd: estimatedMonthlyLoss,
        reason: offerReason,
        price_usd: 499,
        status: 'created',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      } as any)
      .select('id')
      .single();

    if (offerError) {
      console.error('Failed to create offer:', offerError);
      return new Response(
        JSON.stringify({ error: 'Failed to create offer' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get customer email for notification
    const { data: customer } = await supabase
      .from('users_customers')
      .select('email')
      .eq('id', customer_id)
      .maybeSingle();

    // Send Telegram notification
    try {
      const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
      const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID');
      
      if (telegramBotToken && telegramChatId) {
        const message = `🎯 *Guardian Offer נוצר!*

📧 לקוח: ${(customer as any)?.email || 'Unknown'}
💸 הפסד חודשי משוער: $${estimatedMonthlyLoss.toFixed(0)}
🔥 סיבה: ${offerReason}
📊 ציון כאב יומי: ${pain.pain_score_total}

🔗 Offer ID: \`${(offer as any).id}\``;

        await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: message,
            parse_mode: 'Markdown',
          }),
        });
      }
    } catch (e) {
      console.error('Telegram notification failed:', e);
    }

    return new Response(
      JSON.stringify({ 
        evaluated: true, 
        offer_triggered: true,
        offer_id: (offer as any).id,
        reason: offerReason,
        estimated_monthly_loss_usd: estimatedMonthlyLoss,
        triggered_by_rule: triggeredRule.rule_name,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Brain evaluate error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
