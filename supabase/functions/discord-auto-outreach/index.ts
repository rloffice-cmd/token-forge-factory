/**
 * Discord Auto-Outreach - Monitor & Engage in Discord Servers
 * מערכת פרסום אוטונומית בדיסקורד - ניטור ומעורבות בשרתים
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string };
  channel_id: string;
  guild_id?: string;
  timestamp: string;
}

async function discordRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
  if (!botToken) throw new Error('Discord bot token not configured');

  const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function searchMessages(channelId: string, limit = 50): Promise<DiscordMessage[]> {
  return await discordRequest(`/channels/${channelId}/messages?limit=${limit}`);
}

async function sendMessage(channelId: string, content: string): Promise<any> {
  return await discordRequest(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check if Discord is configured
    const discordToken = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!discordToken) {
      console.log('⚠️ Discord bot not configured - skipping');
      return new Response(
        JSON.stringify({ success: false, reason: 'discord_not_configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check brain settings
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('brain_enabled, outreach_enabled, max_daily_outreach')
      .eq('id', true)
      .single();

    if (!settings?.brain_enabled || !settings?.outreach_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: 'outreach_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check daily limit
    const today = new Date().toISOString().slice(0, 10);
    const { count: todayCount } = await supabase
      .from('outreach_queue')
      .select('*', { count: 'exact', head: true })
      .eq('channel', 'discord')
      .gte('created_at', `${today}T00:00:00Z`);

    if ((todayCount || 0) >= (settings.max_daily_outreach || 10)) {
      console.log(`🚫 Daily Discord limit reached: ${todayCount}/${settings.max_daily_outreach}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'daily_limit_reached', count: todayCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🎮 Discord Auto-Outreach starting...');

    // Get channel IDs to monitor from engine_config
    const { data: config } = await supabase
      .from('engine_config')
      .select('config_value')
      .eq('config_key', 'discord_channels')
      .single();

    const channelIds: string[] = (config?.config_value as any)?.channels || [];

    if (channelIds.length === 0) {
      console.log('⚠️ No Discord channels configured to monitor');
      return new Response(
        JSON.stringify({ success: false, reason: 'no_channels_configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let messagesFound = 0;
    let leadsCreated = 0;
    let repliesSent = 0;

    for (const channelId of channelIds) {
      try {
        const messages = await searchMessages(channelId, 30);
        messagesFound += messages.length;

        // Filter for security-related questions
        const securityKeywords = [
          'wallet', 'security', 'scam', 'hack', 'safe', 'risk',
          'audit', 'contract', 'honeypot', 'rug', 'verify'
        ];

        const relevantMessages = messages.filter(msg => {
          const content = msg.content.toLowerCase();
          return securityKeywords.some(kw => content.includes(kw)) &&
                 content.includes('?'); // Likely a question
        });

        // Check which messages we haven't responded to
        const { data: existingOutreach } = await supabase
          .from('outreach_queue')
          .select('source_url')
          .eq('channel', 'discord');

        const existingIds = new Set(
          existingOutreach?.map(o => o.source_url.split('/').pop()) || []
        );

        const newMessages = relevantMessages.filter(m => !existingIds.has(m.id));

        for (const msg of newMessages.slice(0, 2)) { // Max 2 per channel
          // Generate helpful response with AI
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
              'X-Title': 'Discord Auto-Outreach',
            },
            body: JSON.stringify({
              model: 'google/gemini-3-flash-preview',
              messages: [
                {
                  role: 'system',
                  content: `You're a helpful crypto security expert in a Discord server. Write a helpful response.

RULES:
1. Be GENUINELY helpful - answer their question
2. Keep it casual and friendly (Discord tone)
3. Only mention our tool if directly relevant to their question
4. Use emojis appropriately
5. Max 2-3 sentences

Our service (mention only if relevant): MicroGuard API for wallet/contract risk checks - free tier at microguard.dev

Return JSON with:
- reply: The response text
- should_reply: boolean
- relevance: 0-100`,
                },
                {
                  role: 'user',
                  content: `User question: "${msg.content}"
User: ${msg.author.username}`,
                },
              ],
              response_format: { type: 'json_object' },
            }),
          });

          if (!aiResponse.ok) continue;

          const aiData = await aiResponse.json();
          const result = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');

          if (!result.should_reply || result.relevance < 50) continue;

          // Send reply
          try {
            await sendMessage(msg.channel_id, result.reply);
            repliesSent++;
            console.log(`✅ Discord reply sent: ${result.reply.slice(0, 50)}...`);

            // Record outreach
            await supabase.from('outreach_queue').insert({
              source_url: `discord://channel/${msg.channel_id}/${msg.id}`,
              channel: 'discord',
              message_type: 'initial',
              message_content: result.reply,
              status: 'sent',
              scheduled_for: new Date().toISOString(),
            });

            // Create lead
            await supabase.from('leads').upsert({
              source: 'discord',
              source_type: 'discord',
              source_url: `discord://channel/${msg.channel_id}/${msg.id}`,
              username: msg.author.username,
              author: msg.author.username,
              content: msg.content,
              relevance_score: result.relevance,
              status: 'contacted',
              first_contact_at: new Date().toISOString(),
            }, { onConflict: 'source_url' });

            leadsCreated++;

            // Rate limit between messages
            await new Promise(r => setTimeout(r, 5000));
          } catch (e) {
            console.error(`Failed to send Discord message: ${e}`);
          }
        }

        await new Promise(r => setTimeout(r, 2000)); // Rate limit between channels
      } catch (e) {
        console.error(`Error processing channel ${channelId}: ${e}`);
      }
    }

    // Send summary to Telegram
    if (repliesSent > 0) {
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `🎮 <b>Discord Auto-Outreach</b>\n\n📝 נשלחו ${repliesSent} תגובות\n🎯 לידים חדשים: ${leadsCreated}\n📊 נסרקו ${messagesFound} הודעות`,
          type: 'outreach_report',
        },
      });
    }

    console.log(`✅ Discord outreach complete: ${repliesSent} replies, ${leadsCreated} leads`);

    return new Response(
      JSON.stringify({
        success: true,
        messages_scanned: messagesFound,
        leads_created: leadsCreated,
        replies_sent: repliesSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Discord auto-outreach error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
