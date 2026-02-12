/**
 * System Audit Edge Function
 * Returns infrastructure, financial, and readiness status
 * Protected by admin token
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, verifyAdminToken, unauthorizedResponse } from "../_shared/auth-guards.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = verifyAdminToken(req);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error!, 'system-audit');
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // 1. Database table checks
    const tableChecks = await Promise.all([
      supabase.from('m2m_partners').select('id', { count: 'exact', head: true }),
      supabase.from('treasury_ledger').select('id', { count: 'exact', head: true }).catch(() => ({ count: 0, error: { message: 'table not found' } })),
      supabase.from('cashout_requests').select('id', { count: 'exact', head: true }),
      supabase.from('payments').select('id', { count: 'exact', head: true }),
      supabase.from('outreach_queue').select('id', { count: 'exact', head: true }),
      supabase.from('click_analytics').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }),
    ]);

    const tables = {
      m2m_partners: { connected: !tableChecks[0].error, count: tableChecks[0].count || 0 },
      treasury_ledger: { connected: !tableChecks[1].error, count: tableChecks[1].count || 0 },
      cashout_requests: { connected: !tableChecks[2].error, count: tableChecks[2].count || 0 },
      payments: { connected: !tableChecks[3].error, count: tableChecks[3].count || 0 },
      outreach_queue: { connected: !tableChecks[4].error, count: tableChecks[4].count || 0 },
      click_analytics: { connected: !tableChecks[5].error, count: tableChecks[5].count || 0 },
      leads: { connected: !tableChecks[6].error, count: tableChecks[6].count || 0 },
    };

    // 2. Secrets check (existence only, never values)
    const secrets = {
      CRON_SECRET: !!Deno.env.get('CRON_SECRET'),
      ADMIN_API_TOKEN: !!Deno.env.get('ADMIN_API_TOKEN'),
      COINBASE_COMMERCE_API_KEY: !!Deno.env.get('COINBASE_COMMERCE_API_KEY'),
      COINBASE_COMMERCE_WEBHOOK_SECRET: !!Deno.env.get('COINBASE_COMMERCE_WEBHOOK_SECRET'),
      TELEGRAM_BOT_TOKEN: !!Deno.env.get('TELEGRAM_BOT_TOKEN'),
      TELEGRAM_CHAT_ID: !!Deno.env.get('TELEGRAM_CHAT_ID'),
      LOVABLE_API_KEY: !!Deno.env.get('LOVABLE_API_KEY'),
      PAYPAL_API_USERNAME: !!Deno.env.get('PAYPAL_API_USERNAME'),
      PAYPAL_API_PASSWORD: !!Deno.env.get('PAYPAL_API_PASSWORD'),
      PAYPAL_API_SIGNATURE: !!Deno.env.get('PAYPAL_API_SIGNATURE'),
      API_KEY_PEPPER: !!Deno.env.get('API_KEY_PEPPER'),
      INGEST_WEBHOOK_TOKEN: !!Deno.env.get('INGEST_WEBHOOK_TOKEN'),
    };

    // 3. Active partners
    const { data: partners } = await supabase
      .from('m2m_partners')
      .select('id, name, affiliate_base_url, commission_rate, category_tags, is_active')
      .eq('is_active', true)
      .order('commission_rate', { ascending: false });

    // 4. Recent activity stats
    const now = new Date();
    const day7 = new Date(now.getTime() - 7 * 86400000).toISOString();
    const day30 = new Date(now.getTime() - 30 * 86400000).toISOString();

    const [clicksRes, outreachRes, paymentsRes] = await Promise.all([
      supabase.from('click_analytics').select('id', { count: 'exact', head: true }).gte('created_at', day30),
      supabase.from('outreach_queue').select('id', { count: 'exact', head: true }).gte('created_at', day7),
      supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
    ]);

    const activity = {
      clicks_30d: clicksRes.count || 0,
      outreach_7d: outreachRes.count || 0,
      confirmed_payments: paymentsRes.count || 0,
    };

    // 5. Readiness score
    let score = 0;
    const maxScore = 100;
    const checks = [
      { weight: 10, pass: secrets.CRON_SECRET },
      { weight: 10, pass: secrets.ADMIN_API_TOKEN },
      { weight: 8, pass: secrets.COINBASE_COMMERCE_API_KEY },
      { weight: 8, pass: secrets.COINBASE_COMMERCE_WEBHOOK_SECRET },
      { weight: 5, pass: secrets.TELEGRAM_BOT_TOKEN && secrets.TELEGRAM_CHAT_ID },
      { weight: 10, pass: secrets.LOVABLE_API_KEY },
      { weight: 8, pass: secrets.PAYPAL_API_USERNAME && secrets.PAYPAL_API_PASSWORD && secrets.PAYPAL_API_SIGNATURE },
      { weight: 5, pass: secrets.API_KEY_PEPPER },
      { weight: 5, pass: secrets.INGEST_WEBHOOK_TOKEN },
      { weight: 10, pass: tables.m2m_partners.connected },
      { weight: 6, pass: tables.payments.connected },
      { weight: 5, pass: tables.outreach_queue.connected },
      { weight: 5, pass: tables.click_analytics.connected },
      { weight: 5, pass: (partners?.length || 0) >= 4 },
    ];
    const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
    checks.forEach(c => { if (c.pass) score += c.weight; });
    const readinessScore = Math.round((score / totalWeight) * 100);

    // 6. Missing components
    const missing: string[] = [];
    if (!secrets.PAYPAL_API_USERNAME) missing.push('PayPal API Username');
    if (!secrets.PAYPAL_API_PASSWORD) missing.push('PayPal API Password');
    if (!secrets.PAYPAL_API_SIGNATURE) missing.push('PayPal API Signature');
    if (!secrets.COINBASE_COMMERCE_API_KEY) missing.push('Coinbase Commerce API Key');
    if (!secrets.COINBASE_COMMERCE_WEBHOOK_SECRET) missing.push('Coinbase Webhook Secret');
    if (!secrets.TELEGRAM_BOT_TOKEN) missing.push('Telegram Bot Token');

    return new Response(JSON.stringify({
      success: true,
      timestamp: now.toISOString(),
      readiness_score: readinessScore,
      infrastructure: { tables, secrets },
      partners: partners || [],
      activity,
      missing_components: missing,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('System audit error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
