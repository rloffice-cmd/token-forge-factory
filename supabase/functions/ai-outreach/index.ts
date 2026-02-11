/**
 * AI Outreach System - Value-First M2M Mode
 * Matches signals to partners, generates "Solution Provider" messages
 * with dynamic affiliate links from m2m_partners table.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Partner-specific selling contexts
const PARTNER_CONTEXTS: Record<string, { pain_points: string[]; key_features: string; positioning: string }> = {
  hubspot: {
    pain_points: ["scaling sales", "organizing messy leads", "CRM chaos", "losing track of prospects", "manual follow-ups"],
    key_features: "automated lead management and sales pipeline tracking",
    positioning: "a platform that organizes your entire sales pipeline and automates follow-ups",
  },
  "monday.com": {
    pain_points: ["workflow bottlenecks", "team visibility", "project tracking", "task management", "cross-team coordination"],
    key_features: "visual workflow automation and team collaboration",
    positioning: "a tool that gives your team full visibility on every project with automated workflows",
  },
  vercel: {
    pain_points: ["instant deployment", "serverless performance", "slow CI/CD", "hosting complexity", "frontend scaling"],
    key_features: "zero-config deployment and edge-optimized performance",
    positioning: "a platform that deploys your code instantly with built-in serverless infrastructure",
  },
};

interface SignalLead {
  id?: string;
  source_url: string;
  source_type: string;
  title?: string | null;
  content: string;
  author?: string | null;
  username?: string | null;
  relevance_score: number;
  category?: string | null;
}

interface MatchedPartner {
  id: string;
  name: string;
  affiliate_base_url: string;
  commission_rate: number;
  category_tags: string[];
  keyword_triggers: string[];
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
    const { leads: inputLeads, mode = 'initial' } = await req.json();

    // Get leads to process
    let leadsToProcess: SignalLead[] = inputLeads || [];

    if (!inputLeads) {
      const { data: dbLeads } = await supabase
        .from('leads')
        .select('*')
        .eq('status', 'new')
        .order('relevance_score', { ascending: false })
        .limit(10);
      leadsToProcess = dbLeads || [];
    }

    if (leadsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No leads to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load active M2M partners
    const { data: partners } = await supabase
      .from('m2m_partners')
      .select('*')
      .eq('is_active', true);

    if (!partners || partners.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No active M2M partners configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`📧 Processing ${leadsToProcess.length} leads against ${partners.length} M2M partners...`);

    const results: Array<{ lead_id: string; partner: string; dispatched: boolean }> = [];

    for (const lead of leadsToProcess) {
      // Match lead to best partner via keyword/category overlap
      const matched = matchPartner(lead, partners as MatchedPartner[]);
      if (!matched) {
        console.log(`⏭️ No partner match for: ${lead.title}`);
        continue;
      }

      const partnerKey = matched.name.toLowerCase();
      const context = PARTNER_CONTEXTS[partnerKey] || {
        pain_points: matched.keyword_triggers || [],
        key_features: `solutions in ${matched.category_tags?.join(', ') || 'your area'}`,
        positioning: `a tool that handles ${matched.category_tags?.[0] || 'this'} effectively`,
      };

      // Generate Value-First message via AI
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'M2M Outreach',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            {
              role: 'system',
              content: `You write short, human, non-spammy outreach messages using the "Solution Provider" framework.

STRUCTURE (follow exactly):
1. OBSERVATION: "I saw your [source] about [specific problem]."
2. VALIDATION: "That's a common challenge in [category]."
3. SOLUTION: "I found this [positioning] that specifically handles [key feature]."
4. LINK: {{AFFILIATE_LINK}}
5. SOFT CLOSE: "Thought it might save you some time."

PARTNER CONTEXT for ${matched.name}:
- Pain points to reference: ${context.pain_points.join(', ')}
- Key features: ${context.key_features}
- Positioning: ${context.positioning}

CRITICAL RULES:
- Detect the lead's language and write IN THAT LANGUAGE
- Keep it under 4 sentences (excluding the link line)
- Sound like a helpful peer, NOT a marketer
- NEVER mention commissions, affiliates, or automation
- Reference their SPECIFIC problem from the post
- The link line should be on its own: just the URL, no markdown

Return JSON:
- message: the full outreach message with {{AFFILIATE_LINK}} placeholder
- detected_language: ISO code (en, he, es, de, etc.)
- hook_reason: one sentence on why this message should convert`
            },
            {
              role: 'user',
              content: `Lead:
Source: ${lead.source_type || 'forum'}
Post title: "${lead.title || 'No title'}"
Content: "${(lead.content || '').slice(0, 600)}"
Author: ${lead.author || lead.username || 'Unknown'}
Category: ${lead.category || 'General'}`
            }
          ],
          response_format: { type: 'json_object' },
        }),
      });

      if (!aiResponse.ok) {
        console.warn(`⚠️ AI generation failed for lead: ${lead.title}`);
        continue;
      }

      const aiData = await aiResponse.json();
      const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');

      if (!parsed.message) continue;

      // Inject actual affiliate link
      const finalMessage = parsed.message.replace(/\{\{AFFILIATE_LINK\}\}/g, matched.affiliate_base_url);
      const leadId = lead.id || crypto.randomUUID();

      // Save to outreach queue
      await supabase.from('outreach_queue').insert({
        lead_id: leadId,
        source_url: lead.source_url,
        message_type: 'initial',
        channel: lead.source_type,
        message_content: finalMessage,
        persona: 'solution_provider',
        status: 'queued',
        scheduled_for: new Date().toISOString(),
      });

      // Record in M2M ledger
      await supabase.from('m2m_ledger').insert({
        signal_id: leadId,
        partner_id: matched.id,
        affiliate_link_sent: matched.affiliate_base_url,
        status: 'dispatched',
        estimated_bounty_usd: matched.commission_rate,
      });

      // Update partner dispatch count
      await supabase.rpc('increment_partner_dispatches', { partner_row_id: matched.id }).catch(() => {
        // RPC may not exist yet, fallback silent
      });

      // Update lead status
      if (lead.id) {
        await supabase.from('leads').update({ status: 'contacted' }).eq('id', lead.id);
      }

      results.push({ lead_id: leadId, partner: matched.name, dispatched: true });
      console.log(`✅ Dispatched: ${lead.title} → ${matched.name}`);
    }

    // Schedule follow-ups for dispatched leads (days 2, 5)
    for (const r of results) {
      for (const dayOffset of [2, 5]) {
        const scheduledDate = new Date();
        scheduledDate.setDate(scheduledDate.getDate() + dayOffset);
        await supabase.from('outreach_queue').insert({
          lead_id: r.lead_id,
          message_type: dayOffset === 2 ? 'follow_up_1' : 'follow_up_2',
          channel: 'auto',
          status: 'scheduled',
          scheduled_for: scheduledDate.toISOString(),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        leads_processed: leadsToProcess.length,
        dispatched: results.length,
        partners_used: [...new Set(results.map(r => r.partner))],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('AI Outreach error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/** Match a lead to the best M2M partner by keyword/category overlap */
function matchPartner(lead: SignalLead, partners: MatchedPartner[]): MatchedPartner | null {
  const text = `${lead.title || ''} ${lead.content || ''} ${lead.category || ''}`.toLowerCase();
  let bestMatch: MatchedPartner | null = null;
  let bestScore = 0;

  for (const p of partners) {
    let score = 0;
    // Check keyword triggers
    for (const kw of (p.keyword_triggers || [])) {
      if (text.includes(kw.toLowerCase())) score += 3;
    }
    // Check category tags
    for (const tag of (p.category_tags || [])) {
      if (text.includes(tag.toLowerCase())) score += 2;
    }
    // Check partner name
    if (text.includes(p.name.toLowerCase())) score += 5;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
    }
  }

  // Fallback: if no keyword match, pick highest commission partner
  if (!bestMatch && partners.length > 0) {
    bestMatch = partners.reduce((a, b) => a.commission_rate > b.commission_rate ? a : b);
  }

  return bestMatch;
}
