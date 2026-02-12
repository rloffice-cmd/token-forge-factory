/**
 * Lead Packager — Converts raw leads into anonymized marketplace listings
 * Pricing: Score 80-89 = $25 (Silver), Score 90-100 = $60 (Gold)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculatePrice(score: number): { price: number; tier: string } {
  if (score >= 90) return { price: 60, tier: 'gold' };
  return { price: 25, tier: 'silver' };
}

function buildTeaserPrompt(): string {
  return `You are a Lead Broker copywriter. Create an anonymized sales teaser for a lead.

Rules:
- NEVER reveal the company name, author name, or exact URL
- Describe the pain point in compelling business language
- Mention industry/niche and scale indicators
- Create urgency without being spammy
- Keep it under 280 characters

Return JSON: { "teaser": "string", "niche_label": "string" }`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const cronSecret = req.headers.get('x-cron-secret');
  const adminToken = req.headers.get('x-admin-token');
  const expectedCron = Deno.env.get('CRON_SECRET');
  const expectedAdmin = Deno.env.get('ADMIN_API_TOKEN');

  if (cronSecret !== expectedCron && adminToken !== expectedAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

  try {
    // Fetch unpackaged leads with score >= 80
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .gte('relevance_score', 80)
      .eq('status', 'new')
      .limit(20);

    if (error) throw error;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ success: true, packaged: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let packaged = 0;

    for (const lead of leads) {
      const { price, tier } = calculatePrice(lead.relevance_score);

      // Generate anonymized teaser via AI
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Lead Packager',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: buildTeaserPrompt() },
            { role: 'user', content: `Title: ${lead.title}\nContent: ${(lead.content || '').slice(0, 2000)}\nSource: ${lead.source_type}\nKeywords: ${(lead.keywords_matched || []).join(', ')}` },
          ],
          response_format: { type: 'json_object' },
        }),
      });

      let teaser = `High-intent lead in ${lead.source_type} — score ${lead.relevance_score}/100`;
      let nicheLabel = 'general';

      if (aiResponse.ok) {
        try {
          const aiData = await aiResponse.json();
          const parsed = JSON.parse(aiData.choices?.[0]?.message?.content || '{}');
          if (parsed.teaser) teaser = parsed.teaser;
          if (parsed.niche_label) nicheLabel = parsed.niche_label;
        } catch { /* use fallback */ }
      }

      // Extract tech stack from keywords
      const techStack = (lead.keywords_matched || []).filter((k: string) =>
        /^[A-Z]/.test(k) || ['react', 'python', 'node', 'aws', 'gcp'].includes(k.toLowerCase())
      );

      const { error: insertError } = await supabase.from('lead_marketplace').insert({
        lead_id: lead.id,
        niche: nicheLabel,
        pain_description: teaser,
        teaser,
        tech_stack: techStack,
        smart_score: lead.relevance_score,
        price_usd: price,
        tier,
        status: 'available',
        full_data: {
          title: lead.title,
          content: lead.content,
          author: lead.author,
          source_url: lead.source_url,
          source_type: lead.source_type,
          keywords_matched: lead.keywords_matched,
        },
      });

      if (!insertError) {
        await supabase.from('leads').update({ status: 'packaged' }).eq('id', lead.id);
        packaged++;
      }

      await new Promise(r => setTimeout(r, 500));
    }

    // Log to audit
    await supabase.from('audit_logs').insert({
      job_id: 'a0000000-0000-0000-0000-000000000002',
      action: 'lead_packager_completed',
      metadata: { packaged, total_leads: leads.length },
    });

    return new Response(JSON.stringify({ success: true, packaged }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
