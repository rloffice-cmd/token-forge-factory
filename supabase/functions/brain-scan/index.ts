/**
 * Brain Scan - RSS/Source Scanner
 * Scans all active offer_sources, extracts signals, and stores them
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OfferSource {
  id: string;
  name: string;
  source_type: string;
  url: string;
  query: string | null;
  query_keywords: string[];
  health_score: number;
  failure_count: number;
}

// Create SHA-256 fingerprint
async function createFingerprint(url: string, title: string): Promise<string> {
  const data = new TextEncoder().encode(`${url}|${title}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// Detect intent type from text
function detectIntentType(text: string): string {
  const lowerText = text.toLowerCase();
  
  if (/webhook.*(replay|retry|resend|failed|missing)/i.test(lowerText)) return 'replay_webhook';
  if (/webhook.*(bug|error|issue|problem)/i.test(lowerText)) return 'bug_webhook';
  if (/(wallet|address).*(risk|scam|malicious|fraud|phishing)/i.test(lowerText)) return 'risk_scoring';
  if (/(contract|smart contract).*(risk|audit|vulnerability|malicious)/i.test(lowerText)) return 'risk_scoring';
  if (/(looking for|need|searching for|any tool|recommend)/i.test(lowerText)) return 'looking_for_tool';
  if (/(help|how to|how do|can someone)/i.test(lowerText)) return 'need_help';
  
  return 'other';
}

// Parse RSS feed
async function parseRSSFeed(url: string): Promise<Array<{title: string, link: string, description: string, author: string}>> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Brain-Scanner/1.0' }
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const text = await response.text();
    const items: Array<{title: string, link: string, description: string, author: string}> = [];
    
    // Simple XML parsing for RSS items
    const itemMatches = text.match(/<item[^>]*>[\s\S]*?<\/item>/gi) || [];
    
    for (const itemXml of itemMatches.slice(0, 20)) {
      const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
      const descMatch = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      const authorMatch = itemXml.match(/<(?:dc:creator|author)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:dc:creator|author)>/i);
      
      if (titleMatch && linkMatch) {
        items.push({
          title: titleMatch[1].trim().replace(/<[^>]*>/g, ''),
          link: linkMatch[1].trim(),
          description: descMatch ? descMatch[1].trim().replace(/<[^>]*>/g, '').slice(0, 500) : '',
          author: authorMatch ? authorMatch[1].trim() : ''
        });
      }
    }
    
    return items;
  } catch (error) {
    console.error(`Failed to parse RSS ${url}:`, error);
    return [];
  }
}

// Check keyword match
function matchesKeywords(text: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return true;
  const lowerText = text.toLowerCase();
  return keywords.some(kw => lowerText.includes(kw.toLowerCase()));
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
      .select('brain_enabled, scan_enabled')
      .single();
    
    if (!settings?.brain_enabled || !settings?.scan_enabled) {
      // Audit log
      await supabase.from('audit_logs').insert({
        job_id: '00000000-0000-0000-0000-000000000000',
        action: 'brain-scan:skipped',
        metadata: { reason: 'brain_enabled or scan_enabled is false' }
      });
      
      return new Response(
        JSON.stringify({ success: false, reason: 'Brain or scan disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch active sources
    const { data: sources, error: sourcesError } = await supabase
      .from('offer_sources')
      .select('*')
      .eq('is_active', true)
      .order('last_scanned_at', { ascending: true, nullsFirst: true })
      .limit(10);
    
    if (sourcesError) throw sourcesError;
    
    const results = {
      sources_scanned: 0,
      signals_created: 0,
      errors: [] as string[]
    };

    for (const source of (sources as OfferSource[]) || []) {
      try {
        let items: Array<{title: string, link: string, description: string, author: string}> = [];
        
        if (source.source_type === 'rss') {
          items = await parseRSSFeed(source.url);
        } else if (source.source_type === 'github_search') {
          // GitHub requires token, mark as needing manual intervention
          console.log(`Skipping GitHub source ${source.name} - needs GITHUB_TOKEN`);
          continue;
        }
        
        results.sources_scanned++;
        
        for (const item of items) {
          const fullText = `${item.title} ${item.description}`;
          
          // Check keyword match
          if (!matchesKeywords(fullText, source.query_keywords || [])) continue;
          
          const fingerprint = await createFingerprint(item.link, item.title);
          
          // Check if already exists
          const { data: existing } = await supabase
            .from('signals')
            .select('id')
            .eq('fingerprint', fingerprint)
            .maybeSingle();
          
          if (existing) continue;
          
          // Insert new signal
          const intentType = detectIntentType(fullText);
          
          const { error: insertError } = await supabase
            .from('signals')
            .insert({
              source_id: source.id,
              fingerprint,
              title: item.title.slice(0, 500),
              raw_text: item.description.slice(0, 2000),
              author: item.author.slice(0, 100),
              url: item.link.slice(0, 1000),
              intent_type: intentType,
              confidence: intentType !== 'other' ? 0.7 : 0.3
            });
          
          if (!insertError) {
            results.signals_created++;
          }
        }
        
        // Update source success
        await supabase
          .from('offer_sources')
          .update({
            last_scanned_at: new Date().toISOString(),
            last_success_at: new Date().toISOString(),
            failure_count: 0,
            health_score: Math.min(1.0, source.health_score + 0.05)
          })
          .eq('id', source.id);
          
      } catch (sourceError) {
        const errMsg = sourceError instanceof Error ? sourceError.message : 'Unknown error';
        console.error(`Error scanning source ${source.name}:`, sourceError);
        results.errors.push(`${source.name}: ${errMsg}`);
        
        // Update failure
        const newFailureCount = (source.failure_count || 0) + 1;
        const newHealthScore = Math.max(0, source.health_score - 0.1);
        
        await supabase
          .from('offer_sources')
          .update({
            last_scanned_at: new Date().toISOString(),
            failure_count: newFailureCount,
            health_score: newHealthScore,
            is_active: newFailureCount < 10 // Kill gate: disable after 10 failures
          })
          .eq('id', source.id);
      }
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: '00000000-0000-0000-0000-000000000000',
      action: 'brain-scan:completed',
      metadata: results
    });

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Brain scan error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
