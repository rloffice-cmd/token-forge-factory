/**
 * System Health - Admin endpoint for system status
 * 
 * RULES:
 * 1. Protected by x-admin-token header
 * 2. Returns operational metrics
 * 3. No sensitive data exposed
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ADMIN_API_TOKEN = Deno.env.get('ADMIN_API_TOKEN');

  // Verify admin token
  const adminToken = req.headers.get('x-admin-token');
  if (!ADMIN_API_TOKEN || adminToken !== ADMIN_API_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Last webhook event (real only)
    const { data: lastWebhook } = await supabase
      .from('notifications')
      .select('created_at, event_type')
      .eq('source', 'webhook')
      .eq('is_test', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Last confirmed payment
    const { data: lastPayment } = await supabase
      .from('payments')
      .select('confirmed_at, amount_usd')
      .eq('status', 'confirmed')
      .order('confirmed_at', { ascending: false })
      .limit(1)
      .single();

    // API requests in last hour
    const { data: recentRequests } = await supabase
      .from('api_requests')
      .select('id')
      .gte('created_at', oneHourAgo.toISOString());

    // Error notifications in last 24h
    const { data: errors } = await supabase
      .from('notifications')
      .select('id')
      .eq('event_type', 'error')
      .eq('is_test', false)
      .gte('created_at', oneDayAgo.toISOString());

    // Security alerts in last 24h
    const { data: securityAlerts } = await supabase
      .from('notifications')
      .select('id')
      .eq('event_type', 'security_alert')
      .eq('is_test', false)
      .gte('created_at', oneDayAgo.toISOString());

    // Active API keys count
    const { data: activeKeys } = await supabase
      .from('api_keys')
      .select('id')
      .eq('status', 'active');

    // Total credits in circulation
    const { data: creditWallets } = await supabase
      .from('credit_wallets')
      .select('credits_balance');

    const totalCredits = creditWallets?.reduce((sum, w) => sum + Number(w.credits_balance || 0), 0) || 0;

    // Determine overall health status
    const hourssinceWebhook = lastWebhook 
      ? (now.getTime() - new Date(lastWebhook.created_at).getTime()) / (1000 * 60 * 60)
      : 999;

    let status = 'healthy';
    const warnings: string[] = [];

    if (hourssinceWebhook > 48) {
      warnings.push('No webhook events in 48+ hours');
      status = 'degraded';
    }

    if ((errors?.length || 0) > 10) {
      warnings.push(`High error count: ${errors?.length} in 24h`);
      status = 'degraded';
    }

    if ((securityAlerts?.length || 0) > 5) {
      warnings.push(`Security alerts: ${securityAlerts?.length} in 24h`);
    }

    const response = {
      status,
      warnings,
      timestamp: now.toISOString(),
      metrics: {
        last_webhook: lastWebhook ? {
          time: lastWebhook.created_at,
          type: lastWebhook.event_type,
          hours_ago: Math.round(hourssinceWebhook * 10) / 10,
        } : null,
        last_payment: lastPayment ? {
          time: lastPayment.confirmed_at,
          amount_usd: lastPayment.amount_usd,
        } : null,
        api_requests_last_hour: recentRequests?.length || 0,
        errors_24h: errors?.length || 0,
        security_alerts_24h: securityAlerts?.length || 0,
        active_api_keys: activeKeys?.length || 0,
        total_credits_in_circulation: totalCredits,
      },
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('System health error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
