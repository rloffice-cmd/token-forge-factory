/**
 * Daily Signal Report - Automated daily summary for Itai
 * 
 * RULES:
 * 1. Runs via pg_cron at 06:00 UTC (08:00 Israel)
 * 2. Only sends Telegram if there's meaningful data
 * 3. Real revenue = confirmed payments only
 * 4. Excludes all test data (is_test=true)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Confirmed payments in last 24h (REAL REVENUE ONLY)
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_usd, credits_purchased')
      .eq('status', 'confirmed')
      .gte('confirmed_at', yesterday.toISOString());

    const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0) || 0;
    const totalCredits = payments?.reduce((sum, p) => sum + Number(p.credits_purchased || 0), 0) || 0;
    const paymentCount = payments?.length || 0;

    // 2. API requests in last 24h
    const { data: apiRequests } = await supabase
      .from('api_requests')
      .select('endpoint, credits_charged')
      .gte('created_at', yesterday.toISOString());

    const walletRequests = apiRequests?.filter(r => r.endpoint === 'signal-wallet').length || 0;
    const contractRequests = apiRequests?.filter(r => r.endpoint === 'signal-contract').length || 0;
    const totalCreditsUsed = apiRequests?.reduce((sum, r) => sum + (r.credits_charged || 0), 0) || 0;

    // 3. Security alerts in last 24h (non-test only)
    const { data: securityAlerts } = await supabase
      .from('notifications')
      .select('id')
      .eq('event_type', 'security_alert')
      .eq('is_test', false)
      .gte('created_at', yesterday.toISOString());

    const alertCount = securityAlerts?.length || 0;

    // 4. New customers in last 24h
    const { data: newCustomers } = await supabase
      .from('users_customers')
      .select('id')
      .gte('created_at', yesterday.toISOString());

    const newCustomerCount = newCustomers?.length || 0;

    // 5. Active API keys
    const { data: activeKeys } = await supabase
      .from('api_keys')
      .select('id')
      .eq('status', 'active');

    const activeKeyCount = activeKeys?.length || 0;

    // Build report message
    const hasRevenue = totalRevenue > 0;
    const hasActivity = walletRequests + contractRequests > 0 || paymentCount > 0;

    let message = '';
    
    if (hasRevenue) {
      message = `💰 <b>איתי!!!</b>
דוח יומי Signal Engine 📊

<b>💵 הכנסות (24 שעות):</b>
• עסקאות: ${paymentCount}
• סה"כ: $${totalRevenue.toFixed(2)} USD
• קרדיטים נמכרו: ${totalCredits.toLocaleString()}

<b>📡 API Activity:</b>
• signal-wallet: ${walletRequests} requests
• signal-contract: ${contractRequests} requests
• קרדיטים נשרפו: ${totalCreditsUsed.toLocaleString()}

<b>👥 לקוחות:</b>
• חדשים: ${newCustomerCount}
• API Keys פעילים: ${activeKeyCount}

${alertCount > 0 ? `<b>🚨 Security Alerts: ${alertCount}</b>` : '✅ אין התראות אבטחה'}`;
    } else if (hasActivity) {
      message = `📊 <b>דוח יומי Signal Engine</b>

<b>📡 API Activity (24h):</b>
• signal-wallet: ${walletRequests} requests
• signal-contract: ${contractRequests} requests
• קרדיטים נשרפו: ${totalCreditsUsed.toLocaleString()}

<b>👥 לקוחות:</b>
• חדשים: ${newCustomerCount}
• API Keys פעילים: ${activeKeyCount}

💰 הכנסות: $0 (אין עסקאות חדשות)

${alertCount > 0 ? `<b>🚨 Security Alerts: ${alertCount}</b>` : '✅ אין התראות אבטחה'}`;
    } else {
      message = `📊 <b>דוח יומי Signal Engine</b>

יום שקט - אין פעילות משמעותית ב-24 שעות האחרונות.

• API Keys פעילים: ${activeKeyCount}
• התראות אבטחה: ${alertCount}`;
    }

    // Send Telegram
    let telegramSent = false;
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const telegramResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      });
      telegramSent = telegramResponse.ok;
    }

    // Log report
    await supabase.from('notifications').insert({
      event_type: 'daily_report',
      message: message.replace(/<[^>]*>/g, ''), // Strip HTML for DB
      was_sent: telegramSent,
      is_test: false,
      source: 'daily-signal-report',
      metadata: {
        revenue_usd: totalRevenue,
        payment_count: paymentCount,
        credits_sold: totalCredits,
        wallet_requests: walletRequests,
        contract_requests: contractRequests,
        credits_burned: totalCreditsUsed,
        security_alerts: alertCount,
        new_customers: newCustomerCount,
        active_keys: activeKeyCount,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        telegram_sent: telegramSent,
        summary: {
          revenue_usd: totalRevenue,
          payment_count: paymentCount,
          api_requests: walletRequests + contractRequests,
          security_alerts: alertCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Daily report error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
