/**
 * Brain Discover Sources - Auto-discover new sources from existing signals
 * Runs every 6 hours to find new RSS feeds and content hubs
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SEED_TOPICS = [
  'webhook',
  'replay',
  'risk scoring',
  'wallet security',
  'contract scanner',
  'crypto payments',
  'commerce webhook',
  'signature verification'
];

// Extract domain from URL
function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return null;
  }
}

// Check if URL returns valid RSS/Atom
async function validateRSSUrl(url: string): Promise<{ valid: boolean; itemCount: number }> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Brain-Discoverer/1.0' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) return { valid: false, itemCount: 0 };
    
    const text = await response.text();
    
    // Check for RSS/Atom markers
    const isRSS = text.includes('<rss') || text.includes('<feed') || text.includes('<channel');
    if (!isRSS) return { valid: false, itemCount: 0 };
    
    // Count items
    const itemCount = (text.match(/<item[^>]*>/gi) || []).length + 
                      (text.match(/<entry[^>]*>/gi) || []).length;
    
    return { valid: itemCount >= 5, itemCount };
  } catch {
    return { valid: false, itemCount: 0 };
  }
}

// Common RSS feed paths to try
const RSS_PATHS = [
  '/feed',
  '/feed/',
  '/rss',
  '/rss.xml',
  '/feed.xml',
  '/atom.xml',
  '/feeds/posts/default',
  '/blog/feed',
  '/blog/rss'
];

// Send Telegram summary
async function sendTelegram(message: string): Promise<void> {
  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
  
  if (!botToken || !chatId) return;
  
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (e) {
    console.error('Telegram error:', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Check brain_enabled
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('brain_enabled')
      .single();
    
    if (!settings?.brain_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Brain disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      domains_analyzed: 0,
      candidates_found: 0,
      validated: 0,
      added: 0,
      rejected: 0
    };

    // Analyze recent signals for new domains
    const { data: recentSignals } = await supabase
      .from('signals')
      .select('url, raw_text')
      .order('created_at', { ascending: false })
      .limit(100);

    // Extract unique domains
    const domainCounts = new Map<string, number>();
    for (const signal of recentSignals || []) {
      if (!signal.url) continue;
      const domain = extractDomain(signal.url);
      if (domain && !domain.includes('reddit.com') && !domain.includes('news.google.com') && !domain.includes('hnrss.org')) {
        domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
      }
    }

    // Find domains that appear multiple times (potential hubs)
    const frequentDomains = Array.from(domainCounts.entries())
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    results.domains_analyzed = frequentDomains.length;

    for (const [domain, count] of frequentDomains) {
      // Check if already in sources
      const { data: existing } = await supabase
        .from('offer_sources')
        .select('id')
        .ilike('url', `%${domain}%`)
        .maybeSingle();
      
      if (existing) continue;

      // Check if already in discovery queue
      const { data: inQueue } = await supabase
        .from('source_discovery_queue')
        .select('id')
        .ilike('candidate_url', `%${domain}%`)
        .maybeSingle();
      
      if (inQueue) continue;

      // Try to find RSS feed
      for (const path of RSS_PATHS) {
        const candidateUrl = `https://${domain}${path}`;
        
        const validation = await validateRSSUrl(candidateUrl);
        
        if (validation.valid) {
          results.candidates_found++;
          
          // Add to discovery queue
          await supabase.from('source_discovery_queue').insert({
            seed_topic: SEED_TOPICS[Math.floor(Math.random() * SEED_TOPICS.length)],
            candidate_url: candidateUrl,
            candidate_type: 'rss',
            confidence: Math.min(0.9, 0.5 + (count * 0.1) + (validation.itemCount * 0.02)),
            status: 'validated',
            reason: `Found ${validation.itemCount} items, domain appeared ${count} times`
          });
          
          results.validated++;

          // Auto-add high-confidence sources
          if (count >= 3 && validation.itemCount >= 10) {
            await supabase.from('offer_sources').insert({
              name: `Auto: ${domain}`,
              source_type: 'rss',
              url: candidateUrl,
              query_keywords: SEED_TOPICS.slice(0, 4),
              is_active: true,
              health_score: 1.0,
              scan_config: { parser: 'rss', auto_discovered: true }
            });
            
            // Update queue status
            await supabase
              .from('source_discovery_queue')
              .update({ status: 'added' })
              .eq('candidate_url', candidateUrl);
            
            results.added++;
          }
          
          break; // Found RSS for this domain, move to next
        }
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: '00000000-0000-0000-0000-000000000000',
      action: 'brain-discover-sources:completed',
      metadata: results
    });

    // Telegram summary if sources added
    if (results.added > 0) {
      await sendTelegram(
        `🔍 <b>גילוי מקורות</b>\n` +
        `📊 נותחו ${results.domains_analyzed} דומיינים\n` +
        `✅ נוספו ${results.added} מקורות חדשים`
      );
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Brain discover error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
