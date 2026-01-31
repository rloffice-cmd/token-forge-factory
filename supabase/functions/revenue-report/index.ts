/**
 * Daily Revenue Report Edge Function
 * Sends Telegram summary of confirmed payments
 * Called via cron or manually
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

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return new Response(
      JSON.stringify({ error: 'Telegram not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get today's date range
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    
    // Fetch today's confirmed payments
    const { data: todayPayments, error: todayError } = await supabase
      .from('payments')
      .select('amount_eth, amount_usd, credits_purchased')
      .eq('status', 'confirmed')
      .gte('confirmed_at', todayStart.toISOString());
    
    if (todayError) throw todayError;
    
    // Fetch yesterday's confirmed payments for comparison
    const { data: yesterdayPayments, error: yesterdayError } = await supabase
      .from('payments')
      .select('amount_eth, amount_usd')
      .eq('status', 'confirmed')
      .gte('confirmed_at', yesterdayStart.toISOString())
      .lt('confirmed_at', todayStart.toISOString());
    
    if (yesterdayError) throw yesterdayError;
    
    // Fetch all-time stats
    const { data: allTimePayments, error: allTimeError } = await supabase
      .from('payments')
      .select('amount_eth, amount_usd')
      .eq('status', 'confirmed');
    
    if (allTimeError) throw allTimeError;
    
    // Calculate stats
    const todayUsd = (todayPayments || []).reduce((sum, p) => sum + Number(p.amount_usd), 0);
    const todayEth = (todayPayments || []).reduce((sum, p) => sum + (Number(p.amount_eth) || 0), 0);
    const todayCredits = (todayPayments || []).reduce((sum, p) => sum + Number(p.credits_purchased), 0);
    const todayCount = (todayPayments || []).length;
    
    const yesterdayUsd = (yesterdayPayments || []).reduce((sum, p) => sum + Number(p.amount_usd), 0);
    
    const allTimeUsd = (allTimePayments || []).reduce((sum, p) => sum + Number(p.amount_usd), 0);
    const allTimeEth = (allTimePayments || []).reduce((sum, p) => sum + (Number(p.amount_eth) || 0), 0);
    const allTimeCount = (allTimePayments || []).length;
    
    // Calculate change
    let changeEmoji = '➡️';
    let changeText = '';
    if (yesterdayUsd > 0) {
      const changePercent = ((todayUsd - yesterdayUsd) / yesterdayUsd * 100).toFixed(1);
      if (todayUsd > yesterdayUsd) {
        changeEmoji = '📈';
        changeText = ` (+${changePercent}%)`;
      } else if (todayUsd < yesterdayUsd) {
        changeEmoji = '📉';
        changeText = ` (${changePercent}%)`;
      }
    }
    
    // Format date
    const dateStr = now.toLocaleDateString('he-IL', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    
    // Build message
    const message = `📊 <b>דו״ח הכנסות יומי</b>\n` +
      `${dateStr}\n\n` +
      `<b>היום:</b>\n` +
      `💰 $${todayUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD${changeText}\n` +
      `⟠ ${todayEth.toFixed(6)} ETH\n` +
      `🎟️ ${todayCredits} קרדיטים נמכרו\n` +
      `📝 ${todayCount} תשלומים\n\n` +
      `<b>סה״כ (All Time):</b>\n` +
      `💵 $${allTimeUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD\n` +
      `⟠ ${allTimeEth.toFixed(6)} ETH\n` +
      `📊 ${allTimeCount} תשלומים\n\n` +
      `${changeEmoji} מגמה לעומת אתמול`;
    
    // Send to Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      }
    );
    
    const telegramResult = await telegramResponse.json();
    
    // Log the report
    await supabase.from('audit_logs').insert({
      job_id: '00000000-0000-0000-0000-000000000000',
      action: 'DAILY_REVENUE_REPORT',
      metadata: {
        date: todayStart.toISOString(),
        today_usd: todayUsd,
        today_eth: todayEth,
        today_count: todayCount,
        all_time_usd: allTimeUsd,
        all_time_eth: allTimeEth,
        all_time_count: allTimeCount,
      },
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        stats: {
          today: { usd: todayUsd, eth: todayEth, count: todayCount },
          allTime: { usd: allTimeUsd, eth: allTimeEth, count: allTimeCount },
        },
        telegram: telegramResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Daily report error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
