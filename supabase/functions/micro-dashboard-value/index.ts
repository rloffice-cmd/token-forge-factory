/**
 * Customer Dashboard Value API
 * Returns aggregated pain/value data for customer dashboard
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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get customer from API key
    const apiKeyHeader = req.headers.get('x-api-key') || req.headers.get('authorization');
    
    if (!apiKeyHeader) {
      return new Response(
        JSON.stringify({ error: 'API key required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = apiKeyHeader.replace('Bearer ', '').trim();
    
    // Hash the key
    const encoder = new TextEncoder();
    const pepper = Deno.env.get('API_KEY_PEPPER') || 'default-pepper';
    const data = encoder.encode(apiKey + pepper);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const { data: keyData } = await supabase
      .from('api_keys')
      .select('customer_id')
      .eq('key_hash', keyHash)
      .eq('status', 'active')
      .maybeSingle();

    if (!keyData) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerId = (keyData as any).customer_id;
    const today = new Date().toISOString().split('T')[0];
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get today's pain scores
    const { data: todayPain } = await supabase
      .from('pain_scores')
      .select('*')
      .eq('customer_id', customerId)
      .eq('window_date', today)
      .maybeSingle();

    // Get 7-day pain history
    const { data: painHistory } = await supabase
      .from('pain_scores')
      .select('*')
      .eq('customer_id', customerId)
      .gte('window_date', last7Days)
      .order('window_date', { ascending: true });

    // Get recent micro events
    const { data: recentEvents } = await supabase
      .from('micro_events')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get rate limits
    const { data: rateLimit } = await supabase
      .from('micro_rate_limits')
      .select('*')
      .eq('customer_id', customerId)
      .eq('limit_date', today)
      .maybeSingle();

    // Get active Guardian offer
    const { data: activeOffer } = await supabase
      .from('guardian_offers')
      .select('*')
      .eq('customer_id', customerId)
      .in('status', ['created', 'sent', 'viewed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const tp = todayPain as any;
    const rl = rateLimit as any;
    const history = (painHistory || []) as any[];
    const events = (recentEvents || []) as any[];

    // Calculate aggregated stats
    const total7DayLoss = history.reduce((sum, p) => sum + (p.estimated_loss_usd_total || 0), 0);
    const avgDailyPain = history.length > 0 
      ? history.reduce((sum, p) => sum + (p.pain_score_total || 0), 0) / history.length 
      : 0;

    return new Response(
      JSON.stringify({
        today: {
          pain_score: tp?.pain_score_total || 0,
          estimated_loss_usd: tp?.estimated_loss_usd_total || 0,
          events_count: tp?.events_count || 0,
          top_problem: tp?.top_problem_type || null,
          wallet_risk_high_count: tp?.wallet_risk_high_count || 0,
          webhook_failures_count: tp?.webhook_failures_count || 0,
          payment_drift_usd: tp?.payment_drift_total_usd || 0,
        },
        rate_limit: {
          spent_usd: rl?.spent_usd || 0,
          cap_usd: rl?.cap_usd || 20,
          remaining_usd: (rl?.cap_usd || 20) - (rl?.spent_usd || 0),
          hits_count: rl?.hits_count || 0,
          blocked: rl?.blocked_at != null,
        },
        summary_7d: {
          total_loss_usd: total7DayLoss,
          avg_daily_pain: avgDailyPain,
          estimated_monthly_loss_usd: total7DayLoss * (30 / 7),
          days_with_data: history.length,
        },
        history: history.map(p => ({
          date: p.window_date,
          pain_score: p.pain_score_total,
          loss_usd: p.estimated_loss_usd_total,
          events: p.events_count,
        })),
        recent_events: events.map(e => ({
          id: e.id,
          product: e.product,
          severity: e.severity,
          loss_usd: e.estimated_loss_usd,
          cost_usd: e.cost_usd,
          created_at: e.created_at,
        })),
        guardian_offer: activeOffer ? {
          id: (activeOffer as any).id,
          estimated_monthly_loss_usd: (activeOffer as any).estimated_monthly_loss_usd,
          reason: (activeOffer as any).reason,
          price_usd: (activeOffer as any).price_usd,
          status: (activeOffer as any).status,
          expires_at: (activeOffer as any).expires_at,
          payment_link: (activeOffer as any).payment_link,
        } : null,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Dashboard value error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
