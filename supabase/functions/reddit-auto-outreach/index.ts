/**
 * Reddit Auto-Outreach - Autonomous Reddit Comments & Posts
 * מערכת פרסום אוטונומית ברדיט - תגובות והצעות עזרה
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RedditToken {
  access_token: string;
  expires_at: number;
}

let cachedToken: RedditToken | null = null;

async function getRedditToken(): Promise<string> {
  const clientId = Deno.env.get('REDDIT_CLIENT_ID');
  const clientSecret = Deno.env.get('REDDIT_CLIENT_SECRET');
  const username = Deno.env.get('REDDIT_USERNAME');
  const password = Deno.env.get('REDDIT_PASSWORD');

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error('Reddit credentials not configured');
  }

  // Check cached token
  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token;
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'MicroGuardBot/1.0',
    },
    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });

  if (!response.ok) {
    throw new Error(`Reddit auth failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000) - 60000, // 1 min buffer
  };

  return cachedToken.access_token;
}

async function searchRedditPosts(token: string, query: string, subreddit?: string): Promise<any[]> {
  const baseUrl = subreddit 
    ? `https://oauth.reddit.com/r/${subreddit}/search`
    : 'https://oauth.reddit.com/search';

  const params = new URLSearchParams({
    q: query,
    sort: 'new',
    t: 'day', // Last 24 hours
    limit: '25',
    type: 'link',
  });

  if (subreddit) {
    params.set('restrict_sr', 'true');
  }

  const response = await fetch(`${baseUrl}?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'MicroGuardBot/1.0',
    },
  });

  if (!response.ok) {
    console.error(`Reddit search failed: ${response.status}`);
    return [];
  }

  const data = await response.json();
  return data.data?.children?.map((c: any) => c.data) || [];
}

async function postComment(token: string, postId: string, text: string): Promise<boolean> {
  const response = await fetch('https://oauth.reddit.com/api/comment', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'MicroGuardBot/1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `thing_id=t3_${postId}&text=${encodeURIComponent(text)}`,
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
    // Check if Reddit credentials are configured
    const redditClientId = Deno.env.get('REDDIT_CLIENT_ID');
    if (!redditClientId) {
      console.log('⚠️ Reddit credentials not configured - skipping');
      return new Response(
        JSON.stringify({ success: false, reason: 'reddit_not_configured' }),
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
      .eq('channel', 'reddit')
      .gte('created_at', `${today}T00:00:00Z`);

    if ((todayCount || 0) >= (settings.max_daily_outreach || 10)) {
      console.log(`🚫 Daily Reddit limit reached: ${todayCount}/${settings.max_daily_outreach}`);
      return new Response(
        JSON.stringify({ success: false, reason: 'daily_limit_reached', count: todayCount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = await getRedditToken();
    console.log('✅ Reddit authenticated');

    // Target subreddits for crypto/web3 security
    const targetSubreddits = [
      'ethereum', 'solidity', 'ethdev', 'cryptocurrency',
      'web3', 'defi', 'CryptoTechnology', 'solana',
      'NFT', 'CryptoCurrency', 'Bitcoin'
    ];

    const searchQueries = [
      'wallet security',
      'smart contract audit',
      'how to check if wallet is safe',
      'scam wallet',
      'rug pull detection',
      'contract vulnerability',
      'honeypot token',
      'is this wallet safe',
      'crypto security tool',
      'blockchain security',
    ];

    const postsFound: any[] = [];

    // Search for relevant posts
    for (const subreddit of targetSubreddits.slice(0, 3)) { // Limit to 3 subreddits per run
      for (const query of searchQueries.slice(0, 2)) { // Limit to 2 queries per subreddit
        try {
          const posts = await searchRedditPosts(token, query, subreddit);
          postsFound.push(...posts);
          await new Promise(r => setTimeout(r, 1000)); // Rate limit
        } catch (e) {
          console.error(`Search error for r/${subreddit}: ${e}`);
        }
      }
    }

    console.log(`📊 Found ${postsFound.length} potential posts`);

    // Filter for relevant posts we haven't commented on
    const { data: existingOutreach } = await supabase
      .from('outreach_queue')
      .select('source_url')
      .eq('channel', 'reddit');

    const existingUrls = new Set(existingOutreach?.map(o => o.source_url) || []);

    const newPosts = postsFound.filter(post => {
      const url = `https://reddit.com${post.permalink}`;
      return !existingUrls.has(url) && 
             post.num_comments < 50 && // Not too crowded
             post.score > 0 && // Has some engagement
             !post.locked && // Not locked
             !post.archived; // Not archived
    });

    console.log(`🎯 ${newPosts.length} new posts to engage with`);

    let commentsPosted = 0;
    const maxComments = Math.min(3, settings.max_daily_outreach - (todayCount || 0));

    for (const post of newPosts.slice(0, maxComments)) {
      // Generate helpful comment with AI
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Reddit Auto-Outreach',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are a helpful crypto/web3 security expert on Reddit. Write a genuinely helpful comment.

RULES:
1. Be HELPFUL first - actually answer their question or provide value
2. Keep it SHORT (2-4 sentences max)
3. Only mention our tool naturally if relevant (MicroGuard API for wallet/contract risk analysis)
4. NO spam vibes - sound like a real person
5. If the post isn't about security, just be helpful without mentioning our tool
6. Use casual Reddit tone

Our service (only mention if relevant): MicroGuard - free API to check wallet/contract risk scores at microguard.dev

Return JSON with:
- comment: The comment text
- should_post: boolean (false if post isn't relevant or we'd seem spammy)
- relevance: 0-100 score`,
            },
            {
              role: 'user',
              content: `Subreddit: r/${post.subreddit}
Title: ${post.title}
Content: ${(post.selftext || '').slice(0, 500)}
Score: ${post.score}
Comments: ${post.num_comments}`,
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

      if (!result.should_post || result.relevance < 50) {
        console.log(`⏭️ Skipping post (relevance: ${result.relevance}): ${post.title.slice(0, 50)}`);
        continue;
      }

      // Post the comment
      const success = await postComment(token, post.id, result.comment);

      if (success) {
        commentsPosted++;
        console.log(`✅ Posted comment on: ${post.title.slice(0, 50)}`);

        // Record in outreach queue
        await supabase.from('outreach_queue').insert({
          source_url: `https://reddit.com${post.permalink}`,
          channel: 'reddit',
          message_type: 'initial',
          message_content: result.comment,
          status: 'sent',
          scheduled_for: new Date().toISOString(),
        });

        // Also create/update lead
        await supabase.from('leads').upsert({
          source: 'reddit',
          source_type: 'reddit',
          source_url: `https://reddit.com${post.permalink}`,
          author: post.author,
          username: post.author,
          title: post.title,
          content: post.selftext?.slice(0, 1000),
          relevance_score: result.relevance,
          status: 'contacted',
          first_contact_at: new Date().toISOString(),
        }, { onConflict: 'source_url' });

        // Rate limit between comments
        await new Promise(r => setTimeout(r, 30000)); // 30 seconds between comments
      }
    }

    // Send summary to Telegram
    if (commentsPosted > 0) {
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `🤖 <b>Reddit Auto-Outreach</b>\n\n📝 פורסמו ${commentsPosted} תגובות חדשות\n📊 נסרקו ${postsFound.length} פוסטים\n🎯 נמצאו ${newPosts.length} רלוונטיים`,
          type: 'outreach_report',
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        posts_scanned: postsFound.length,
        posts_relevant: newPosts.length,
        comments_posted: commentsPosted,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Reddit auto-outreach error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
