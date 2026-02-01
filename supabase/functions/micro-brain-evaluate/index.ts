/**
 * Brain Evaluate - Pain Detection & Auto-Offer Engine
 * Evaluates customer pain from micro_events and triggers Guardian offers
 * 
 * FIXED: Now evaluates rules using time_window_hours from micro_events directly
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
    // Validate admin token - STRICT equality check
    const authHeader = req.headers.get('authorization');
    const adminToken = Deno.env.get('ADMIN_API_TOKEN');
    
    if (!adminToken) {
      console.error('ADMIN_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const expectedAuth = `Bearer ${adminToken}`;
    if (!authHeader || authHeader !== expectedAuth) {
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

    // Get active rules
    const { data: rulesData } = await supabase
      .from('auto_offer_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: true });

    const rules = (rulesData || []) as any[];

    if (rules.length === 0) {
      return new Response(
        JSON.stringify({ evaluated: true, offer_triggered: false, reason: 'No active rules' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Evaluate each rule by querying micro_events with the rule's time_window_hours
    let triggeredRule: any = null;
    let offerReason: string | null = null;
    let estimatedLossFromEvents = 0;

    for (const rule of rules) {
      const windowHours = rule.time_window_hours || 24;
      const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
      
      let triggered = false;

      switch (rule.rule_type) {
        case 'wallet_high': {
          // Count HIGH risk wallet events in the time window
          const { count } = await supabase
            .from('micro_events')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer_id)
            .eq('product', 'wallet-risk')
            .gte('created_at', windowStart)
            .filter('raw_output->>risk_level', 'eq', 'HIGH');

          if ((count || 0) >= rule.threshold_value) {
            triggered = true;
            offerReason = 'wallet_high';
            
            // Calculate estimated loss from these events
            const { data: lossEvents } = await supabase
              .from('micro_events')
              .select('estimated_loss_usd')
              .eq('customer_id', customer_id)
              .eq('product', 'wallet-risk')
              .gte('created_at', windowStart);
            
            estimatedLossFromEvents = (lossEvents || []).reduce((sum, e: any) => sum + (e.estimated_loss_usd || 0), 0);
          }
          break;
        }

        case 'payment_drift': {
          // Sum drift_usd from payment-drift events in the time window
          const { data: driftEvents } = await supabase
            .from('micro_events')
            .select('raw_output, estimated_loss_usd')
            .eq('customer_id', customer_id)
            .eq('product', 'payment-drift')
            .gte('created_at', windowStart)
            .filter('raw_output->>status', 'eq', 'MISMATCH');

          const totalDrift = (driftEvents || []).reduce((sum, e: any) => {
            const drift = e.raw_output?.drift_usd || 0;
            return sum + drift;
          }, 0);

          if (totalDrift >= rule.threshold_value) {
            triggered = true;
            offerReason = 'payment_drift';
            estimatedLossFromEvents = (driftEvents || []).reduce((sum, e: any) => sum + (e.estimated_loss_usd || 0), 0);
          }
          break;
        }

        case 'webhook_failures': {
          // Count unreachable webhook events in the time window
          const { count } = await supabase
            .from('micro_events')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer_id)
            .eq('product', 'webhook-check')
            .gte('created_at', windowStart)
            .filter('raw_output->>reachable', 'eq', 'false');

          if ((count || 0) >= rule.threshold_value) {
            triggered = true;
            offerReason = 'webhook_failures';
            
            const { data: failEvents } = await supabase
              .from('micro_events')
              .select('estimated_loss_usd')
              .eq('customer_id', customer_id)
              .eq('product', 'webhook-check')
              .gte('created_at', windowStart);
            
            estimatedLossFromEvents = (failEvents || []).reduce((sum, e: any) => sum + (e.estimated_loss_usd || 0), 0);
          }
          break;
        }

        case 'combined': {
          // Sum all estimated_loss_usd in the time window
          const { data: allEvents } = await supabase
            .from('micro_events')
            .select('estimated_loss_usd, severity')
            .eq('customer_id', customer_id)
            .gte('created_at', windowStart);

          const totalPainScore = (allEvents || []).reduce((sum, e: any) => sum + (e.severity || 0), 0);

          if (totalPainScore >= rule.threshold_value) {
            triggered = true;
            offerReason = 'combined';
            estimatedLossFromEvents = (allEvents || []).reduce((sum, e: any) => sum + (e.estimated_loss_usd || 0), 0);
          }
          break;
        }
      }

      if (triggered) {
        triggeredRule = rule;
        break;
      }
    }

    if (!triggeredRule) {
      // Get current pain summary for response
      const today = new Date().toISOString().split('T')[0];
      const { data: painData } = await supabase
        .from('pain_scores')
        .select('*')
        .eq('customer_id', customer_id)
        .eq('window_date', today)
        .maybeSingle();

      const pain = painData as any;

      return new Response(
        JSON.stringify({ 
          evaluated: true, 
          offer_triggered: false, 
          reason: 'No rules matched',
          pain_summary: pain ? {
            pain_score_total: pain.pain_score_total,
            estimated_loss_usd_total: pain.estimated_loss_usd_total,
            wallet_risk_high_count: pain.wallet_risk_high_count,
            webhook_failures_count: pain.webhook_failures_count,
            payment_drift_total_usd: pain.payment_drift_total_usd,
          } : null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate estimated monthly loss from the window data
    const windowHours = triggeredRule.time_window_hours || 24;
    const estimatedMonthlyLoss = (estimatedLossFromEvents / windowHours) * 24 * 30;

    // Create Guardian offer
    const { data: offer, error: offerError } = await supabase
      .from('guardian_offers')
      .insert({
        customer_id,
        estimated_monthly_loss_usd: Math.round(estimatedMonthlyLoss),
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
💸 הפסד חודשי משוער: $${Math.round(estimatedMonthlyLoss).toLocaleString()}
🔥 סיבה: ${offerReason}
⏱ חלון זמן: ${windowHours} שעות
📊 הפסד בחלון: $${estimatedLossFromEvents.toFixed(0)}

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
        estimated_monthly_loss_usd: Math.round(estimatedMonthlyLoss),
        triggered_by_rule: triggeredRule.rule_name,
        time_window_hours: windowHours,
        loss_in_window: estimatedLossFromEvents,
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
