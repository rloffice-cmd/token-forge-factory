/**
 * Lead Hunter Engine V3.0 - Neural Forge: Predictive Demand Signaling
 * 3-Step Verification: Linguistic DNA → Pain Mapping → Tech Stack Detection
 * Failure-based hunting patterns for maximum conversion efficiency
 * Runs every 6 hours via pg_cron
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// V3.0 FAILURE-BASED HUNTING PATTERNS — search for pain, not brands
const LEAD_SOURCES = [
  // ===== WOODPECKER HUNTERS (Email Deliverability Failures) =====
  { type: 'reddit', url: 'https://www.reddit.com/r/sales/new/', keywords: ['cold email', 'deliverability', 'emails landing in spam', 'outbound scaling', 'email warmup', 'bounce rate'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/Emailmarketing/new/', keywords: ['gmail suspended', 'cold email bounce', 'inbox placement', 'warmup tool', 'instantly alternative'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/leadgeneration/new/', keywords: ['outreach automation', 'cold email tool', 'email sequences', 'reply rate', 'follow-up automation'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/growthhacking/new/', keywords: ['outbound strategy', 'cold outreach', 'scalability issues', 'email deliverability'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/marketingautomation/new/', keywords: ['email automation', 'drip campaign', 'outreach tool', 'cold email at scale'] },

  // ===== EMAILLISTVERIFY HUNTERS (Email Validation / Bounce Failures) =====
  { type: 'reddit', url: 'https://www.reddit.com/r/Emailmarketing/new/', keywords: ['email verification', 'bounce rate high', 'invalid emails', 'email list cleaning', 'verify email list', 'hard bounces'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/sales/new/', keywords: ['email list quality', 'bounced emails', 'catch-all emails', 'disposable emails', 'spam traps', 'list hygiene'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/digital_marketing/new/', keywords: ['email validation tool', 'clean email list', 'neverbounce alternative', 'zerobounce alternative', 'bulk email verify'] },

  // ===== COMPASS HUNTERS (eCommerce Analytics / Scaling) =====
  { type: 'reddit', url: 'https://www.reddit.com/r/ecommerce/new/', keywords: ['ecommerce analytics', 'scaling store', 'product analytics', 'revenue optimization', 'conversion tracking'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/shopify/new/', keywords: ['shopify analytics', 'scaling shopify', 'b2b ecommerce', 'growth metrics', 'sales dashboard'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/BigCommerce/new/', keywords: ['ecommerce growth', 'analytics tool', 'scaling online store', 'product performance'] },

  // ===== PINECONE HUNTERS (Vector DB / RAG Failures) =====
  { type: 'reddit', url: 'https://www.reddit.com/r/MachineLearning/new/', keywords: ['vector search latency', 'embedding cost', 'RAG without dedicated DB', 'similarity search scale'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/LocalLLaMA/new/', keywords: ['vector database', 'embedding storage', 'RAG pipeline', 'chromadb alternative'] },

  // ===== SECURITY HUNTERS (Wallet / Phishing Failures) =====
  { type: 'reddit', url: 'https://www.reddit.com/r/CryptoCurrency/new/', keywords: ['phishing alert wallet', 'seed phrase security', 'hardware wallet vs software', 'private key compromised'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/cybersecurity/new/', keywords: ['phishing attack', 'credential theft', 'zero trust', 'endpoint security'] },

  // ===== GENERAL SaaS FAILURES =====
  { type: 'reddit', url: 'https://www.reddit.com/r/startups/new/', keywords: ['need help', 'looking for', 'automation', 'AI solution', 'scaling problem'] },
  { type: 'reddit', url: 'https://www.reddit.com/r/SaaS/new/', keywords: ['building', 'mvp', 'need', 'help', 'tool recommendation'] },
  { type: 'forum', url: 'https://www.indiehackers.com/feed', keywords: ['need', 'help', 'looking', 'automation', 'scaling'] },
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
  intent_type?: string;
  pain_severity?: string;
  tech_stack_detected?: string[];
  niche_category?: string;
}

// V3.0 — 3-Step Verification Prompt
function buildAnalysisPrompt(sourceType: string, keywords: string[]): string {
  return `You are a NEURAL FORGE lead qualification engine (V3.0). Analyze content using 3-Step Verification:

**PHASE A — LINGUISTIC DNA:**
Classify syntax as:
- "transactional" → User says "I need", "looking for", "recommend me", "which tool", "help me find"
- "informational" → User asks "how to", "what is", "explain", "tutorial"
- "complaint" → User expresses frustration: "doesn't work", "too expensive", "switched from", "alternative to"
PRIORITY: transactional > complaint > informational. Skip pure informational unless pain is severe.

**PHASE B — PAIN MAPPING (Bleeding Neck Analysis):**
Score the CONSEQUENCE of inaction:
- critical (score 85-100): Revenue loss mentioned, account suspended, data breach, business at risk
- high (score 70-84): Scaling blocked, significant inefficiency, competitor overtaking
- moderate (score 50-69): Mild frustration, exploring options, no urgency
- low (score <50): Casual curiosity, no real pain → SKIP

**PHASE C — TECH STACK DETECTION:**
Extract any tools/platforms mentioned (e.g., "Next.js", "HubSpot", "Gmail", "Instantly", "MongoDB", "OpenAI").
Use this to determine:
- Competitor displacement opportunity (e.g., "Instantly is too expensive" → Woodpecker opportunity)
- Integration fit (e.g., mentions "HubSpot" → CRM-compatible tools)

**NICHE CATEGORIZATION:**
Classify each lead into exactly ONE niche:
- "email_marketing" → cold email, deliverability, outreach, warmup, sequences
- "vector_db" → embeddings, RAG, vector search, similarity, AI infrastructure
- "cybersecurity" → wallet security, phishing, VPN, zero trust, endpoint
- "crm_sales" → CRM, pipeline, lead management, sales automation
- "dev_tools" → deployment, CI/CD, hosting, developer productivity
- "general" → none of the above

Return JSON:
{
  "leads": [
    {
      "title": "brief description of need",
      "content": "relevant text snippet",
      "author": "username if available",
      "relevance_score": 0-100,
      "keywords_matched": ["matched keywords"],
      "intent_type": "transactional|complaint|informational",
      "pain_severity": "critical|high|moderate|low",
      "tech_stack_detected": ["tools mentioned"],
      "niche_category": "email_marketing|vector_db|cybersecurity|crm_sales|dev_tools|general",
      "competitor_displacement": "competitor name if complaint about specific tool, null otherwise"
    }
  ]
}

Only include leads with score >= 50 and intent_type != "informational" (unless pain_severity is "critical").
Keywords to prioritize: ${keywords.join(', ')}
Source type: ${sourceType}`;
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
    // ========== EMERGENCY STOP CHECK ==========
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('brain_enabled, emergency_stop')
      .single();

    if (settings?.emergency_stop || !settings?.brain_enabled) {
      console.log('🛑 System stopped: emergency_stop or brain_disabled');
      return new Response(
        JSON.stringify({ success: false, reason: settings?.emergency_stop ? 'emergency_stop' : 'brain_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🧠 Neural Forge V3.0 — Lead Hunter starting scan...');

    const discoveredLeads: Lead[] = [];
    const sourcesToScan = LEAD_SOURCES.slice(0, 4); // 4 sources per run

    for (const source of sourcesToScan) {
      console.log(`🔍 Scanning: ${source.url}`);

      try {
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

        // V3.0 — 3-Step Verification AI Analysis
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
            'X-Title': 'Neural Forge V3 Lead Hunter',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              { role: 'system', content: buildAnalysisPrompt(source.type, source.keywords) },
              { role: 'user', content: content.slice(0, 15000) },
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
              intent_type: lead.intent_type || 'unknown',
              pain_severity: lead.pain_severity || 'moderate',
              tech_stack_detected: lead.tech_stack_detected || [],
              niche_category: lead.niche_category || 'general',
            });
          }
        }

        console.log(`Found ${leads.length} qualified leads from ${source.url}`);
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error processing ${source.url}:`, error);
      }
    }

    console.log(`Total leads discovered: ${discoveredLeads.length}`);

    // Save leads to database with V3.0 metadata
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

    // Log the hunt with V3.0 niche breakdown
    const nicheBreakdown: Record<string, number> = {};
    discoveredLeads.forEach(l => {
      const cat = l.niche_category || 'general';
      nicheBreakdown[cat] = (nicheBreakdown[cat] || 0) + 1;
    });

    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000002',
      action: 'neural_forge_v3_hunt_completed',
      metadata: {
        version: '3.0',
        sources_scanned: sourcesToScan.length,
        leads_found: discoveredLeads.length,
        high_intent_leads: discoveredLeads.filter(l => l.relevance_score >= 70).length,
        niche_breakdown: nicheBreakdown,
        critical_pain_count: discoveredLeads.filter(l => l.pain_severity === 'critical').length,
        transactional_intent_count: discoveredLeads.filter(l => l.intent_type === 'transactional').length,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        version: '3.0',
        leads_found: discoveredLeads.length,
        high_intent: discoveredLeads.filter(l => l.relevance_score >= 70).length,
        niche_breakdown: nicheBreakdown,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Neural Forge V3 Lead Hunter error:', error);

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
