/**
 * Brain Close - Create checkout links for approved opportunities
 * Generates personalized landing links for self-serve conversion
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Offer {
  id: string;
  code: string;
  name: string;
  name_he: string;
  pricing_model: Record<string, { price: number }>;
}

// Generate signed token for landing link
async function generateSignedToken(data: Record<string, string>): Promise<string> {
  const payload = JSON.stringify(data);
  const encoded = btoa(payload);
  // Simple signature for now - in production use proper HMAC
  const signature = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(encoded + Deno.env.get('ADMIN_API_TOKEN'))
  );
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  return `${encoded}.${sigHex}`;
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
      .select('brain_enabled, auto_closing_enabled, outreach_enabled, max_daily_outreach')
      .single();
    
    if (!settings?.brain_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Brain disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch approved opportunities that haven't been processed
    // Note: No join with demand_signals - we'll fetch separately
    const { data: opportunities, error: oppError } = await supabase
      .from('opportunities')
      .select(`*, offers(*)`)
      .eq('status', 'approved')
      .order('composite_score', { ascending: false })
      .limit(20);
    
    if (oppError) throw oppError;

    const results = {
      opportunities_processed: 0,
      links_generated: 0,
      outreach_queued: 0
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // Build the frontend URL from project ref
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] || 'app';
    const frontendUrl = `https://${projectRef}.lovable.app`;

    for (const opp of (opportunities || []) as any[]) {
      const offer = opp.offers as Offer;
      
      // Fetch signal data separately (no FK constraint exists)
      let signalTitle = '';
      let signalUrl = '';
      let signalAuthor = '';
      
      if (opp.signal_id_v2) {
        const { data: signalData } = await supabase
          .from('demand_signals')
          .select('id, query_text, source_url, payload_json')
          .eq('id', opp.signal_id_v2)
          .single();
        
        if (signalData) {
          signalTitle = signalData.query_text || '';
          signalUrl = signalData.source_url || '';
          signalAuthor = signalData.payload_json?.author || '';
        }
      }
      
      if (!offer) continue;

      // Generate signed landing link
      const token = await generateSignedToken({
        opp: opp.id,
        offer: offer.code,
        src: 'brain',
        ts: Date.now().toString()
      });
      
      // Landing URL (pointing to the app's landing page)
      const landingUrl = `${frontendUrl}/landing?offer=${offer.code}&t=${token}`;
      
      // Record closing attempt
      await supabase.from('closing_attempts').insert({
        opportunity_id: opp.id,
        action: 'link_generated',
        checkout_url: landingUrl,
        result: 'pending',
        metadata_json: {
          offer_code: offer.code,
          signal_title: signalTitle,
          signal_url: signalUrl,
          score: opp.composite_score
        }
      });
      
      results.links_generated++;

      // Queue outreach if enabled - always queue even without author
      if (settings.outreach_enabled && results.outreach_queued < (settings.max_daily_outreach || 10)) {
        // First, create or find a lead for this opportunity
        let leadId = null;
        
        // Check if lead already exists for this signal URL
        if (signalUrl) {
          const { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .eq('source_url', signalUrl)
            .maybeSingle();
          
          if (existingLead) {
            leadId = existingLead.id;
          }
        }
        
        // Create new lead if not found
        if (!leadId) {
          const { data: newLead, error: leadError } = await supabase
            .from('leads')
            .insert({
              source: 'brain',
              source_url: signalUrl || null,
              title: signalTitle || offer.name,
              content: `Opportunity for ${offer.name}`,
              author: signalAuthor || null,
              relevance_score: opp.composite_score * 100,
              status: 'new'
            })
            .select('id')
            .single();
          
          if (!leadError && newLead) {
            leadId = newLead.id;
          }
        }
        
        if (leadId) {
          // Generate outreach message for this opportunity
          const outreachMessage = signalAuthor && signalAuthor.length > 0
            ? `בדיקה מהירה: ${offer.name_he} יכול לעזור לך. נסה חינם: ${landingUrl}`
            : `מצאנו פתרון לבעיה שלך: ${offer.name_he}. קבל גישה כאן: ${landingUrl}`;
          
          await supabase.from('outreach_queue').insert({
            lead_id: leadId,
            channel: signalUrl ? 'comment' : 'direct',
            message_body: outreachMessage,
            subject: offer.name_he,
            status: 'queued',
            priority: Math.round(opp.composite_score * 10),
            source_url: signalUrl || null,
            generation_metadata: {
              opportunity_id: opp.id,
              offer_code: offer.code,
              landing_url: landingUrl,
              signal_title: signalTitle
            }
          });
          
          results.outreach_queued++;
        }
      }
      
      results.opportunities_processed++;
    }

    // Audit log - use valid job_id
    const { data: validJob } = await supabase
      .from('jobs')
      .select('id')
      .limit(1)
      .single();
    
    if (validJob) {
      await supabase.from('audit_logs').insert({
        job_id: validJob.id,
        action: 'brain-close:completed',
        metadata: results
      });
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Brain close error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
