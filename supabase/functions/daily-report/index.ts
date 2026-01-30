/**
 * Daily Report Edge Function
 * Sends a summary report every day at 8:00 AM
 * Includes: jobs count, success rate, earnings, top failures
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
    console.log('📊 Generating daily report...');

    // Get yesterday's date range
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Fetch jobs from yesterday
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, status, score, created_at')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString());

    if (jobsError) throw jobsError;

    // Fetch treasury entries from yesterday
    const { data: earnings, error: earningsError } = await supabase
      .from('treasury_ledger')
      .select('amount')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString());

    if (earningsError) throw earningsError;

    // Fetch total treasury
    const { data: totalTreasury } = await supabase
      .from('treasury_ledger')
      .select('amount');

    // Calculate stats
    const totalJobs = jobs?.length || 0;
    const settledJobs = jobs?.filter(j => j.status === 'SETTLED').length || 0;
    const droppedJobs = jobs?.filter(j => j.status === 'DROPPED').length || 0;
    const failedJobs = jobs?.filter(j => j.status === 'FAILED').length || 0;
    const successRate = totalJobs > 0 ? Math.round((settledJobs / totalJobs) * 100) : 0;
    
    const dailyEarnings = earnings?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;
    const totalEarnings = totalTreasury?.reduce((sum, e) => sum + Number(e.amount), 0) || 0;

    // Fetch top failures (Kill Gate reasons)
    const { data: failures } = await supabase
      .from('audit_logs')
      .select('metadata')
      .eq('action', 'kill_gate_triggered')
      .gte('created_at', yesterday.toISOString())
      .lt('created_at', today.toISOString())
      .limit(5);

    const failureReasons = failures?.map(f => {
      const meta = f.metadata as Record<string, unknown>;
      const reproPack = meta?.repro_pack as Record<string, unknown>;
      return reproPack?.failure_category || 'Unknown';
    }) || [];

    // Count failure categories
    const failureCounts: Record<string, number> = {};
    for (const reason of failureReasons) {
      failureCounts[reason as string] = (failureCounts[reason as string] || 0) + 1;
    }

    // Build report message
    const dateStr = yesterday.toLocaleDateString('he-IL', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let message = `📅 דוח יומי - ${dateStr}\n\n`;
    message += `📈 סטטיסטיקות:\n`;
    message += `• ג'ובים: ${totalJobs}\n`;
    message += `• הצלחות: ${settledJobs} (${successRate}%)\n`;
    message += `• נדחו (Kill Gate): ${droppedJobs}\n`;
    message += `• נכשלו (Error): ${failedJobs}\n\n`;
    message += `💰 הכנסות:\n`;
    message += `• אתמול: ${dailyEarnings} DTF-TOKEN\n`;
    message += `• סה"כ: ${totalEarnings} DTF-TOKEN\n`;

    if (Object.keys(failureCounts).length > 0) {
      message += `\n⚠️ סיבות נפוצות לכישלון:\n`;
      for (const [category, count] of Object.entries(failureCounts)) {
        message += `• ${category}: ${count}\n`;
      }
    }

    // Send notification
    await supabase.functions.invoke('telegram-notify', {
      body: {
        type: 'daily_report',
        title: `דוח יומי - ${dateStr}`,
        message,
        data: {
          totalJobs,
          settledJobs,
          droppedJobs,
          failedJobs,
          successRate,
          dailyEarnings,
          totalEarnings,
        },
      },
    });

    console.log('Daily report sent successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        stats: { totalJobs, settledJobs, droppedJobs, successRate, dailyEarnings } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Daily report error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
