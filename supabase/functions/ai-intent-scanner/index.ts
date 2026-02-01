/**
 * AI Intent Scanner - Deep Intent Detection from Web Content
 * סורק תוכן ומזהה כוונת רכישה עמוקה באמצעות AI
 * 
 * Uses:
 * 1. Firecrawl for deep web scraping
 * 2. AI for intent classification and scoring
 * 3. Pattern matching for high-value signals
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// High-intent signals that indicate buying readiness
const INTENT_SIGNALS = {
  immediate_need: {
    patterns: [
      'need this urgently',
      'looking for a solution now',
      'anyone know a tool that',
      'what do you use for',
      'recommendations for',
      'best way to',
      'how to solve',
    ],
    weight: 3,
  },
  pain_expression: {
    patterns: [
      'frustrated with',
      'losing money',
      'keep failing',
      'doesn\'t work',
      'spent hours',
      'can\'t figure out',
      'driving me crazy',
    ],
    weight: 2.5,
  },
  budget_indicator: {
    patterns: [
      'willing to pay',
      'budget for',
      'how much does',
      'pricing',
      'worth paying for',
      'take my money',
    ],
    weight: 4,
  },
  technical_readiness: {
    patterns: [
      'api integration',
      'looking for api',
      'need an endpoint',
      'webhook',
      'automate this',
      'programmatically',
    ],
    weight: 2,
  },
  comparison_shopping: {
    patterns: [
      'vs',
      'alternative to',
      'compared to',
      'better than',
      'switch from',
      'migrate from',
    ],
    weight: 1.5,
  },
};

// Platforms to scan with their configurations - Using APIs and RSS feeds that don't block
const SCAN_TARGETS = [
  // Hacker News - Direct API (works perfectly)
  {
    name: 'HN Blockchain',
    url: 'https://hn.algolia.com/api/v1/search_by_date?query=blockchain%20payment%20security&tags=story',
    type: 'hn_api',
  },
  {
    name: 'HN Webhook',
    url: 'https://hn.algolia.com/api/v1/search_by_date?query=webhook%20failed%20OR%20webhook%20retry&tags=story,comment',
    type: 'hn_api',
  },
  {
    name: 'HN Web3',
    url: 'https://hn.algolia.com/api/v1/search_by_date?query=web3%20wallet%20security&tags=story,comment',
    type: 'hn_api',
  },
  // Reddit via RSS (public, doesn't require auth)
  {
    name: 'Reddit ethdev RSS',
    url: 'https://www.reddit.com/r/ethdev/new/.rss',
    type: 'rss_feed',
  },
  {
    name: 'Reddit SaaS RSS',
    url: 'https://www.reddit.com/r/SaaS/new/.rss',
    type: 'rss_feed',
  },
  {
    name: 'Reddit cryptocurrency RSS',
    url: 'https://www.reddit.com/r/cryptocurrency/new/.rss',
    type: 'rss_feed',
  },
  // Dev.to - Open RSS feeds
  {
    name: 'Dev.to Webhooks',
    url: 'https://dev.to/feed/tag/webhooks',
    type: 'rss_feed',
  },
  {
    name: 'Dev.to Web3',
    url: 'https://dev.to/feed/tag/web3',
    type: 'rss_feed',
  },
  // Stack Exchange API (public)
  {
    name: 'SO Ethereum',
    url: 'https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&tagged=ethereum&site=stackoverflow&filter=withbody',
    type: 'stackexchange_api',
  },
];

interface IntentSignal {
  source: string;
  source_url: string;
  title: string;
  content_snippet: string;
  author?: string;
  intent_score: number;
  intent_signals: string[];
  product_fit: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  recommended_action: string;
  discovered_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { targets = SCAN_TARGETS.slice(0, 3), deep_scan = false } = body;

    console.log(`🔎 Intent Scanner starting... (${targets.length} targets)`);

    const discoveredIntents: IntentSignal[] = [];
    let scannedCount = 0;
    let errorCount = 0;

    for (const target of targets) {
      console.log(`Scanning: ${target.name}`);
      
      try {
        let content = '';

        // Handle different source types
        if (target.type === 'hn_api') {
          // Direct API call to HN Algolia
          const response = await fetch(target.url);
          if (response.ok) {
            const data = await response.json();
            content = JSON.stringify(data.hits?.slice(0, 20) || []);
          }
        } else if (target.type === 'stackexchange_api') {
          // Stack Exchange API
          const response = await fetch(target.url, {
            headers: { 'Accept-Encoding': 'gzip' },
          });
          if (response.ok) {
            const data = await response.json();
            content = JSON.stringify(data.items?.slice(0, 15) || []);
          }
        } else if (target.type === 'rss_feed') {
          // RSS feed - direct fetch
          const response = await fetch(target.url, {
            headers: { 
              'User-Agent': 'Mozilla/5.0 (compatible; IntentBot/1.0)',
              'Accept': 'application/rss+xml, application/xml, text/xml',
            },
          });
          if (response.ok) {
            content = await response.text();
          } else {
            console.warn(`RSS fetch failed for ${target.name}: ${response.status}`);
          }
        } else if (firecrawlKey) {
          // Use Firecrawl for other web scraping
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: target.url,
              formats: ['markdown'],
              onlyMainContent: true,
              waitFor: 2000,
            }),
          });

          if (scrapeResponse.ok) {
            const data = await scrapeResponse.json();
            content = data.data?.markdown || data.markdown || '';
          } else {
            console.warn(`Firecrawl failed for ${target.name}: ${scrapeResponse.status}`);
          }
        } else {
          // Fallback: basic fetch
          const response = await fetch(target.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IntentBot/1.0)' },
          });
          if (response.ok) {
            content = await response.text();
          }
        }

        if (!content) {
          errorCount++;
          continue;
        }

        scannedCount++;

        // Use AI to analyze intent
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: `You are an expert at identifying buying intent signals in online discussions.

Analyze the content and find posts/comments where someone:
1. Is actively looking for a solution to a problem we solve
2. Expresses frustration with existing tools
3. Shows budget readiness
4. Has a technical need we can address

Our products:
- Wallet Risk API: Check wallet safety before transactions
- Webhook Health Check: Monitor webhook reliability
- Payment Drift Detector: Find payment discrepancies
- Guardian: Automated protection system ($499/mo)

For each high-intent signal found, extract:
- title: Brief description
- content_snippet: The relevant text (max 200 chars)
- author: Username if visible
- intent_score: 0-100 (100 = ready to buy now)
- intent_signals: Which signals triggered (pain, urgency, budget, comparison, technical)
- product_fit: Which of our products match ["wallet-risk", "webhook-check", "payment-drift", "guardian"]
- urgency: low/medium/high/critical
- recommended_action: What we should do (respond, dm, add to nurture, skip)

Return JSON: { "signals": [...] }
Only include signals with intent_score >= 40.`
              },
              {
                role: 'user',
                content: `Source: ${target.name} (${target.type})

Content to analyze:
${content.slice(0, 20000)}`
              }
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (!aiResponse.ok) {
          console.warn(`AI analysis failed for ${target.name}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const analysis = JSON.parse(aiData.choices?.[0]?.message?.content || '{"signals":[]}');

        for (const signal of analysis.signals || []) {
          if (signal.intent_score >= 40) {
            const intentSignal: IntentSignal = {
              source: target.name,
              source_url: target.url,
              title: signal.title || 'Intent Signal',
              content_snippet: signal.content_snippet || '',
              author: signal.author,
              intent_score: signal.intent_score,
              intent_signals: signal.intent_signals || [],
              product_fit: signal.product_fit || [],
              urgency: signal.urgency || 'medium',
              recommended_action: signal.recommended_action || 'review',
              discovered_at: new Date().toISOString(),
            };

            discoveredIntents.push(intentSignal);

            // Save to leads table
            await supabase.from('leads').insert({
              source: target.name,
              source_url: target.url,
              username: signal.author,
              notes: signal.content_snippet,
              intent_score: signal.intent_score,
              relevance_score: signal.intent_score,
              status: signal.urgency === 'critical' ? 'hot' : 'new',
              tags: signal.intent_signals,
              interests: signal.product_fit,
              raw_data: {
                intent_signals: signal.intent_signals,
                product_fit: signal.product_fit,
                urgency: signal.urgency,
                recommended_action: signal.recommended_action,
              },
            });
          }
        }

        console.log(`Found ${analysis.signals?.length || 0} intent signals from ${target.name}`);

        // Rate limiting between sources
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error scanning ${target.name}:`, error);
        errorCount++;
      }
    }

    // Handle high-urgency signals immediately
    const criticalSignals = discoveredIntents.filter(s => s.urgency === 'critical' || s.intent_score >= 80);
    
    if (criticalSignals.length > 0) {
      // Generate immediate responses for critical signals
      for (const signal of criticalSignals.slice(0, 3)) {
        await supabase.functions.invoke('ai-content-engine', {
          body: {
            mode: 'respond',
            context: signal.content_snippet,
            target_platform: signal.source.includes('Reddit') ? 'reddit' : 
                            signal.source.includes('Twitter') ? 'twitter' : 'forum',
          },
        }).catch(() => {/* Silent fail */});
      }

      // Alert via Telegram
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `🚨 *HIGH INTENT SIGNALS DETECTED!*

${criticalSignals.slice(0, 5).map(s => 
`• *${s.title}* (${s.intent_score}%)
  Source: ${s.source}
  Products: ${s.product_fit.join(', ')}
  Action: ${s.recommended_action}`
).join('\n\n')}

📝 Response drafts created automatically`,
          type: 'high_intent_alert',
        },
      }).catch(() => {/* Silent fail */});
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000004', // Sentinel for intent-scanner
      action: 'intent_scan_completed',
      metadata: {
        targets_scanned: scannedCount,
        errors: errorCount,
        signals_found: discoveredIntents.length,
        critical_signals: criticalSignals.length,
        avg_intent_score: discoveredIntents.length > 0 
          ? Math.round(discoveredIntents.reduce((a, b) => a + b.intent_score, 0) / discoveredIntents.length)
          : 0,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        scanned: scannedCount,
        errors: errorCount,
        signals_found: discoveredIntents.length,
        critical_signals: criticalSignals.length,
        signals: discoveredIntents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Intent Scanner error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
