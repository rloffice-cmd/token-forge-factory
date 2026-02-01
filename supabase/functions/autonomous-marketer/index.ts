/**
 * Autonomous Marketer - Master Marketing Orchestrator
 * מנהל השיווק האוטונומי - מתאם את כל פעולות השיווק
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketingReport {
  reddit: { success: boolean; comments?: number; error?: string };
  twitter: { success: boolean; posts?: number; error?: string };
  discord: { success: boolean; replies?: number; error?: string };
  hackerNews: { success: boolean; leads?: number; error?: string };
  intentScanner: { success: boolean; signals?: number; error?: string };
  contentEngine: { success: boolean; content?: number; error?: string };
  outreach: { success: boolean; messages?: number; error?: string };
  leadHunter: { success: boolean; leads?: number; error?: string };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🚀 Starting Autonomous Marketing Cycle...');

    // Check brain settings
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('*')
      .eq('id', true)
      .single();

    if (!settings?.brain_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: 'brain_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const report: MarketingReport = {
      reddit: { success: false },
      twitter: { success: false },
      discord: { success: false },
      hackerNews: { success: false },
      intentScanner: { success: false },
      contentEngine: { success: false },
      outreach: { success: false },
      leadHunter: { success: false },
    };

    // 1. Run Intent Scanner - Find people asking questions
    console.log('📡 Running Intent Scanner...');
    try {
      const intentResult = await supabase.functions.invoke('ai-intent-scanner', {
        body: { mode: 'scan' },
      });
      report.intentScanner = {
        success: !intentResult.error,
        signals: intentResult.data?.signals_found || 0,
        error: intentResult.error?.message,
      };
    } catch (e) {
      report.intentScanner.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // 2. Run Lead Hunter - Find potential customers
    console.log('🎯 Running Lead Hunter...');
    try {
      const leadResult = await supabase.functions.invoke('lead-hunter', {
        body: { mode: 'hunt' },
      });
      report.leadHunter = {
        success: !leadResult.error,
        leads: leadResult.data?.leads_found || 0,
        error: leadResult.error?.message,
      };
    } catch (e) {
      report.leadHunter.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // 3. Run Content Engine - Generate content
    console.log('✍️ Running Content Engine...');
    try {
      const contentResult = await supabase.functions.invoke('ai-content-engine', {
        body: { mode: 'generate' },
      });
      report.contentEngine = {
        success: !contentResult.error,
        content: contentResult.data?.content_generated || 0,
        error: contentResult.error?.message,
      };
    } catch (e) {
      report.contentEngine.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // 4. Run Reddit Auto-Outreach
    console.log('🔴 Running Reddit Auto-Outreach...');
    try {
      const redditResult = await supabase.functions.invoke('reddit-auto-outreach', {
        body: {},
      });
      report.reddit = {
        success: !redditResult.error && redditResult.data?.success,
        comments: redditResult.data?.comments_posted || 0,
        error: redditResult.error?.message || redditResult.data?.reason,
      };
    } catch (e) {
      report.reddit.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // 5. Run Twitter Auto-Outreach
    console.log('🐦 Running Twitter Auto-Outreach...');
    try {
      const twitterResult = await supabase.functions.invoke('twitter-auto-outreach', {
        body: {},
      });
      report.twitter = {
        success: !twitterResult.error && twitterResult.data?.success,
        posts: twitterResult.data?.replies_posted || 0,
        error: twitterResult.error?.message || twitterResult.data?.reason,
      };
    } catch (e) {
      report.twitter.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // 6. Run Discord Auto-Outreach
    console.log('🎮 Running Discord Auto-Outreach...');
    try {
      const discordResult = await supabase.functions.invoke('discord-auto-outreach', {
        body: {},
      });
      report.discord = {
        success: !discordResult.error && discordResult.data?.success,
        replies: discordResult.data?.replies_sent || 0,
        error: discordResult.error?.message || discordResult.data?.reason,
      };
    } catch (e) {
      report.discord.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // 7. Run Hacker News Outreach
    console.log('📰 Running Hacker News Outreach...');
    try {
      const hnResult = await supabase.functions.invoke('hacker-news-outreach', {
        body: {},
      });
      report.hackerNews = {
        success: !hnResult.error && hnResult.data?.success,
        leads: hnResult.data?.leads_created || 0,
        error: hnResult.error?.message,
      };
    } catch (e) {
      report.hackerNews.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // 8. Process Outreach Queue - Send pending messages
    console.log('📧 Processing Outreach Queue...');
    try {
      const outreachResult = await supabase.functions.invoke('outreach-queue', {
        body: { mode: 'process' },
      });
      report.outreach = {
        success: !outreachResult.error,
        messages: outreachResult.data?.processed || 0,
        error: outreachResult.error?.message,
      };
    } catch (e) {
      report.outreach.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // Calculate totals
    const totalActions = 
      (report.reddit.comments || 0) +
      (report.twitter.posts || 0) +
      (report.discord.replies || 0) +
      (report.hackerNews.leads || 0) +
      (report.intentScanner.signals || 0) +
      (report.contentEngine.content || 0) +
      (report.outreach.messages || 0) +
      (report.leadHunter.leads || 0);

    const successfulChannels = Object.values(report).filter(r => r.success).length;

    // Log to audit
    const { data: validJob } = await supabase
      .from('jobs')
      .select('id')
      .limit(1)
      .single();

    if (validJob) {
      await supabase.from('audit_logs').insert({
        job_id: validJob.id,
        action: 'autonomous_marketing_cycle',
        metadata: {
          report,
          total_actions: totalActions,
          successful_channels: successfulChannels,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Send summary to Telegram (only if something happened)
    if (totalActions > 0) {
      const summaryLines = [
        '🤖 <b>מחזור שיווק אוטונומי הושלם</b>',
        '',
        `📊 סה"כ פעולות: <b>${totalActions}</b>`,
        `✅ ערוצים פעילים: <b>${successfulChannels}/6</b>`,
        '',
      ];

      if (report.reddit.comments) summaryLines.push(`🔴 Reddit: ${report.reddit.comments} תגובות`);
      if (report.twitter.posts) summaryLines.push(`🐦 Twitter: ${report.twitter.posts} ציוצים`);
      if (report.intentScanner.signals) summaryLines.push(`📡 סיגנלים: ${report.intentScanner.signals}`);
      if (report.leadHunter.leads) summaryLines.push(`🎯 לידים: ${report.leadHunter.leads}`);
      if (report.outreach.messages) summaryLines.push(`📧 Outreach: ${report.outreach.messages}`);
      if (report.contentEngine.content) summaryLines.push(`✍️ תוכן: ${report.contentEngine.content}`);

      // Add errors if any
      const errors = Object.entries(report)
        .filter(([_, r]) => r.error && 
          !r.error.includes('not_configured') && 
          r.error !== 'discord_not_configured' &&
          r.error !== 'twitter_not_configured' &&
          r.error !== 'reddit_not_configured')
        .map(([channel, r]) => `${channel}: ${r.error}`);

      if (errors.length > 0) {
        summaryLines.push('');
        summaryLines.push('⚠️ <b>שגיאות:</b>');
        errors.forEach(e => summaryLines.push(`  • ${e}`));
      }

      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: summaryLines.join('\n'),
          type: 'marketing_report',
        },
      });
    }

    console.log('✅ Autonomous Marketing Cycle Complete');
    console.log(`📊 Total actions: ${totalActions}, Successful channels: ${successfulChannels}/8`);

    return new Response(
      JSON.stringify({
        success: true,
        report,
        total_actions: totalActions,
        successful_channels: successfulChannels,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Autonomous marketer error:', error);
    
    // Notify about critical failure
    await supabase.functions.invoke('telegram-notify', {
      body: {
        message: `🚨 <b>כשל במנוע השיווק האוטונומי</b>\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
      },
    });
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
