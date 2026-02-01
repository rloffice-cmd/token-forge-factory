/**
 * Brain Score - Signal Scoring & Opportunity Creation
 * Analyzes signals and creates opportunities with scores
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Signal {
  id: string;
  source_id: string;
  title: string;
  raw_text: string;
  url: string;
  intent_type: string;
  confidence: number;
  created_at: string;
}

interface Offer {
  id: string;
  code: string;
  keywords: string[];
  min_value_usd: number;
  pricing_model: Record<string, { price: number }>;
}

// Score a signal for an offer
function scoreSignal(signal: Signal, offer: Offer, sourceHealthScore: number): number {
  let score = 0;
  const text = `${signal.title} ${signal.raw_text}`.toLowerCase();
  
  // Keyword match scoring
  const matchedKeywords = offer.keywords.filter(kw => text.includes(kw.toLowerCase()));
  score += Math.min(0.3, matchedKeywords.length * 0.05);
  
  // Intent type scoring
  if (offer.code === 'risk-api' && signal.intent_type === 'risk_scoring') {
    score += 0.25;
  } else if (offer.code === 'webhook-monitor' && ['replay_webhook', 'bug_webhook'].includes(signal.intent_type)) {
    score += 0.25;
  }
  
  // "Need" verbs boost
  const needVerbs = ['looking for', 'need', 'searching', 'any tool', 'recommend', 'help'];
  if (needVerbs.some(v => text.includes(v))) {
    score += 0.15;
  }
  
  // Urgency boost
  const urgencyWords = ['urgent', 'asap', 'immediately', 'critical', 'production', 'live'];
  if (urgencyWords.some(w => text.includes(w))) {
    score += 0.1;
  }
  
  // Recency boost (newer = higher)
  const ageHours = (Date.now() - new Date(signal.created_at).getTime()) / (1000 * 60 * 60);
  if (ageHours < 6) score += 0.1;
  else if (ageHours < 24) score += 0.05;
  
  // Source health boost
  score += sourceHealthScore * 0.1;
  
  // Base confidence from signal
  score += signal.confidence * 0.1;
  
  return Math.min(1.0, Math.max(0, score));
}

// Estimate value based on offer and score
function estimateValue(offer: Offer, score: number): number {
  // Use starter price as baseline
  const pricing = offer.pricing_model;
  const starterPrice = pricing?.starter?.price || pricing?.micro?.price || offer.min_value_usd;
  
  // Higher score = higher estimated value
  return starterPrice * (0.5 + score);
}

// Match signal to best offer
function matchOffer(signal: Signal, offers: Offer[]): Offer | null {
  const text = `${signal.title} ${signal.raw_text}`.toLowerCase();
  
  // Risk API keywords
  if (signal.intent_type === 'risk_scoring' || 
      /wallet|contract|scam|malicious|fraud|phishing|audit|security/i.test(text)) {
    return offers.find(o => o.code === 'risk-api') || null;
  }
  
  // Webhook monitor keywords
  if (['replay_webhook', 'bug_webhook'].includes(signal.intent_type) ||
      /webhook|replay|retry|signature|verify|events/i.test(text)) {
    return offers.find(o => o.code === 'webhook-monitor') || null;
  }
  
  return null;
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
      .select('brain_enabled, auto_approve_threshold, min_opportunity_value_usd')
      .single();
    
    if (!settings?.brain_enabled) {
      await supabase.from('audit_logs').insert({
        job_id: '00000000-0000-0000-0000-000000000000',
        action: 'brain-score:skipped',
        metadata: { reason: 'brain_enabled is false' }
      });
      
      return new Response(
        JSON.stringify({ success: false, reason: 'Brain disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch unprocessed signals from last 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: signals, error: signalsError } = await supabase
      .from('demand_signals')
      .select('*, offer_sources(health_score)')
      .eq('status', 'new')
      .gte('created_at', cutoff)
      .limit(50);
    
    if (signalsError) throw signalsError;

    // Fetch active offers
    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('*')
      .eq('is_active', true);
    
    if (offersError) throw offersError;

    const results = {
      signals_processed: 0,
      opportunities_created: 0,
      auto_approved: 0
    };

    for (const signal of signals || []) {
      const offer = matchOffer(signal as Signal, offers as Offer[]);
      
      if (!offer) {
        // Mark as processed but no opportunity
        await supabase
          .from('demand_signals')
          .update({ status: 'rejected', rejection_reason: 'no_matching_offer' })
          .eq('id', signal.id);
        results.signals_processed++;
        continue;
      }

      // Check if opportunity already exists
      const { data: existing } = await supabase
        .from('opportunities')
        .select('id')
        .eq('signal_id_v2', signal.id)
        .eq('offer_id', offer.id)
        .maybeSingle();
      
      if (existing) {
        await supabase
          .from('demand_signals')
          .update({ status: 'processed' })
          .eq('id', signal.id);
        continue;
      }

      const sourceHealthScore = signal.offer_sources?.health_score || 0.5;
      const score = scoreSignal(signal as Signal, offer as Offer, sourceHealthScore);
      const estValue = estimateValue(offer as Offer, score);
      
      // Auto-approve if meets threshold
      const autoApprove = score >= (settings.auto_approve_threshold || 0.8) && 
                          estValue >= (settings.min_opportunity_value_usd || 20);
      
      // Create opportunity
      const { error: insertError } = await supabase
        .from('opportunities')
        .insert({
          signal_id_v2: signal.id,
          signal_id: signal.id, // Also set legacy field
          offer_id: offer.id,
          composite_score: score,
          est_value_usd: estValue,
          expected_value_usd: estValue,
          status: autoApprove ? 'approved' : 'pending',
          auto_approved: autoApprove,
          approved_at: autoApprove ? new Date().toISOString() : null
        });
      
      if (!insertError) {
        results.opportunities_created++;
        if (autoApprove) results.auto_approved++;
      }

      // Mark signal as processed
      await supabase
        .from('demand_signals')
        .update({ status: 'processed' })
        .eq('id', signal.id);
      
      results.signals_processed++;
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      job_id: '00000000-0000-0000-0000-000000000000',
      action: 'brain-score:completed',
      metadata: results
    });

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Brain score error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
