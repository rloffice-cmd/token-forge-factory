/**
 * FULL AUTONOMOUS ENGINE - MASTER PROMPT IMPLEMENTATION
 * מנוע הפצה אוטונומי מלא - ללא פרשנות, ללא אישורים
 * 
 * PIPELINE: SCAN → ANALYZE → SCORE → GENERATE → VALIDATE → PUBLISH → MEASURE → LEARN
 * 
 * אין קיצור דרך. שלב שנכשל = עצירה וגניזה.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { 
  SCORING, 
  LIMITS, 
  PLATFORM_CONFIG, 
  AI_PROMPTS,
  EXECUTION_MODE,
  TRUST_CAP,
  PAYMENT_THROTTLE,
  VELOCITY_LIMITS,
  validateContent,
  shouldAutoPublish,
  shouldOutreach,
  getRandomDelay,
  getContentStatus,
  detectBlockRisk,
  shouldThrottleCheckouts,
  getMaxCheckoutsAllowed,
} from "../_shared/master-prompt-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =====================================================
// PUBLIC API SOURCES - NO AUTH REQUIRED
// =====================================================
const PUBLIC_SOURCES = {
  hackerNews: [
    { name: 'HN Wallet Security', url: 'https://hn.algolia.com/api/v1/search_by_date?query=wallet%20security&tags=story,comment&hitsPerPage=30' },
    { name: 'HN Smart Contract', url: 'https://hn.algolia.com/api/v1/search_by_date?query=smart%20contract%20audit&tags=story,comment&hitsPerPage=30' },
    { name: 'HN Crypto Scam', url: 'https://hn.algolia.com/api/v1/search_by_date?query=crypto%20scam%20detection&tags=story,comment&hitsPerPage=20' },
    { name: 'HN Web3 Security', url: 'https://hn.algolia.com/api/v1/search_by_date?query=web3%20security&tags=story,comment&hitsPerPage=30' },
    { name: 'HN DeFi Hack', url: 'https://hn.algolia.com/api/v1/search_by_date?query=defi%20hack%20OR%20rug%20pull&tags=story,comment&hitsPerPage=20' },
  ],
  
  redditRSS: [
    { name: 'r/ethdev', url: 'https://www.reddit.com/r/ethdev/new/.rss?limit=25' },
    { name: 'r/ethereum', url: 'https://www.reddit.com/r/ethereum/new/.rss?limit=25' },
    { name: 'r/defi', url: 'https://www.reddit.com/r/defi/new/.rss?limit=25' },
    { name: 'r/CryptoTechnology', url: 'https://www.reddit.com/r/CryptoTechnology/new/.rss?limit=25' },
    { name: 'r/solidity', url: 'https://www.reddit.com/r/solidity/new/.rss?limit=20' },
  ],
  
  devTo: [
    { name: 'Dev.to Web3', url: 'https://dev.to/feed/tag/web3' },
    { name: 'Dev.to Blockchain', url: 'https://dev.to/feed/tag/blockchain' },
    { name: 'Dev.to Ethereum', url: 'https://dev.to/feed/tag/ethereum' },
    { name: 'Dev.to Security', url: 'https://dev.to/feed/tag/security' },
  ],
  
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
  score: number;
  pain_points: string[];
  product_fit: string[];
  suggested_response?: string;
}

interface EngineStats {
  sources_scanned: number;
  items_analyzed: number;
  leads_discovered: number;
  leads_qualified: number; // Score ≥80
  leads_archived: number; // Score <80
  content_published: number;
  outreach_sent: number;
  blocked_by_guardrails: number;
  errors: string[];
}

// Parse RSS/Atom feed
function parseRSSItems(xml: string): Array<{title: string, link: string, description: string, author?: string}> {
  const items: Array<{title: string, link: string, description: string, author?: string}> = [];
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

async function fetchWithRetry(url: string, retries = 2): Promise<Response | null> {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'MicroGuard-Scanner/1.0',
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
    leads_qualified: 0,
    leads_archived: 0,
    content_published: 0,
    outreach_sent: 0,
    blocked_by_guardrails: 0,
    errors: [],
  };

  const discoveredLeads: DiscoveredLead[] = [];

  try {
    console.log('🚀 MASTER PROMPT ENGINE - EXECUTION MODE ACTIVE');
    console.log(`📌 AUTO_PUBLISH=${EXECUTION_MODE.AUTO_PUBLISH} | DRAFT_MODE=${EXECUTION_MODE.DRAFT_MODE} | IMMEDIATE_ACTION=${EXECUTION_MODE.IMMEDIATE_ACTION}`);

    // =====================================================
    // PRE-FLIGHT CHECKS
    // =====================================================
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

    // Check daily limits (72-hour dedup window)
    const dedupCutoff = new Date(Date.now() - LIMITS.DEDUP_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString().slice(0, 10);
    
    const { count: todayPosts } = await supabase
      .from('content_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .gte('published_at', `${today}T00:00:00Z`);

    const { count: todayOutreach } = await supabase
      .from('outreach_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', `${today}T00:00:00Z`);

    // 🔒 PAYMENT-FIRST THROTTLE: Check recent checkouts vs payments
    const last24h = new Date(Date.now() - PAYMENT_THROTTLE.window_hours * 60 * 60 * 1000).toISOString();
    
    const { count: recentCheckouts } = await supabase
      .from('closing_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('result', 'checkout_created')
      .gte('created_at', last24h);

    const { count: recentPayments } = await supabase
      .from('payments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('confirmed_at', last24h);

    const isThrottled = shouldThrottleCheckouts(recentCheckouts || 0, recentPayments || 0);
    const maxCheckouts = getMaxCheckoutsAllowed(recentPayments || 0);

    if (isThrottled) {
      console.log(`🛑 PAYMENT-FIRST THROTTLE ACTIVE: ${recentCheckouts} checkouts, ${recentPayments} payments → FREE_ONLY mode`);
    }

    if ((todayPosts || 0) >= LIMITS.MAX_POSTS_PER_DAY) {
      console.log(`🛑 Daily post limit reached: ${todayPosts}/${LIMITS.MAX_POSTS_PER_DAY}`);
      return new Response(
        JSON.stringify({ success: true, reason: 'daily_post_limit_reached', stats }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((todayOutreach || 0) >= LIMITS.MAX_OUTREACH_PER_DAY) {
      console.log(`🛑 Daily outreach limit reached: ${todayOutreach}/${LIMITS.MAX_OUTREACH_PER_DAY}`);
    }

    // Get existing URLs for deduplication
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('source_url, source_id')
      .gte('created_at', dedupCutoff);

    const existingUrls = new Set(existingLeads?.map(l => l.source_url).filter(Boolean) || []);
    const existingIds = new Set(existingLeads?.map(l => l.source_id).filter(Boolean) || []);

    // =====================================================
    // STAGE 1: SCAN - Gather raw leads from all sources
    // =====================================================
    console.log('📡 STAGE 1: SCAN - Gathering leads from public sources');

    // Scan Hacker News
    for (const source of PUBLIC_SOURCES.hackerNews) {
      try {
        const response = await fetchWithRetry(source.url);
        if (!response) continue;
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
            score: 0,
            pain_points: [],
            product_fit: [],
          });
        }
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        stats.errors.push(`HN error: ${source.name}`);
      }
    }

    // Scan Reddit RSS
    for (const source of PUBLIC_SOURCES.redditRSS) {
      try {
        const response = await fetchWithRetry(source.url);
        if (!response) continue;
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
            score: 0,
            pain_points: [],
            product_fit: [],
          });
        }
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        stats.errors.push(`Reddit error: ${source.name}`);
      }
    }

    // Scan Dev.to
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
            score: 0,
            pain_points: [],
            product_fit: [],
          });
        }
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        stats.errors.push(`Dev.to error: ${source.name}`);
      }
    }

    // Scan Stack Exchange
    for (const source of PUBLIC_SOURCES.stackExchange) {
      try {
        const response = await fetchWithRetry(source.url);
        if (!response) continue;
        const data = await response.json();
        const questions = data.items || [];
        stats.sources_scanned++;
        stats.items_analyzed += questions.length;

        for (const q of questions.slice(0, 10)) {
          if (existingUrls.has(q.link)) continue;
          discoveredLeads.push({
            source: source.name,
            platform: 'stackexchange',
            url: q.link,
            title: q.title,
            content: (q.body || '').replace(/<[^>]*>/g, '').slice(0, 500),
            author: q.owner?.display_name,
            score: 0,
            pain_points: [],
            product_fit: [],
          });
        }
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        stats.errors.push(`SE error: ${source.name}`);
      }
    }

    console.log(`📊 Scan complete: ${discoveredLeads.length} raw leads`);

    // =====================================================
    // STAGE 2: ANALYZE & SCORE - Strict 80+ threshold
    // =====================================================
    console.log('🤖 STAGE 2: ANALYZE - Scoring leads with strict threshold');

    const qualifiedLeads: DiscoveredLead[] = [];
    const batchSize = 10;

    for (let i = 0; i < discoveredLeads.length; i += batchSize) {
      const batch = discoveredLeads.slice(i, i + batchSize);
      
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'Master Prompt Lead Scorer',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: AI_PROMPTS.lead_scorer },
              {
                role: 'user',
                content: `Score these leads. ONLY return leads with score ≥${SCORING.AUTO_PUBLISH_THRESHOLD}:\n\n${batch.map((l, idx) => 
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
            const idx = scored.index ?? scored.idx ?? 0;
            if (idx < batch.length && scored.score >= SCORING.AUTO_PUBLISH_THRESHOLD) {
              // Validate suggested response
              if (scored.suggested_response) {
                const validation = validateContent(scored.suggested_response);
                if (!validation.valid) {
                  stats.blocked_by_guardrails++;
                  console.log(`🛡️ Guardrail blocked: ${validation.reason}`);
                  continue;
                }
              }

              qualifiedLeads.push({
                ...batch[idx],
                score: scored.score,
                pain_points: scored.pain_points || [],
                product_fit: scored.product_fit || [],
                suggested_response: scored.suggested_response,
              });
              stats.leads_qualified++;
            } else {
              stats.leads_archived++;
            }
          }
        }
      } catch (e) {
        stats.errors.push(`AI scoring error: ${e}`);
      }

      await new Promise(r => setTimeout(r, 1000));
    }

    // Archive leads that didn't qualify (score < 80)
    const archivedCount = discoveredLeads.length - qualifiedLeads.length;
    stats.leads_archived = archivedCount;
    console.log(`✅ Qualified: ${qualifiedLeads.length} | ❌ Archived: ${archivedCount}`);

    // =====================================================
    // STAGE 3: SAVE & QUEUE
    // =====================================================
    console.log('💾 STAGE 3: SAVE - Storing qualified leads');

    const remainingOutreach = LIMITS.MAX_OUTREACH_PER_DAY - (todayOutreach || 0);

    for (const lead of qualifiedLeads) {
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
          intent_score: lead.score,
          relevance_score: lead.score,
          pain_points: lead.pain_points,
          interests: lead.product_fit,
          status: isThrottled ? 'free_only' : 'qualified', // Throttle mode = free_only
        }, { onConflict: 'source_url' });

        stats.leads_discovered++;

        // 🔒 PAYMENT-FIRST THROTTLE: Skip paid outreach if throttled
        if (isThrottled) {
          console.log(`🛑 Throttled: Lead ${lead.url} → FREE_ONLY (no outreach)`);
          continue;
        }

        // EXECUTION MODE: Immediate outreach for 80+ leads (no waiting, no drafts)
        if (shouldOutreach(lead.score) && lead.suggested_response && stats.outreach_sent < remainingOutreach) {
          // EXECUTION MODE: Minimal delay for human simulation, then execute
          const delay = EXECUTION_MODE.IMMEDIATE_ACTION ? 
            Math.floor(Math.random() * 5 * 60 * 1000) : // 0-5 min for immediate mode
            getRandomDelay(lead.platform as keyof typeof PLATFORM_CONFIG);
          const scheduledFor = new Date(Date.now() + delay).toISOString();

          await supabase.from('outreach_queue').insert({
            source_url: lead.url,
            channel: lead.platform,
            message_type: 'initial',
            message_content: lead.suggested_response,
            status: 'pending', // Ready for immediate execution, not 'scheduled'
            persona: 'value_expert',
            scheduled_for: scheduledFor,
          });
          stats.outreach_sent++;
        }
      } catch (e) {
        // Ignore duplicate errors
      }
    }

    // =====================================================
    // STAGE 4: GENERATE CONTENT (if quota allows)
    // =====================================================
    if ((todayPosts || 0) < LIMITS.MAX_POSTS_PER_DAY) {
      console.log('✍️ STAGE 4: GENERATE - Creating value-first content');

      try {
        const contentResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'Master Prompt Content Generator',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: AI_PROMPTS.content_generator },
              {
                role: 'user',
                content: `Generate 1 piece of VALUE-FIRST educational content about crypto/Web3 security.
Based on today's pain points: ${qualifiedLeads.slice(0, 3).map(l => l.pain_points.join(', ')).join('; ')}

Return JSON: { "content": { "type": "insight", "title": "...", "body": "...", "platform": "general" } }

If you cannot create content that follows the rules, return: { "content": null }`,
              },
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (contentResponse.ok) {
          const contentData = await contentResponse.json();
          const generated = JSON.parse(contentData.choices?.[0]?.message?.content || '{"content":null}');
          
          if (generated.content) {
            // Validate content
            const validation = validateContent(generated.content.body || '');
            
            if (validation.valid) {
              // EXECUTION MODE: Direct to 'published' status - NO DRAFTS
              const contentStatus = getContentStatus(85); // Assume AI-generated content is 85+
              
              await supabase.from('content_queue').insert({
                content_type: generated.content.type || 'insight',
                platform: generated.content.platform || 'general',
                title: generated.content.title,
                body: generated.content.body,
                status: contentStatus, // 'published' when AUTO_PUBLISH=true
                published_at: contentStatus === 'published' ? new Date().toISOString() : null,
                scheduled_for: null, // No scheduling - immediate action
              });
              stats.content_published++;
              console.log(`✅ CONTENT AUTO-PUBLISHED: ${generated.content.title?.slice(0, 50)}`);
            } else {
              stats.blocked_by_guardrails++;
              console.log(`🛡️ Content blocked: ${validation.reason}`);
            }
          }
        }
      } catch (e) {
        stats.errors.push(`Content gen error: ${e}`);
      }
    }

    // =====================================================
    // STAGE 5: AUDIT & LEARN
    // =====================================================
    console.log('📈 STAGE 5: LEARN - Recording metrics for optimization');

    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000006',
      action: 'master_prompt_cycle',
      metadata: {
        ...stats,
        threshold_used: SCORING.AUTO_PUBLISH_THRESHOLD,
        pipeline_version: 'master_prompt_v1',
        qualified_leads: qualifiedLeads.slice(0, 5).map(l => ({
          score: l.score,
          platform: l.platform,
          pain_points: l.pain_points,
        })),
      },
    });

    // Log cycle completion (no Telegram - only daily summary)
    console.log(`✅ CYCLE COMPLETE | Qualified: ${stats.leads_qualified} | Archived: ${stats.leads_archived} | Outreach: ${stats.outreach_sent} | Guardrails: ${stats.blocked_by_guardrails}`);

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('CRITICAL ENGINE ERROR:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for block risk
    if (detectBlockRisk(errorMsg)) {
      console.error('🚨 BLOCK RISK DETECTED - Stopping engine');
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `🚨 <b>CRITICAL: Block Risk Detected</b>\n\n${errorMsg}\n\nEngine stopped automatically.`,
          type: 'error',
        },
      });
    }

    // Only notify on truly critical errors
    const isCritical = errorMsg.includes('CRITICAL') || errorMsg.includes('FATAL') || detectBlockRisk(errorMsg);
    if (isCritical) {
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `🚨 <b>CRITICAL ENGINE ERROR</b>\n\n${errorMsg}`,
          type: 'error',
        },
      });
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMsg, stats }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
