/**
 * Twitter/X Auto-Outreach - Autonomous Tweets & Replies
 * מערכת פרסום אוטונומית בטוויטר - ציוצים ותגובות
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Twitter OAuth 1.0a signature generation
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): string {
  const sortedParams = Object.keys(params).sort().map(k => `${k}=${encodeURIComponent(params[k])}`).join('&');
  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  
  // HMAC-SHA1 implementation for Deno
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const messageData = encoder.encode(signatureBase);
  
  return btoa(String.fromCharCode(...new Uint8Array(32))); // Placeholder - needs crypto import
}

function generateOAuthHeader(
  method: string,
  url: string,
  params: Record<string, string> = {}
): string {
  const consumerKey = Deno.env.get('TWITTER_CONSUMER_KEY')!;
  const consumerSecret = Deno.env.get('TWITTER_CONSUMER_SECRET')!;
  const accessToken = Deno.env.get('TWITTER_ACCESS_TOKEN')!;
  const accessTokenSecret = Deno.env.get('TWITTER_ACCESS_TOKEN_SECRET')!;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...params };
  oauthParams.oauth_signature = generateOAuthSignature(method, url, allParams, consumerSecret, accessTokenSecret);

  const headerParts = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerParts}`;
}

async function searchTweets(query: string): Promise<any[]> {
  const bearerToken = Deno.env.get('TWITTER_BEARER_TOKEN');
  if (!bearerToken) return [];

  const params = new URLSearchParams({
    query: `${query} -is:retweet lang:en`,
    max_results: '10',
    'tweet.fields': 'author_id,conversation_id,created_at,public_metrics',
    'user.fields': 'username,name',
    expansions: 'author_id',
  });

  const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?${params}`, {
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
    },
  });

  if (!response.ok) {
    console.error(`Twitter search failed: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.data || [];
}

async function postTweet(text: string, replyToId?: string): Promise<boolean> {
  const bearerToken = Deno.env.get('TWITTER_BEARER_TOKEN');
  if (!bearerToken) return false;

  // Twitter API v2 requires OAuth 2.0 with user context for posting
  // This is a simplified version - full implementation needs OAuth 2.0 PKCE flow
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
    // Check if Twitter credentials are configured
    const twitterBearerToken = Deno.env.get('TWITTER_BEARER_TOKEN');
    if (!twitterBearerToken) {
      console.log('⚠️ Twitter credentials not configured - skipping');
      return new Response(
        JSON.stringify({ success: false, reason: 'twitter_not_configured' }),
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
      .eq('channel', 'twitter')
      .gte('created_at', `${today}T00:00:00Z`);

    if ((todayCount || 0) >= (settings.max_daily_outreach || 10)) {
      console.log(`🚫 Daily Twitter limit reached: ${todayCount}/${settings.max_daily_outreach}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'daily_limit_reached', count: todayCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Twitter API configured');

    // Search queries for crypto security topics
    const searchQueries = [
      'wallet got hacked help',
      'is this token safe',
      'smart contract security',
      'crypto scam detection',
      'rug pull warning',
      'need wallet security tool',
      'how to check contract',
      'honeypot token detection',
    ];

    const tweetsFound: any[] = [];

    for (const query of searchQueries.slice(0, 3)) {
      try {
        const tweets = await searchTweets(query);
        tweetsFound.push(...tweets);
        await new Promise(r => setTimeout(r, 2000)); // Rate limit
      } catch (e) {
        console.error(`Search error: ${e}`);
      }
    }

    console.log(`📊 Found ${tweetsFound.length} potential tweets`);

    // Filter for tweets we haven't replied to
    const { data: existingOutreach } = await supabase
      .from('outreach_queue')
      .select('source_url')
      .eq('channel', 'twitter');

    const existingUrls = new Set(existingOutreach?.map(o => o.source_url) || []);

    const newTweets = tweetsFound.filter(tweet => {
      const url = `https://twitter.com/i/status/${tweet.id}`;
      return !existingUrls.has(url);
    });

    console.log(`🎯 ${newTweets.length} new tweets to engage with`);

    let repliesPosted = 0;
    const maxReplies = Math.min(3, settings.max_daily_outreach - (todayCount || 0));

    for (const tweet of newTweets.slice(0, maxReplies)) {
      // Generate helpful reply with AI
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Twitter Auto-Outreach',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are a helpful crypto/web3 security expert on Twitter. Write a helpful reply.

RULES:
1. Be HELPFUL - provide real value
2. Keep it SHORT (under 280 characters!)
3. Only mention our tool if directly relevant
4. NO spam vibes - be genuine
5. Use casual Twitter tone with emojis when appropriate

Our service (only mention if relevant): MicroGuard API - free wallet/contract risk checks at microguard.dev

Return JSON with:
- reply: The reply text (max 280 chars)
- should_reply: boolean (false if not relevant)
- relevance: 0-100 score`,
            },
            {
              role: 'user',
              content: `Tweet: ${tweet.text}`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResponse.ok) {
        console.error('AI generation failed');
        continue;
      }

      const aiData = await aiResponse.json();
      const result = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');

      if (!result.should_reply || result.relevance < 50) {
        console.log(`⏭️ Skipping tweet (relevance: ${result.relevance})`);
        continue;
      }

      // Post the reply
      const success = await postTweet(result.reply, tweet.id);

      if (success) {
        repliesPosted++;
        console.log(`✅ Posted reply to tweet: ${tweet.text.slice(0, 50)}`);

        // Record in outreach queue
        await supabase.from('outreach_queue').insert({
          source_url: `https://twitter.com/i/status/${tweet.id}`,
          channel: 'twitter',
          message_type: 'initial',
          message_content: result.reply,
          status: 'sent',
          scheduled_for: new Date().toISOString(),
        });

        // Rate limit between replies
        await new Promise(r => setTimeout(r, 60000)); // 60 seconds between replies
      }
    }

    // Also generate and post original content occasionally
    const shouldPostOriginal = Math.random() < 0.3; // 30% chance each run

    if (shouldPostOriginal && repliesPosted < maxReplies) {
      const contentResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Twitter Content Generator',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `Generate a helpful crypto/web3 security tweet (educational content).

RULES:
1. Educational value - teach something useful
2. Under 280 characters
3. Include relevant hashtags (1-2 max)
4. Soft CTA to microguard.dev only 20% of the time
5. Focus on security tips, red flags, best practices

Return JSON with: tweet (the text)`,
            },
            {
              role: 'user',
              content: 'Generate a helpful security tweet for the crypto community.',
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        const content = JSON.parse(contentData.choices?.[0]?.message?.content || '{}');

        if (content.tweet) {
          const posted = await postTweet(content.tweet);
          if (posted) {
            console.log(`✅ Posted original tweet: ${content.tweet.slice(0, 50)}`);
            repliesPosted++;
          }
        }
      }
    }

    // Send summary to Telegram
    if (repliesPosted > 0) {
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `🐦 <b>Twitter Auto-Outreach</b>\n\n📝 פורסמו ${repliesPosted} תגובות/ציוצים\n📊 נסרקו ${tweetsFound.length} ציוצים\n🎯 נמצאו ${newTweets.length} רלוונטיים`,
          type: 'outreach_report',
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        tweets_scanned: tweetsFound.length,
        tweets_relevant: newTweets.length,
        replies_posted: repliesPosted,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Twitter auto-outreach error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
