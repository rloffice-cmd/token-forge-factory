/**
 * AI Outreach V3.0 — Value-Bridge Response Framework
 * The Mirror → The Insight → The Bridge → The Transparent CTA
 * Cross-asset bundle logic + competitor displacement scripts
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// V4.0 Partner contexts with competitor displacement triggers
const PARTNER_CONTEXTS: Record<string, {
  pain_points: string[];
  key_features: string;
  positioning: string;
  competitors: string[];
  displacement_hook: string;
}> = {
  woodpecker: {
    pain_points: ["cold email deliverability", "emails landing in spam", "low reply rates", "scaling outbound", "email warmup", "follow-up sequences", "inbox placement", "gmail suspended", "bounce rate"],
    key_features: "automated cold email sequences with built-in deliverability optimization, email warmup, and A/B testing",
    positioning: "a cold email platform that keeps your emails out of spam and automates multi-step follow-ups with real deliverability intelligence",
    competitors: ["instantly", "lemlist", "mailshake", "apollo", "smartlead"],
    displacement_hook: "Unlike alternatives that often get flagged, Woodpecker uses real inbox rotation and warmup algorithms that maintain sender reputation at scale",
  },
  "adturbo ai": {
    pain_points: ["ad spend optimization", "ROAS", "facebook ads", "google ads", "paid media", "ad campaign management", "PPC", "advertising budget", "ad fatigue", "creative testing"],
    key_features: "AI-powered ad optimization that automates campaign management, creative testing, and budget allocation across platforms",
    positioning: "an AI advertising platform that maximizes ROAS by automatically optimizing ad spend and creatives across channels",
    competitors: ["revealbot", "adroll", "madgicx", "smartly.io", "adespresso"],
    displacement_hook: "AdTurbo's AI analyzes creative performance in real-time and reallocates budget to top performers before you waste ad spend",
  },
  "lucro crm": {
    pain_points: ["CRM chaos", "losing track of leads", "sales pipeline", "deal tracking", "follow-up management", "contact management", "sales funnel", "closing deals", "lead organization"],
    key_features: "streamlined CRM with visual pipeline management, automated follow-ups, and deal intelligence",
    positioning: "a modern CRM that helps sales teams close more deals with less manual work through smart automation and pipeline visibility",
    competitors: ["hubspot", "pipedrive", "salesforce", "close.com", "freshsales"],
    displacement_hook: "Lucro CRM gives you enterprise-grade pipeline management without the enterprise price tag or setup complexity",
  },
  easyfund: {
    pain_points: ["fundraising", "nonprofit funding", "donations", "crowdfunding", "grant applications", "charity management", "community funding", "social impact", "NGO operations"],
    key_features: "all-in-one fundraising platform for nonprofits with donor management, campaign tools, and payment processing",
    positioning: "a fundraising platform that helps nonprofits and community organizations raise more with less effort",
    competitors: ["gofundme", "donorbox", "classy", "givebutter", "fundly"],
    displacement_hook: "EasyFund combines donor CRM, campaign pages, and payment processing in one tool — no integrations needed",
  },
  emaillistverify: {
    pain_points: ["email bounce rate", "invalid emails", "email list cleaning", "hard bounces", "spam traps", "catch-all detection", "disposable emails", "email verification", "list hygiene", "email deliverability", "cold outreach", "marketing emails"],
    key_features: "bulk email list verification with 99% accuracy, real-time API, spam trap and disposable email detection",
    positioning: "an email verification service that cleans your list before you send, eliminating bounces and protecting sender reputation",
    competitors: ["neverbounce", "zerobounce", "debounce", "kickbox", "hunter.io"],
    displacement_hook: "EmailListVerify processes lists faster at a fraction of the cost, with pay-as-you-go pricing and no monthly commitments",
  },
  compass: {
    pain_points: ["ecommerce analytics", "scaling online store", "b2b growth", "conversion tracking", "revenue optimization", "product performance", "ecommerce scaling", "growth metrics", "sales analytics"],
    key_features: "AI-powered eCommerce analytics platform for B2B growth, product intelligence, and revenue optimization",
    positioning: "an analytics platform that gives eCommerce teams the intelligence they need to scale revenue and optimize product performance",
    competitors: ["google analytics", "mixpanel", "amplitude", "triple whale", "northbeam"],
    displacement_hook: "Compass delivers actionable eCommerce insights out of the box, without the complexity of generic analytics tools",
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
  intent_type?: string;
  pain_severity?: string;
  tech_stack_detected?: string[];
  niche_category?: string;
  competitor_displacement?: string | null;
}

interface MatchedPartner {
  id: string;
  name: string;
  affiliate_base_url: string;
  commission_rate: number;
  category_tags: string[];
  keyword_triggers: string[];
}

// V3.0 Value-Bridge prompt builder
function buildValueBridgePrompt(partner: MatchedPartner, context: typeof PARTNER_CONTEXTS[string], lead: SignalLead): string {
  const isDisplacement = lead.competitor_displacement && context.competitors.includes(lead.competitor_displacement.toLowerCase());

  return `You write outreach using the VALUE-BRIDGE forensic framework. You are a technical consultant, not a marketer.

**THE VALUE-BRIDGE STRUCTURE (follow exactly):**

1. **THE MIRROR** — Acknowledge their exact pain using THEIR OWN words/terminology from the post. Show you understand the specific problem, not a generic version of it.

2. **THE INSIGHT** — Provide one genuinely useful technical nugget they can act on immediately, even without clicking your link. This builds credibility. Examples: a config tip, a best practice, a metric benchmark.

3. **THE BRIDGE** — Naturally connect your insight to ${partner.name}'s specific capability. Frame it as "this is why [feature] matters for your specific case" not "buy this tool."
${isDisplacement ? `\n4. **DISPLACEMENT ANGLE** — The user mentioned frustration with ${lead.competitor_displacement}. Address their specific complaint and explain how ${partner.name} solves it differently: ${context.displacement_hook}` : ''}

4. **THE TRANSPARENT CTA** — Place {{AFFILIATE_LINK}} on its own line. Frame as "I've vetted this for similar use cases" or "This specifically handles the [problem] you described."

**PARTNER INTEL for ${partner.name}:**
- Pain points: ${context.pain_points.join(', ')}
- Key capability: ${context.key_features}
- Positioning: ${context.positioning}
${lead.tech_stack_detected?.length ? `- Their detected stack: ${lead.tech_stack_detected.join(', ')} — reference integration compatibility if relevant` : ''}

**CRITICAL RULES:**
- Detect lead's language → write IN THAT LANGUAGE
- Max 5 sentences + the link line
- Sound like a peer who's solved this problem before
- NEVER mention commissions, affiliates, partnerships, or automation
- Reference SPECIFIC details from their post (names, numbers, tools they mentioned)
- The insight must be genuinely useful standalone advice
- Link line: just the URL, no markdown formatting

Return JSON:
{
  "message": "full outreach with {{AFFILIATE_LINK}} placeholder",
  "detected_language": "ISO code",
  "hook_reason": "why this should convert",
  "intent_classification": "transactional|complaint|informational",
  "pain_level": "critical|high|moderate"
}`;
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

    // SELECTIVE OUTREACH: Only dispatch for approved partners
    const OUTREACH_ENABLED_PARTNERS = ['woodpecker', 'emaillistverify', 'compass', 'adturbo ai', 'lucro crm', 'easyfund'];
    const outreachPartners = partners.filter(p =>
      OUTREACH_ENABLED_PARTNERS.includes(p.name.toLowerCase())
    );

    console.log(`🧠 Neural Forge V3.0 — Processing ${leadsToProcess.length} leads against ${outreachPartners.length} outreach-enabled partners...`);

    const results: Array<{ lead_id: string; partner: string; dispatched: boolean; niche: string }> = [];

    for (const lead of leadsToProcess) {
      const matched = matchPartner(lead, outreachPartners as MatchedPartner[]);
      if (!matched) {
        console.log(`⏭️ No partner match for: ${lead.title}`);
        continue;
      }

      const partnerKey = matched.name.toLowerCase();
      const context = PARTNER_CONTEXTS[partnerKey] || {
        pain_points: matched.keyword_triggers || [],
        key_features: `solutions in ${matched.category_tags?.join(', ') || 'your area'}`,
        positioning: `a tool that handles ${matched.category_tags?.[0] || 'this'} effectively`,
        competitors: [],
        displacement_hook: '',
      };

      // V3.0 — Value-Bridge AI generation
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Neural Forge V3 Outreach',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: buildValueBridgePrompt(matched, context, lead) },
            {
              role: 'user',
              content: `Lead Analysis:
Source: ${lead.source_type || 'forum'}
Post title: "${lead.title || 'No title'}"
Content: "${(lead.content || '').slice(0, 800)}"
Author: ${lead.author || lead.username || 'Unknown'}
Category: ${lead.category || lead.niche_category || 'General'}
Intent: ${lead.intent_type || 'unknown'}
Pain Level: ${lead.pain_severity || 'unknown'}
Tech Stack: ${(lead.tech_stack_detected || []).join(', ') || 'Not detected'}
Competitor Mentioned: ${lead.competitor_displacement || 'None'}`
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

      const finalMessage = parsed.message.replace(/\{\{AFFILIATE_LINK\}\}/g, matched.affiliate_base_url);
      const leadId = lead.id || crypto.randomUUID();

      // Save to outreach queue
      await supabase.from('outreach_queue').insert({
        lead_id: leadId,
        source_url: lead.source_url,
        message_type: 'initial',
        channel: lead.source_type,
        message_content: finalMessage,
        persona: 'value_bridge_v3',
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
      await supabase.rpc('increment_partner_dispatches', { partner_row_id: matched.id }).catch(() => {});

      // Update lead status
      if (lead.id) {
        await supabase.from('leads').update({ status: 'contacted' }).eq('id', lead.id);
      }

      // Trigger Resend email if lead has email
      const leadEmail = (lead as Record<string, unknown>).email as string | undefined;
      if (leadEmail && ['adturbo ai', 'lucro crm', 'emaillistverify', 'easyfund'].includes(partnerKey)) {
        supabase.functions.invoke('automated-outreach', {
          body: {
            lead_email: leadEmail,
            lead_name: lead.author || lead.username || undefined,
            lead_id: leadId,
            partner_name: matched.name,
            email_body: finalMessage.replace(/\n/g, '<br/>'),
            affiliate_url: matched.affiliate_base_url,
          },
        }).catch(err => console.warn(`⚠️ Resend email trigger failed: ${err}`));
      }

      results.push({
        lead_id: leadId,
        partner: matched.name,
        dispatched: true,
        niche: lead.niche_category || 'general',
      });
      console.log(`✅ V3 Dispatched: ${lead.title} → ${matched.name} [${lead.intent_type}/${lead.pain_severity}]`);
    }

    // Schedule follow-ups (days 2, 5)
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
        version: '3.0',
        leads_processed: leadsToProcess.length,
        dispatched: results.length,
        partners_used: [...new Set(results.map(r => r.partner))],
        niche_breakdown: results.reduce((acc, r) => {
          acc[r.niche] = (acc[r.niche] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Neural Forge V3 Outreach error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/** V4.2 — Greedy EV-based partner matching with competitor displacement */
function matchPartner(lead: SignalLead, partners: MatchedPartner[]): MatchedPartner | null {
  const text = `${lead.title || ''} ${lead.content || ''} ${lead.category || ''} ${lead.niche_category || ''}`.toLowerCase();

  const scored = partners.map(p => {
    let techScore = 0;
    for (const kw of (p.keyword_triggers || [])) {
      if (text.includes(kw.toLowerCase())) techScore += 3;
    }
    for (const tag of (p.category_tags || [])) {
      if (text.includes(tag.toLowerCase())) techScore += 2;
    }
    if (text.includes(p.name.toLowerCase())) techScore += 5;

    // Competitor displacement bonus
    const ctx = PARTNER_CONTEXTS[p.name.toLowerCase()];
    if (ctx?.competitors) {
      for (const comp of ctx.competitors) {
        if (text.includes(comp.toLowerCase())) techScore += 4;
      }
    }

    // EV = (Tech * 0.3) + (Commission * 0.5) + (CTR * 0.2)
    const commission = p.commission_rate || 0;
    let ev = (Math.min(techScore / 10, 1) * 0.3) + (commission * 0.5) + (0.03 * 100 * 0.2);
    
    // Woodpecker +25% boost
    if (p.name.toLowerCase() === 'woodpecker') ev *= 1.25;

    return { partner: p, ev, techScore };
  });

  scored.sort((a, b) => b.ev - a.ev);
  if (scored.length > 0 && scored[0].techScore > 0) return scored[0].partner;

  // Fallback: highest commission partner
  if (partners.length > 0) {
    return partners.reduce((a, b) => a.commission_rate > b.commission_rate ? a : b);
  }
  return null;
}
