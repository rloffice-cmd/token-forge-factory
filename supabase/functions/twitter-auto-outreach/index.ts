/**
 * Twitter/X Auto-Outreach - MASTER PROMPT Implementation
 * פרסום אוטומטי בטוויטר עם סף 80+ בלבד
 * 
 * RULES:
 * - Auto-publish with human simulation
 * - Max 1 post per day on Twitter
 * - Score ≥80 = publish | <80 = archive
 * - Value-first, no marketing language
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { 
  SCORING, 
  LIMITS, 
  validateContent,
  detectBlockRisk 
} from "../_shared/master-prompt-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function searchTweets(query: string, bearerToken: string): Promise<any[]> {
  const params = new URLSearchParams({
    query: `${query} -is:retweet lang:en`,
    max_results: '10',
    'tweet.fields': 'author_id,conversation_id,created_at,public_metrics',
    'user.fields': 'username,name',
    expansions: 'author_id',
  });

  const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: { 'Authorization': `Bearer ${bearerToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (detectBlockRisk(errorText)) {
      throw new Error('CRITICAL: Twitter rate limit/block detected');
    }
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

async function postTweet(text: string, bearerToken: string, replyToId?: string): Promise<boolean> {
  const body: any = { text };
  if (replyToId) {
    body.reply = { in_reply_to_tweet_id: replyToId };
  }

  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (detectBlockRisk(errorText)) {
      throw new Error('CRITICAL: Twitter post blocked');
    }
  }

  return response.ok;
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
    const twitterBearerToken = Deno.env.get('TWITTER_BEARER_TOKEN');
    if (!twitterBearerToken) {
      return new Response(
        JSON.stringify({ success: false, reason: 'twitter_not_configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check brain settings
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('brain_enabled, outreach_enabled')
      .eq('id', true)
      .single();

    if (!settings?.brain_enabled || !settings?.outreach_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: 'outreach_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check daily limit for Twitter (max 1 per platform per day)
    const today = new Date().toISOString().slice(0, 10);
    const { count: todayTwitterPosts } = await supabase
      .from('outreach_queue')
      .select('*', { count: 'exact', head: true })
      .eq('channel', 'twitter')
      .eq('status', 'sent')
      .gte('created_at', `${today}T00:00:00Z`);

    if ((todayTwitterPosts || 0) >= LIMITS.MAX_POSTS_PER_PLATFORM_PER_DAY) {
      console.log(`🛑 Twitter daily limit reached: ${todayTwitterPosts}/1`);
      return new Response(
        JSON.stringify({ success: false, reason: 'twitter_daily_limit' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 72-hour deduplication
    const dedupCutoff = new Date(Date.now() - LIMITS.DEDUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: existingOutreach } = await supabase
      .from('outreach_queue')
      .select('source_url')
      .eq('channel', 'twitter')
      .gte('created_at', dedupCutoff);

    const existingUrls = new Set(existingOutreach?.map(o => o.source_url) || []);

    console.log('✅ Twitter API configured');

    // Search queries
    const searchQueries = [
      'wallet got hacked help',
      'is this token safe',
      'smart contract security',
      'rug pull warning',
    ];

    const tweetsFound: any[] = [];

    for (const query of searchQueries.slice(0, 2)) {
      try {
        const tweets = await searchTweets(query, twitterBearerToken);
        tweetsFound.push(...tweets);
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        if (detectBlockRisk(e instanceof Error ? e.message : '')) {
          throw e;
        }
      }
    }

    console.log(`📊 Found ${tweetsFound.length} tweets`);

    // Filter new tweets
    const newTweets = tweetsFound.filter(tweet => {
      const url = `https://twitter.com/i/status/${tweet.id}`;
      return !existingUrls.has(url);
    });

    console.log(`🎯 ${newTweets.length} new tweets to evaluate`);

    let repliesPosted = 0;

    for (const tweet of newTweets.slice(0, 3)) {
      // AI scoring with STRICT 80+ threshold
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Twitter Master Scorer',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are a STRICT scorer for Twitter replies. Return ONLY if score ≥${SCORING.AUTO_PUBLISH_THRESHOLD}.

SCORING (0-100):
- Relevance to crypto/wallet security: 25%
- Pain intensity: 25%
- Response likelihood: 20%
- Credibility: 15%
- Spam risk (lower = better): 15%

FORBIDDEN in reply:
- Direct sales pitch or CTA
- Links (never include links)
- Mentioning "AI", "bot", "automated"
- Marketing language
- More than 1 emoji

REQUIRED:
- Genuine helpfulness
- Under 280 characters
- Casual Twitter tone
- Value-first

Return JSON:
{ "score": number, "reply": string, "should_reply": boolean }

If score <${SCORING.AUTO_PUBLISH_THRESHOLD}, return: { "score": X, "should_reply": false }`,
            },
            {
              role: 'user',
              content: `Tweet: ${tweet.text}`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResponse.ok) continue;

      const aiData = await aiResponse.json();
      const result = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');

      // STRICT threshold check
      if (!result.should_reply || result.score < SCORING.AUTO_PUBLISH_THRESHOLD) {
        console.log(`❌ Archived (score: ${result.score})`);
        continue;
      }

      // Validate with guardrails
      const validation = validateContent(result.reply || '');
      if (!validation.valid) {
        console.log(`🛡️ Guardrail blocked: ${validation.reason}`);
        continue;
      }

      // Post reply
      const success = await postTweet(result.reply, twitterBearerToken, tweet.id);

      if (success) {
        repliesPosted++;
        console.log(`✅ Posted reply (score: ${result.score})`);

        await supabase.from('outreach_queue').insert({
          source_url: `https://twitter.com/i/status/${tweet.id}`,
          channel: 'twitter',
          message_type: 'initial',
          message_content: result.reply,
          status: 'sent',
          scheduled_for: new Date().toISOString(),
        });

        // Only 1 per platform per day
        break;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        tweets_scanned: tweetsFound.length,
        tweets_new: newTweets.length,
        replies_posted: repliesPosted,
        threshold: SCORING.AUTO_PUBLISH_THRESHOLD,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Twitter outreach error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    if (detectBlockRisk(errorMsg) || errorMsg.includes('CRITICAL')) {
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `🚨 <b>Twitter Block Risk</b>\n\n${errorMsg}\n\nOutreach paused.`,
          type: 'error',
        },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
