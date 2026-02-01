/**
 * Hacker News Auto-Outreach - Monitor & Engage
 * מערכת פרסום אוטונומית ב-Hacker News - ניטור ומעורבות
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HNItem {
  id: number;
  title?: string;
  text?: string;
  by: string;
  time: number;
  type: string;
  url?: string;
  descendants?: number;
  score?: number;
}

async function searchHN(query: string): Promise<any[]> {
  const params = new URLSearchParams({
    query,
    tags: 'story',
    numericFilters: 'created_at_i>=' + Math.floor(Date.now() / 1000 - 86400), // Last 24h
    hitsPerPage: '20',
  });

  const response = await fetch(`https://hn.algolia.com/api/v1/search?${params}`);
  if (!response.ok) return [];

  const data = await response.json();
  return data.hits || [];
}

async function getHNItem(id: number): Promise<HNItem | null> {
  const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
  if (!response.ok) return null;
  return await response.json();
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

    console.log('📰 Scanning Hacker News...');

    // Search queries for relevant HN posts
    const searchQueries = [
      'wallet security',
      'smart contract audit',
      'blockchain security',
      'crypto scam',
      'defi hack',
      'web3 security',
      'ethereum security',
      'solidity vulnerability',
    ];

    const postsFound: any[] = [];

    for (const query of searchQueries) {
      try {
        const results = await searchHN(query);
        postsFound.push(...results);
        await new Promise(r => setTimeout(r, 500)); // Rate limit
      } catch (e) {
        console.error(`HN search error: ${e}`);
      }
    }

    // Deduplicate
    const uniquePosts = Array.from(
      new Map(postsFound.map(p => [p.objectID, p])).values()
    );

    console.log(`📊 Found ${uniquePosts.length} HN posts`);

    // Filter for posts we haven't engaged with
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('source_url')
      .eq('source', 'hackernews');

    const existingUrls = new Set(existingLeads?.map(l => l.source_url) || []);

    const newPosts = uniquePosts.filter(post => {
      const url = `https://news.ycombinator.com/item?id=${post.objectID}`;
      return !existingUrls.has(url) && (post.num_comments || 0) < 100;
    });

    console.log(`🎯 ${newPosts.length} new HN posts to track`);

    let leadsCreated = 0;
    let outreachQueued = 0;

    for (const post of newPosts.slice(0, 10)) {
      // Analyze relevance with AI
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'HN Analyzer',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `Analyze this Hacker News post for relevance to crypto/web3 security tools.

Our service: MicroGuard API - wallet and smart contract risk analysis

Return JSON with:
- relevance: 0-100 (how relevant to our service)
- intent_score: 0-100 (likelihood they need a tool like ours)
- pain_points: array of identified pain points
- suggested_approach: brief strategy for engagement
- suggested_comment: a helpful comment (if relevance > 60)
- should_engage: boolean`,
            },
            {
              role: 'user',
              content: `Title: ${post.title}
URL: ${post.url || 'self-post'}
Points: ${post.points}
Comments: ${post.num_comments}`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResponse.ok) continue;

      const aiData = await aiResponse.json();
      const analysis = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');

      if (analysis.relevance < 40) continue;

      // Create lead
      const hnUrl = `https://news.ycombinator.com/item?id=${post.objectID}`;
      
      await supabase.from('leads').insert({
        source: 'hackernews',
        source_type: 'hackernews',
        source_url: hnUrl,
        source_id: post.objectID.toString(),
        title: post.title,
        author: post.author,
        username: post.author,
        relevance_score: analysis.relevance,
        intent_score: analysis.intent_score,
        pain_points: analysis.pain_points || [],
        content: post.url || '',
        status: 'new',
      });

      leadsCreated++;

      // Queue outreach if highly relevant
      if (analysis.should_engage && analysis.suggested_comment) {
        await supabase.from('outreach_queue').insert({
          source_url: hnUrl,
          channel: 'hackernews',
          message_type: 'initial',
          message_content: analysis.suggested_comment,
          status: 'queued',
          persona: 'expert',
          scheduled_for: new Date().toISOString(),
        });
        outreachQueued++;
      }
    }

    // Note: HN doesn't have an API for posting comments
    // The queued messages are for manual posting or future automation
    
    console.log(`✅ HN Outreach: ${leadsCreated} leads, ${outreachQueued} outreach queued`);

    // Send summary to Telegram if any activity
    if (leadsCreated > 0) {
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `📰 <b>Hacker News Scan</b>\n\n🎯 לידים חדשים: ${leadsCreated}\n📝 הודעות בתור: ${outreachQueued}\n\nהודעות HN דורשות פרסום ידני (אין API לפרסום)`,
          type: 'lead_alert',
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        posts_scanned: uniquePosts.length,
        leads_created: leadsCreated,
        outreach_queued: outreachQueued,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('HN outreach error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
