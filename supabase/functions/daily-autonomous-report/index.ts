/**
 * Daily Autonomous Report - Morning Summary
 * דו"ח בוקר יומי - סיכום כל הפעילות האוטונומית
 * Runs at 07:00 Israel time via pg_cron
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    // =====================================================
    // GATHER METRICS FROM LAST 24 HOURS
    // =====================================================

    // Leads created
    const { count: newLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${yesterday}T00:00:00Z`);

    // Hot leads
    const { count: hotLeads } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${yesterday}T00:00:00Z`)
      .gte('intent_score', 70);

    // Outreach sent
    const { count: outreachSent } = await supabase
      .from('outreach_queue')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${yesterday}T00:00:00Z`);

    // Content generated
    const { count: contentGenerated } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${yesterday}T00:00:00Z`);

    // Free trials
    const { count: freeTrials } = await supabase
      .from('api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('plan', 'free_trial')
      .gte('created_at', `${yesterday}T00:00:00Z`);

    // Payments
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_usd, status')
      .gte('created_at', `${yesterday}T00:00:00Z`)
      .eq('status', 'confirmed');

    const totalRevenue = payments?.reduce((sum, p) => sum + (p.amount_usd || 0), 0) || 0;
    const paymentCount = payments?.length || 0;

    // API usage
    const { count: apiCalls } = await supabase
      .from('api_requests')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${yesterday}T00:00:00Z`);

    // Audit logs (automation runs)
    const { data: automationRuns } = await supabase
      .from('audit_logs')
      .select('action')
      .gte('created_at', `${yesterday}T00:00:00Z`)
      .in('action', ['full_autonomous_cycle', 'autonomous_marketing_cycle', 'distribution_cycle_completed']);

    const cycleCount = automationRuns?.length || 0;

    // Top leads by intent score
    const { data: topLeads } = await supabase
      .from('leads')
      .select('title, intent_score, source, source_url')
      .gte('created_at', `${yesterday}T00:00:00Z`)
      .gte('intent_score', 60)
      .order('intent_score', { ascending: false })
      .limit(5);

    // =====================================================
    // BUILD REPORT
    // =====================================================

    const reportLines = [
      '☀️ <b>דו"ח בוקר יומי - MicroGuard</b>',
      `📅 ${new Date().toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}`,
      '',
      '📊 <b>סיכום 24 שעות אחרונות:</b>',
      '',
      '<b>🎯 לידים:</b>',
      `• לידים חדשים: ${newLeads || 0}`,
      `• לידים חמים (70+): ${hotLeads || 0}`,
      '',
      '<b>📢 שיווק:</b>',
      `• הודעות בתור: ${outreachSent || 0}`,
      `• תוכן שנוצר: ${contentGenerated || 0}`,
      `• מחזורי אוטומציה: ${cycleCount}`,
      '',
      '<b>💰 עסקים:</b>',
      `• Free Trials חדשים: ${freeTrials || 0}`,
      `• תשלומים: ${paymentCount}`,
      `• הכנסות: $${totalRevenue.toFixed(2)}`,
      `• קריאות API: ${apiCalls || 0}`,
    ];

    // Add top leads if any
    if (topLeads && topLeads.length > 0) {
      reportLines.push('');
      reportLines.push('<b>🔥 לידים מובילים:</b>');
      for (const lead of topLeads.slice(0, 3)) {
        const title = (lead.title || 'No title').slice(0, 35);
        reportLines.push(`• [${lead.intent_score}] ${title}...`);
      }
    }

    // Add action items
    reportLines.push('');
    reportLines.push('<b>📋 פעולות נדרשות:</b>');
    
    if ((hotLeads || 0) > 0) {
      reportLines.push(`• יש ${hotLeads} לידים חמים לבדוק`);
    }
    if ((outreachSent || 0) > 0) {
      reportLines.push(`• יש ${outreachSent} הודעות מוכנות לפרסום`);
    }
    if ((freeTrials || 0) > 0) {
      reportLines.push(`• ${freeTrials} משתמשים חדשים - לעקוב אחרי המרה`);
    }
    if ((hotLeads || 0) === 0 && (outreachSent || 0) === 0) {
      reportLines.push('• אין פעולות דחופות ✓');
    }

    reportLines.push('');
    reportLines.push('🤖 <i>המערכת פועלת באופן אוטונומי 24/7</i>');

    // Send to Telegram
    await supabase.functions.invoke('telegram-notify', {
      body: {
        message: reportLines.join('\n'),
        type: 'daily_report',
      },
    });

    // Save metrics to brain_metrics_daily
    await supabase.from('brain_metrics_daily').upsert({
      day: yesterday,
      signals_count: newLeads || 0,
      opp_count: hotLeads || 0,
      outreach_sent: outreachSent || 0,
      checkouts_created: freeTrials || 0,
      paid_count: paymentCount,
      revenue_usd: totalRevenue,
      notes: `Auto-generated: ${cycleCount} cycles, ${contentGenerated} content pieces`,
    }, { onConflict: 'day' });

    console.log('✅ Daily report sent');

    return new Response(
      JSON.stringify({
        success: true,
        metrics: {
          new_leads: newLeads,
          hot_leads: hotLeads,
          outreach: outreachSent,
          content: contentGenerated,
          trials: freeTrials,
          payments: paymentCount,
          revenue: totalRevenue,
          api_calls: apiCalls,
          cycles: cycleCount,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Daily report error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
