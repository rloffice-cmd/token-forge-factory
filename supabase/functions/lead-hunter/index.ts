/**
 * Lead Hunter Engine - Autonomous Lead Discovery
 * סריקת אתרים, פורומים וקהילות לאיתור לידים פוטנציאליים
 * Runs every 6 hours via pg_cron
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lead sources - websites and forums to scan for potential customers
const LEAD_SOURCES = [
  // Reddit communities
  { type: 'reddit', url: 'https://www.reddit.com/r/startups/new/', keywords: ['need help', 'looking for', 'automation', 'AI solution'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/SaaS/new/', keywords: ['building', 'mvp', 'need', 'help'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/Entrepreneur/new/', keywords: ['automate', 'ai', 'tool', 'service'] },
  
  // Indie Hackers
  { type: 'forum', url: 'https://www.indiehackers.com/feed', keywords: ['need', 'help', 'looking', 'automation'] },
  
  // Product Hunt discussions
  { type: 'forum', url: 'https://www.producthunt.com/discussions', keywords: ['tool', 'ai', 'help'] },
  
  // Twitter/X searches (via web)
  { type: 'social', url: 'https://nitter.net/search?q=need+AI+automation', keywords: ['help', 'need', 'looking for'] },
];

interface Lead {
  source_url: string;
  source_type: string;
  title: string;
  content: string;
  author?: string;
  author_url?: string;
  relevance_score: number;
  keywords_matched: string[];
  discovered_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🔍 Lead Hunter starting scan...');
    
    const discoveredLeads: Lead[] = [];
    
    // Process each lead source
    for (const source of LEAD_SOURCES.slice(0, 3)) { // Limit to 3 sources per run
      console.log(`Scanning: ${source.url}`);
      
      try {
        // Use Firecrawl to scrape the source
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: source.url,
            formats: ['markdown'],
            onlyMainContent: true,
          }),
        });

        if (!scrapeResponse.ok) {
          console.warn(`Failed to scrape ${source.url}: ${scrapeResponse.status}`);
          continue;
        }

        const scrapeData = await scrapeResponse.json();
        const content = scrapeData.data?.markdown || scrapeData.markdown || '';
        
        if (!content) {
          console.warn(`No content from ${source.url}`);
          continue;
        }

        // Use AI to analyze content and extract leads
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'Lead Hunter',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: `You are a lead qualification expert. Analyze the following content from ${source.type} and extract potential leads - people or companies that might need AI/automation services.

For each lead, provide:
- title: Brief description of what they need
- content: The relevant text snippet
- author: Username if available
- relevance_score: 0-100 based on buying intent
- keywords_matched: Which keywords indicate interest

Return JSON array. Only include leads with score > 50.
Keywords to look for: ${source.keywords.join(', ')}`
              },
              {
                role: 'user',
                content: content.slice(0, 15000) // Limit content size
              }
            ],
            response_format: { type: 'json_object' },
          }),
        });

        if (!aiResponse.ok) {
          console.warn(`AI analysis failed for ${source.url}`);
          continue;
        }

        const aiData = await aiResponse.json();
        const analysisText = aiData.choices?.[0]?.message?.content || '{}';
        
        let analysis: { leads?: Lead[] } = {};
        try {
          analysis = JSON.parse(analysisText);
        } catch {
          console.warn('Failed to parse AI response');
          continue;
        }

        const leads = analysis.leads || [];
        
        for (const lead of leads) {
          if (lead.relevance_score >= 50) {
            discoveredLeads.push({
              source_url: source.url,
              source_type: source.type,
              title: lead.title || 'Potential Lead',
              content: lead.content || '',
              author: lead.author,
              relevance_score: lead.relevance_score,
              keywords_matched: lead.keywords_matched || source.keywords,
              discovered_at: new Date().toISOString(),
            });
          }
        }

        console.log(`Found ${leads.length} leads from ${source.url}`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error processing ${source.url}:`, error);
      }
    }

    console.log(`Total leads discovered: ${discoveredLeads.length}`);

    // Save leads to database
    if (discoveredLeads.length > 0) {
      for (const lead of discoveredLeads) {
        await supabase.from('leads').insert({
          source_url: lead.source_url,
          source_type: lead.source_type,
          title: lead.title,
          content: lead.content,
          author: lead.author,
          relevance_score: lead.relevance_score,
          keywords_matched: lead.keywords_matched,
          status: 'new',
        });
      }
      
      // Trigger outreach for high-score leads
      const hotLeads = discoveredLeads.filter(l => l.relevance_score >= 70);
      if (hotLeads.length > 0) {
        await supabase.functions.invoke('ai-outreach', {
          body: { leads: hotLeads },
        });
      }
    }

    // Log the hunt
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000002', // Sentinel for lead-hunter
      action: 'lead_hunt_completed',
      metadata: {
        sources_scanned: LEAD_SOURCES.length,
        leads_found: discoveredLeads.length,
        high_intent_leads: discoveredLeads.filter(l => l.relevance_score >= 70).length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        leads_found: discoveredLeads.length,
        high_intent: discoveredLeads.filter(l => l.relevance_score >= 70).length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Lead Hunter error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
