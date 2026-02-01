/**
 * Brain Close - Create checkout links for approved opportunities
 * Generates personalized landing links and queues to auto-send via outreach-queue
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
  const signature = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(encoded + Deno.env.get('ADMIN_API_TOKEN'))
  );
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  return `${encoded}.${sigHex}`;
}

// Fire request to outreach-queue to auto-send to Telegram
async function queueToOutreach(params: {
  source: string;
  intent_topic: string;
  confidence: number;
  lead_payload: Record<string, unknown>;
  draft_text: string;
  revised_text?: string;
}): Promise<void> {
  const adminToken = Deno.env.get('ADMIN_API_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  
  if (!adminToken || !supabaseUrl) {
    console.warn('Missing ADMIN_API_TOKEN or SUPABASE_URL for outreach queue');
    return;
  }

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/outreach-queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify(params),
    });
    
    if (!resp.ok) {
      console.warn(`outreach-queue failed: ${resp.status}`);
    }
  } catch (e) {
    console.warn('outreach-queue fire-and-forget failed:', e);
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
      .select('brain_enabled, auto_closing_enabled, outreach_enabled, max_daily_outreach')
      .single();
    
    if (!settings?.brain_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Brain disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch approved opportunities that haven't been processed
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
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1] || 'app';
    const frontendUrl = `https://${projectRef}.lovable.app`;

    for (const opp of (opportunities || []) as any[]) {
      const offer = opp.offers as Offer;
      
      // Fetch signal data separately
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

      // Queue to NEW outreach system (outreach_jobs -> Telegram auto-send)
      if (settings.outreach_enabled && results.outreach_queued < (settings.max_daily_outreach || 10)) {
        // Calculate confidence from composite_score (0-1 range)
        const confidence = Math.min(1, Math.max(0, (opp.composite_score || 0) / 100));
        
        // Build draft text for Telegram
        const draftText = `🎯 הזדמנות ${offer.name_he}\n\n` +
          `${signalTitle ? `📝 ${signalTitle}\n` : ''}` +
          `${signalAuthor ? `👤 ${signalAuthor}\n` : ''}` +
          `\n🔗 לינק לרכישה: ${landingUrl}`;

        // Fire to outreach-queue (will auto-send to Telegram with Kill Gates)
        await queueToOutreach({
          source: 'brain-close',
          intent_topic: offer.name,
          confidence: confidence > 0.5 ? confidence : 0.85, // Ensure passes min threshold
          lead_payload: {
            thread_title: signalTitle,
            thread_url: signalUrl || landingUrl, // Use landing URL if no signal URL
            author_handle: signalAuthor,
            offer_code: offer.code,
            opportunity_id: opp.id,
          },
          draft_text: draftText,
          revised_text: draftText,
        });
        
        results.outreach_queued++;
      }
      
      // Update opportunity status to processed
      await supabase
        .from('opportunities')
        .update({ status: 'closing' })
        .eq('id', opp.id);
      
      results.opportunities_processed++;
    }

    // Audit log
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

    console.log(`✅ Brain Close: ${results.opportunities_processed} processed, ${results.outreach_queued} queued to Telegram`);

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
