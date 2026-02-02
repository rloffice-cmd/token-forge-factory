/**
 * Reddit Auto-Outreach - MASTER PROMPT Implementation
 * פרסום אוטומטי ברדיט עם סף 80+ בלבד
 * 
 * RULES:
 * - Auto-publish delay: 15-45 minutes random
 * - Style: Authentic user response
 * - Max 1 post per day on Reddit
 * - Score ≥80 = publish | <80 = archive
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { 
  SCORING, 
  LIMITS, 
  validateContent,
  getRandomDelay,
  detectBlockRisk 
} from "../_shared/master-prompt-config.ts";

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

  if (cachedToken && cachedToken.expires_at > Date.now()) {
    return cachedToken.access_token;
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'MicroGuardHelper/1.0',
    },
    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (detectBlockRisk(errorText)) {
      throw new Error('CRITICAL: Reddit block risk detected');
    }
    throw new Error(`Reddit auth failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in * 1000) - 60000,
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
    t: 'day',
    limit: '25',
    type: 'link',
  });

  if (subreddit) {
    params.set('restrict_sr', 'true');
  }

  const response = await fetch(`${baseUrl}?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'MicroGuardHelper/1.0',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (detectBlockRisk(errorText)) {
      throw new Error('CRITICAL: Reddit rate limit/block detected');
    }
    return [];
  }

  const data = await response.json();
  return data.data?.children?.map((c: any) => c.data) || [];
}

async function postComment(token: string, postId: string, text: string): Promise<boolean> {
  // Random human-like delay before posting
  const delay = getRandomDelay('reddit');
  console.log(`⏳ Human simulation delay: ${Math.round(delay / 1000)}s`);
  await new Promise(r => setTimeout(r, Math.min(delay, 30000))); // Cap at 30s for function timeout

  const response = await fetch('https://oauth.reddit.com/api/comment', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'MicroGuardHelper/1.0',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `thing_id=t3_${postId}&text=${encodeURIComponent(text)}`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (detectBlockRisk(errorText)) {
      throw new Error('CRITICAL: Reddit post blocked');
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
    // Check Reddit credentials
    const redditClientId = Deno.env.get('REDDIT_CLIENT_ID');
    if (!redditClientId) {
      return new Response(
        JSON.stringify({ success: false, reason: 'reddit_not_configured' }),
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

    // Check daily limit for Reddit specifically (max 1 per platform per day)
    const today = new Date().toISOString().slice(0, 10);
    const { count: todayRedditPosts } = await supabase
      .from('outreach_queue')
      .select('*', { count: 'exact', head: true })
      .eq('channel', 'reddit')
      .eq('status', 'sent')
      .gte('created_at', `${today}T00:00:00Z`);

    if ((todayRedditPosts || 0) >= LIMITS.MAX_POSTS_PER_PLATFORM_PER_DAY) {
      console.log(`🛑 Reddit daily limit reached: ${todayRedditPosts}/1`);
      return new Response(
        JSON.stringify({ success: false, reason: 'reddit_daily_limit' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 72-hour deduplication
    const dedupCutoff = new Date(Date.now() - LIMITS.DEDUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { data: existingOutreach } = await supabase
      .from('outreach_queue')
      .select('source_url')
      .eq('channel', 'reddit')
      .gte('created_at', dedupCutoff);

    const existingUrls = new Set(existingOutreach?.map(o => o.source_url) || []);

    const token = await getRedditToken();
    console.log('✅ Reddit authenticated');

    // Target subreddits
    const targetSubreddits = ['ethereum', 'ethdev', 'defi', 'CryptoTechnology', 'solidity'];
    const searchQueries = ['wallet security', 'smart contract audit', 'is this safe', 'scam detection'];

    const postsFound: any[] = [];

    for (const subreddit of targetSubreddits.slice(0, 2)) {
      for (const query of searchQueries.slice(0, 2)) {
        try {
          const posts = await searchRedditPosts(token, query, subreddit);
          postsFound.push(...posts);
          await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
          if (detectBlockRisk(e instanceof Error ? e.message : '')) {
            throw e; // Re-throw critical errors
          }
        }
      }
    }

    console.log(`📊 Found ${postsFound.length} posts`);

    // Filter for new, relevant posts
    const newPosts = postsFound.filter(post => {
      const url = `https://reddit.com${post.permalink}`;
      return !existingUrls.has(url) && 
             post.num_comments < 50 &&
             post.score > 0 &&
             !post.locked &&
             !post.archived;
    });

    console.log(`🎯 ${newPosts.length} new posts to evaluate`);

    let commentsPosted = 0;

    for (const post of newPosts.slice(0, 3)) {
      // AI scoring with STRICT 80+ threshold
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Reddit Master Scorer',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You are a STRICT scorer for Reddit comments. Return ONLY if score ≥${SCORING.AUTO_PUBLISH_THRESHOLD}.

SCORING (0-100):
- Relevance to crypto/wallet security: 25%
- Pain intensity: 25%
- Response likelihood: 20%
- Credibility: 15%
- Spam risk (lower = better): 15%

FORBIDDEN in comment:
- Direct sales pitch or CTA
- Links (never include links)
- Mentioning "AI", "bot", "automated"
- Marketing language, exclamation marks
- Generic "check out X" statements

REQUIRED:
- Genuine helpfulness as a real user
- Share insight or experience
- Casual Reddit tone
- Max 200 characters

Return JSON:
{ "score": number, "comment": string, "should_post": boolean }

If score <${SCORING.AUTO_PUBLISH_THRESHOLD}, return: { "score": X, "should_post": false }`,
            },
            {
              role: 'user',
              content: `Subreddit: r/${post.subreddit}\nTitle: ${post.title}\nContent: ${(post.selftext || '').slice(0, 300)}`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResponse.ok) continue;

      const aiData = await aiResponse.json();
      const result = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');

      // STRICT threshold check
      if (!result.should_post || result.score < SCORING.AUTO_PUBLISH_THRESHOLD) {
        console.log(`❌ Archived (score: ${result.score}): ${post.title.slice(0, 40)}`);
        continue;
      }

      // Validate content with guardrails
      const validation = validateContent(result.comment || '');
      if (!validation.valid) {
        console.log(`🛡️ Guardrail blocked: ${validation.reason}`);
        continue;
      }

      // Post the comment (with human simulation delay built in)
      const success = await postComment(token, post.id, result.comment);

      if (success) {
        commentsPosted++;
        console.log(`✅ Posted (score: ${result.score}): ${post.title.slice(0, 40)}`);

        await supabase.from('outreach_queue').insert({
          source_url: `https://reddit.com${post.permalink}`,
          channel: 'reddit',
          message_type: 'initial',
          message_content: result.comment,
          status: 'sent',
          scheduled_for: new Date().toISOString(),
        });

        await supabase.from('leads').upsert({
          source: 'reddit',
          source_type: 'reddit',
          source_url: `https://reddit.com${post.permalink}`,
          author: post.author,
          username: post.author,
          title: post.title,
          content: post.selftext?.slice(0, 1000),
          relevance_score: result.score,
          status: 'contacted',
          first_contact_at: new Date().toISOString(),
        }, { onConflict: 'source_url' });

        // Only 1 per platform per day
        break;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        posts_scanned: postsFound.length,
        posts_new: newPosts.length,
        comments_posted: commentsPosted,
        threshold: SCORING.AUTO_PUBLISH_THRESHOLD,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Reddit outreach error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Alert on critical/block errors
    if (detectBlockRisk(errorMsg) || errorMsg.includes('CRITICAL')) {
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `🚨 <b>Reddit Block Risk</b>\n\n${errorMsg}\n\nOutreach paused.`,
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
