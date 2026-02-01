/**
 * Full Autonomous Marketing Engine - NO EXTERNAL API KEYS REQUIRED
 * מנוע שיווק אוטונומי מלא - עובד עם APIs ציבוריים בלבד
 * 
 * This engine runs 24/7 without any external credentials:
 * 1. Scans public APIs (HN Algolia, Reddit RSS, Dev.to RSS, Stack Exchange)
 * 2. Analyzes intent with Lovable AI
 * 3. Generates content and responses
 * 4. Queues everything for review
 * 5. Sends comprehensive Telegram reports
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =====================================================
// PUBLIC API SOURCES - NO AUTH REQUIRED
// =====================================================

const PUBLIC_SOURCES = {
  // Hacker News Algolia API - completely public
  hackerNews: [
    { name: 'HN Wallet Security', url: 'https://hn.algolia.com/api/v1/search_by_date?query=wallet%20security&tags=story,comment&hitsPerPage=30' },
    { name: 'HN Smart Contract', url: 'https://hn.algolia.com/api/v1/search_by_date?query=smart%20contract%20audit&tags=story,comment&hitsPerPage=30' },
    { name: 'HN Crypto Scam', url: 'https://hn.algolia.com/api/v1/search_by_date?query=crypto%20scam%20detection&tags=story,comment&hitsPerPage=20' },
    { name: 'HN Web3 Security', url: 'https://hn.algolia.com/api/v1/search_by_date?query=web3%20security&tags=story,comment&hitsPerPage=30' },
    { name: 'HN DeFi Hack', url: 'https://hn.algolia.com/api/v1/search_by_date?query=defi%20hack%20OR%20rug%20pull&tags=story,comment&hitsPerPage=20' },
  ],
  
  // Reddit RSS - public feeds (read-only)
  redditRSS: [
    { name: 'r/ethdev', url: 'https://www.reddit.com/r/ethdev/new/.rss?limit=25' },
    { name: 'r/ethereum', url: 'https://www.reddit.com/r/ethereum/new/.rss?limit=25' },
    { name: 'r/defi', url: 'https://www.reddit.com/r/defi/new/.rss?limit=25' },
    { name: 'r/CryptoTechnology', url: 'https://www.reddit.com/r/CryptoTechnology/new/.rss?limit=25' },
    { name: 'r/solidity', url: 'https://www.reddit.com/r/solidity/new/.rss?limit=20' },
  ],
  
  // Dev.to RSS - public feeds
  devTo: [
    { name: 'Dev.to Web3', url: 'https://dev.to/feed/tag/web3' },
    { name: 'Dev.to Blockchain', url: 'https://dev.to/feed/tag/blockchain' },
    { name: 'Dev.to Ethereum', url: 'https://dev.to/feed/tag/ethereum' },
    { name: 'Dev.to Security', url: 'https://dev.to/feed/tag/security' },
  ],
  
  // Stack Exchange API - public (rate limited but works)
  stackExchange: [
    { name: 'SO Ethereum', url: 'https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&tagged=ethereum&site=stackoverflow&pagesize=20&filter=withbody' },
    { name: 'SO Solidity', url: 'https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&tagged=solidity&site=stackoverflow&pagesize=20&filter=withbody' },
    { name: 'Ethereum SE', url: 'https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&site=ethereum&pagesize=25&filter=withbody' },
  ],
};

interface DiscoveredLead {
  source: string;
  platform: string;
  url: string;
  title: string;
  content: string;
  author?: string;
  intent_score: number;
  pain_points: string[];
  product_fit: string[];
  suggested_response?: string;
}

interface EngineStats {
  sources_scanned: number;
  items_analyzed: number;
  leads_discovered: number;
  high_intent_leads: number;
  content_generated: number;
  outreach_queued: number;
  errors: string[];
}

// Parse RSS/Atom feed (simple XML parsing)
function parseRSSItems(xml: string): Array<{title: string, link: string, description: string, author?: string}> {
  const items: Array<{title: string, link: string, description: string, author?: string}> = [];
  
  // Extract items using regex (lightweight, no XML parser needed)
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  const entryRegex = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  
  const matches = [...xml.matchAll(itemRegex), ...xml.matchAll(entryRegex)];
  
  for (const match of matches.slice(0, 20)) {
    const itemXml = match[1];
    
    const title = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() || '';
    const link = itemXml.match(/<link[^>]*href="([^"]*)"[^>]*\/?>/i)?.[1] || 
                 itemXml.match(/<link[^>]*>([^<]*)<\/link>/i)?.[1]?.trim() || '';
    const description = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() ||
                       itemXml.match(/<content[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content>/i)?.[1]?.trim() || '';
    const author = itemXml.match(/<dc:creator[^>]*>([^<]*)<\/dc:creator>/i)?.[1]?.trim() ||
                  itemXml.match(/<author[^>]*>([^<]*)<\/author>/i)?.[1]?.trim() || '';
    
    if (title || description) {
      items.push({ title, link, description: description.slice(0, 1000), author });
    }
  }
  
  return items;
}

// Fetch with timeout and retry
async function fetchWithRetry(url: string, retries = 2): Promise<Response | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MicroGuard-Bot/1.0 (Autonomous Security Scanner)',
          'Accept': 'application/json, application/rss+xml, application/xml, text/xml, */*',
        },
      });
      
      clearTimeout(timeout);
      
      if (response.ok) return response;
    } catch (e) {
      if (i === retries) return null;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  const stats: EngineStats = {
    sources_scanned: 0,
    items_analyzed: 0,
    leads_discovered: 0,
    high_intent_leads: 0,
    content_generated: 0,
    outreach_queued: 0,
    errors: [],
  };

  const discoveredLeads: DiscoveredLead[] = [];

  try {
    console.log('🚀 Full Autonomous Engine starting...');

    // Check if brain is enabled
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('brain_enabled, outreach_enabled, max_daily_outreach')
      .eq('id', true)
      .single();

    if (!settings?.brain_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: 'brain_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check daily outreach limit
    const today = new Date().toISOString().slice(0, 10);
    const { count: todayOutreach } = await supabase
      .from('outreach_queue')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00Z`);

    const dailyLimit = settings.max_daily_outreach || 50;
    const remainingOutreach = Math.max(0, dailyLimit - (todayOutreach || 0));

    console.log(`📊 Daily outreach: ${todayOutreach}/${dailyLimit} (${remainingOutreach} remaining)`);

    // Get existing leads to avoid duplicates
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('source_url, source_id')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const existingUrls = new Set(existingLeads?.map(l => l.source_url).filter(Boolean) || []);
    const existingIds = new Set(existingLeads?.map(l => l.source_id).filter(Boolean) || []);

    // =====================================================
    // SCAN HACKER NEWS (Algolia API)
    // =====================================================
    console.log('📰 Scanning Hacker News...');
    
    for (const source of PUBLIC_SOURCES.hackerNews) {
      try {
        const response = await fetchWithRetry(source.url);
        if (!response) {
          stats.errors.push(`HN fetch failed: ${source.name}`);
          continue;
        }

        const data = await response.json();
        const hits = data.hits || [];
        stats.sources_scanned++;
        stats.items_analyzed += hits.length;

        for (const hit of hits.slice(0, 10)) {
          const itemId = hit.objectID || hit.story_id;
          const itemUrl = `https://news.ycombinator.com/item?id=${itemId}`;
          
          if (existingIds.has(itemId?.toString()) || existingUrls.has(itemUrl)) continue;

          const content = `${hit.title || ''} ${hit.story_text || hit.comment_text || ''}`.slice(0, 500);
          if (content.length < 20) continue;

          discoveredLeads.push({
            source: source.name,
            platform: 'hackernews',
            url: itemUrl,
            title: hit.title || 'HN Discussion',
            content,
            author: hit.author,
            intent_score: 0, // Will be scored by AI
            pain_points: [],
            product_fit: [],
          });
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        stats.errors.push(`HN error: ${source.name} - ${e}`);
      }
    }

    // =====================================================
    // SCAN REDDIT RSS (Public feeds)
    // =====================================================
    console.log('🔴 Scanning Reddit RSS...');
    
    for (const source of PUBLIC_SOURCES.redditRSS) {
      try {
        const response = await fetchWithRetry(source.url);
        if (!response) {
          stats.errors.push(`Reddit RSS failed: ${source.name}`);
          continue;
        }

        const xml = await response.text();
        const items = parseRSSItems(xml);
        stats.sources_scanned++;
        stats.items_analyzed += items.length;

        for (const item of items) {
          if (existingUrls.has(item.link)) continue;

          const content = `${item.title} ${item.description}`.slice(0, 500);
          if (content.length < 20) continue;

          discoveredLeads.push({
            source: source.name,
            platform: 'reddit',
            url: item.link,
            title: item.title,
            content,
            author: item.author,
            intent_score: 0,
            pain_points: [],
            product_fit: [],
          });
        }

        await new Promise(r => setTimeout(r, 1000)); // Reddit rate limit
      } catch (e) {
        stats.errors.push(`Reddit error: ${source.name} - ${e}`);
      }
    }

    // =====================================================
    // SCAN DEV.TO RSS
    // =====================================================
    console.log('📝 Scanning Dev.to...');
    
    for (const source of PUBLIC_SOURCES.devTo) {
      try {
        const response = await fetchWithRetry(source.url);
        if (!response) continue;

        const xml = await response.text();
        const items = parseRSSItems(xml);
        stats.sources_scanned++;
        stats.items_analyzed += items.length;

        for (const item of items) {
          if (existingUrls.has(item.link)) continue;

          discoveredLeads.push({
            source: source.name,
            platform: 'devto',
            url: item.link,
            title: item.title,
            content: item.description.slice(0, 500),
            author: item.author,
            intent_score: 0,
            pain_points: [],
            product_fit: [],
          });
        }

        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        stats.errors.push(`Dev.to error: ${source.name}`);
      }
    }

    // =====================================================
    // SCAN STACK EXCHANGE
    // =====================================================
    console.log('📚 Scanning Stack Exchange...');
    
    for (const source of PUBLIC_SOURCES.stackExchange) {
      try {
        const response = await fetchWithRetry(source.url);
        if (!response) continue;

        const data = await response.json();
        const questions = data.items || [];
        stats.sources_scanned++;
        stats.items_analyzed += questions.length;

        for (const q of questions.slice(0, 10)) {
          const qUrl = q.link;
          if (existingUrls.has(qUrl)) continue;

          discoveredLeads.push({
            source: source.name,
            platform: 'stackexchange',
            url: qUrl,
            title: q.title,
            content: (q.body || '').replace(/<[^>]*>/g, '').slice(0, 500),
            author: q.owner?.display_name,
            intent_score: 0,
            pain_points: [],
            product_fit: [],
          });
        }

        await new Promise(r => setTimeout(r, 1000)); // SE rate limit
      } catch (e) {
        stats.errors.push(`SE error: ${source.name}`);
      }
    }

    console.log(`📊 Total leads to analyze: ${discoveredLeads.length}`);

    // =====================================================
    // AI ANALYSIS - Score all leads in batches
    // =====================================================
    console.log('🤖 Analyzing leads with AI...');

    const batchSize = 10;
    const scoredLeads: DiscoveredLead[] = [];

    for (let i = 0; i < discoveredLeads.length; i += batchSize) {
      const batch = discoveredLeads.slice(i, i + batchSize);
      
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'Autonomous Lead Scorer',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: `You are a lead qualification AI for MicroGuard - a Web3 security API service.

Our products:
- Wallet Risk API: Check if wallets are safe (scam detection, rug pull risk)
- Contract Scanner: Analyze smart contracts for vulnerabilities
- Webhook Health: Monitor webhook reliability
- Guardian: Full protection system ($499/mo)

For each lead, score:
- intent_score: 0-100 (100 = ready to buy now)
- pain_points: Array of identified problems
- product_fit: Which products match ["wallet-risk", "contract-scanner", "webhook", "guardian"]
- suggested_response: A HELPFUL comment/reply (max 200 chars) that adds value without being spammy. Be genuinely helpful first.

Return JSON: { "leads": [...] }
Only return leads with intent_score >= 45.`,
              },
              {
                role: 'user',
                content: `Analyze these leads:\n\n${batch.map((l, idx) => 
                  `[${idx}] Platform: ${l.platform}\nTitle: ${l.title}\nContent: ${l.content.slice(0, 300)}`
                ).join('\n\n')}`,
              },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const analysis = JSON.parse(aiData.choices?.[0]?.message?.content || '{"leads":[]}');
          
          for (const scored of analysis.leads || []) {
            const originalIdx = scored.index ?? scored.idx ?? 0;
            if (originalIdx < batch.length && scored.intent_score >= 45) {
              const original = batch[originalIdx];
              scoredLeads.push({
                ...original,
                intent_score: scored.intent_score,
                pain_points: scored.pain_points || [],
                product_fit: scored.product_fit || [],
                suggested_response: scored.suggested_response,
              });
            }
          }
        }
      } catch (e) {
        stats.errors.push(`AI batch error: ${e}`);
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`🎯 Qualified leads: ${scoredLeads.length}`);

    // =====================================================
    // SAVE LEADS & QUEUE OUTREACH
    // =====================================================
    for (const lead of scoredLeads) {
      try {
        // Save to leads table
        await supabase.from('leads').upsert({
          source: lead.source,
          source_type: lead.platform,
          source_url: lead.url,
          title: lead.title,
          content: lead.content.slice(0, 1000),
          author: lead.author,
          username: lead.author,
          intent_score: lead.intent_score,
          relevance_score: lead.intent_score,
          pain_points: lead.pain_points,
          interests: lead.product_fit,
          status: lead.intent_score >= 70 ? 'hot' : 'new',
        }, { onConflict: 'source_url' });

        stats.leads_discovered++;

        // Queue outreach for high-intent leads
        if (lead.intent_score >= 60 && lead.suggested_response && stats.outreach_queued < remainingOutreach) {
          await supabase.from('outreach_queue').insert({
            source_url: lead.url,
            channel: lead.platform,
            message_type: 'initial',
            message_content: lead.suggested_response,
            status: 'ready_to_post', // Human needs to actually post it
            persona: 'expert',
            scheduled_for: new Date().toISOString(),
          });
          stats.outreach_queued++;
        }

        if (lead.intent_score >= 70) stats.high_intent_leads++;
      } catch (e) {
        // Ignore duplicate errors
      }
    }

    // =====================================================
    // GENERATE CONTENT
    // =====================================================
    console.log('✍️ Generating marketing content...');
    
    try {
      const contentResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Content Generator',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `Generate 3 pieces of marketing content for MicroGuard - a Web3 wallet/contract security API.

For each piece:
- type: "tweet" | "reddit_post" | "blog_idea"
- title: Catchy headline
- body: The content (tweet=280 chars, reddit=500 chars, blog=100 chars summary)
- hashtags: Relevant hashtags
- cta: Call to action

Focus on: wallet security, scam detection, smart contract audits, rug pull protection.
Be educational and helpful, not salesy.

Return JSON: { "content": [...] }`,
            },
            {
              role: 'user',
              content: `Today's date: ${new Date().toISOString().slice(0, 10)}. 
Recent pain points from leads: ${scoredLeads.slice(0, 5).map(l => l.pain_points.join(', ')).join('; ')}`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (contentResponse.ok) {
        const contentData = await contentResponse.json();
        const generated = JSON.parse(contentData.choices?.[0]?.message?.content || '{"content":[]}');
        
        for (const piece of generated.content || []) {
          await supabase.from('content_queue').insert({
            content_type: piece.type,
            platform: piece.type === 'tweet' ? 'twitter' : piece.type === 'reddit_post' ? 'reddit' : 'blog',
            title: piece.title,
            body: piece.body,
            cta: piece.cta,
            hashtags: piece.hashtags,
            status: 'draft',
            scheduled_for: new Date(Date.now() + Math.random() * 86400000).toISOString(),
          });
          stats.content_generated++;
        }
      }
    } catch (e) {
      stats.errors.push(`Content gen error: ${e}`);
    }

    // =====================================================
    // SEND TELEGRAM REPORT
    // =====================================================
    const reportLines = [
      '🤖 <b>מחזור שיווק אוטונומי הושלם</b>',
      '',
      `📊 <b>סטטיסטיקות:</b>`,
      `• מקורות שנסרקו: ${stats.sources_scanned}`,
      `• פריטים שנותחו: ${stats.items_analyzed}`,
      `• לידים חדשים: ${stats.leads_discovered}`,
      `• לידים חמים (70+): ${stats.high_intent_leads}`,
      `• הודעות בתור: ${stats.outreach_queued}`,
      `• תוכן שנוצר: ${stats.content_generated}`,
      '',
    ];

    // Top leads summary
    const topLeads = scoredLeads.filter(l => l.intent_score >= 70).slice(0, 3);
    if (topLeads.length > 0) {
      reportLines.push('<b>🔥 לידים חמים:</b>');
      for (const lead of topLeads) {
        reportLines.push(`• [${lead.intent_score}] ${lead.title.slice(0, 40)}...`);
        reportLines.push(`  ${lead.platform} | ${lead.product_fit.join(', ')}`);
      }
      reportLines.push('');
    }

    // Errors if any (excluding minor ones)
    const criticalErrors = stats.errors.filter(e => !e.includes('fetch failed'));
    if (criticalErrors.length > 0) {
      reportLines.push(`⚠️ שגיאות: ${criticalErrors.length}`);
    }

    reportLines.push('');
    reportLines.push(`⏰ ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`);

    await supabase.functions.invoke('telegram-notify', {
      body: {
        message: reportLines.join('\n'),
        type: 'marketing_report',
      },
    });

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000006',
      action: 'full_autonomous_cycle',
      metadata: {
        ...stats,
        top_leads: topLeads.map(l => ({ score: l.intent_score, platform: l.platform })),
      },
    });

    console.log('✅ Full Autonomous Engine cycle complete');

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        top_leads: topLeads.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Autonomous Engine error:', error);
    
    await supabase.functions.invoke('telegram-notify', {
      body: {
        message: `🚨 <b>שגיאה במנוע האוטונומי</b>\n\n${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
      },
    });

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
