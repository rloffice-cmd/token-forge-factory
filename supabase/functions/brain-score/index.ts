/**
 * Brain Score - Trust-Gated Signal Scoring
 * Implements the MASTER PROMPT trust gates and pain scoring
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  classifyIntent,
  isActionableIntent,
  calculatePainScore,
  PAIN_THRESHOLD,
  TRUST_GATES,
  TRUST_CAP,
  canCreateCheckout,
  FREE_VALUE_EVENTS,
} from '../_shared/master-prompt-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Signal {
  id: string;
  source_id: string;
  query_text: string;
  source_url: string;
  payload_json: Record<string, unknown>;
  urgency_score: number;
  relevance_score: number;
  category: string;
  created_at: string;
}

interface Offer {
  id: string;
  code: string;
  keywords: string[];
  min_value_usd: number;
  pricing_model: Record<string, { price: number }>;
}

// Score signal using Trust-Gated logic
function scoreSignal(signal: Signal, offer: Offer, sourceHealthScore: number): {
  score: number;
  painScore: number;
  trustAction: string;
  canCheckout: boolean;
} {
  const text = `${signal.query_text || ''} ${JSON.stringify(signal.payload_json || {})}`.toLowerCase();
  
  // 1. Intent Classification
  const intent = classifyIntent(text);
  const isActionable = isActionableIntent(intent);
  
  if (!isActionable) {
    return { score: 0, painScore: 0, trustAction: 'BLOCK', canCheckout: false };
  }
  
  // 2. Pain Score
  const painScore = calculatePainScore(text);
  
  if (painScore < PAIN_THRESHOLD) {
    return { score: painScore / 100, painScore, trustAction: 'SILENT', canCheckout: false };
  }
  
  // 3. Buying Signal Detection
  const buyingSignalKeywords = ['any tool', 'recommend', 'how can i', 'is there a way', 'looking for', 'need'];
  const hasBuyingSignal = buyingSignalKeywords.some(kw => text.includes(kw));
  
  // 4. Trust Estimation (simplified - real trust needs interaction history)
  // For new signals, start with medium trust
  let estimatedTrust = 50;
  
  // Boost trust if source is healthy
  estimatedTrust += sourceHealthScore * 20;
  
  // Reduce trust if panic language detected
  const panicWords = ['urgent', 'help', 'please', 'asap', 'now'];
  if (panicWords.some(w => text.includes(w))) {
    estimatedTrust -= 10;
  }
  
  // 🔒 TRUST CAP: Cap at no_history_max for new signals (no interaction history)
  // interactionCount = 0 for new signals from external sources
  const interactionCount = 0; // New signal = no history
  if (interactionCount < TRUST_CAP.min_interactions_for_paid) {
    estimatedTrust = Math.min(estimatedTrust, TRUST_CAP.no_history_max);
  }
  
  // Determine trust action
  let trustAction: 'BLOCK' | 'FREE_ONLY' | 'PAID_OK';
  if (estimatedTrust < TRUST_GATES.BLOCK_PAYMENT) {
    trustAction = 'BLOCK';
  } else if (estimatedTrust < TRUST_GATES.PAID_ALLOWED) {
    trustAction = 'FREE_ONLY';
  } else {
    trustAction = 'PAID_OK';
  }
  
  // 5. Can Create Checkout? (now includes interactionCount check)
  const canCheckout = canCreateCheckout(painScore, hasBuyingSignal, estimatedTrust, interactionCount);
  
  // 6. Calculate composite score
  let compositeScore = 0;
  
  // Base pain contribution (40%)
  compositeScore += (painScore / 100) * 0.4;
  
  // Buying signal (20%)
  if (hasBuyingSignal) compositeScore += 0.2;
  
  // Trust level (20%)
  compositeScore += (estimatedTrust / 100) * 0.2;
  
  // Source health (10%)
  compositeScore += sourceHealthScore * 0.1;
  
  // Keyword match (10%)
  const matchedKeywords = offer.keywords.filter(kw => text.includes(kw.toLowerCase()));
  compositeScore += Math.min(0.1, matchedKeywords.length * 0.02);
  
  return {
    score: Math.min(1.0, Math.max(0, compositeScore)),
    painScore,
    trustAction,
    canCheckout,
  };
}

// Match signal to best offer
function matchOffer(signal: Signal, offers: Offer[]): Offer | null {
  const text = `${signal.query_text || ''} ${JSON.stringify(signal.payload_json || {})}`.toLowerCase();
  const category = (signal.category || '').toLowerCase();
  
  let bestOffer: Offer | null = null;
  let bestScore = 0;
  
  for (const offer of offers) {
    let score = 0;
    
    for (const keyword of offer.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    
    if (category && offer.keywords.some(kw => category.includes(kw.toLowerCase()))) {
      score += 2;
    }
    
    // Risk-related matching
    if (offer.code === 'risk-api') {
      if (/risk|vulnerab|threat|attack|exploit|hack|phish|fraud|scam|malicious|drainer|honeypot/i.test(text)) {
        score += 3;
      }
      if (/crypto|blockchain|web3|defi|nft|token|smart\s*contract|wallet/i.test(text)) {
        score += 1;
      }
    }
    
    // Webhook-related matching
    if (offer.code === 'webhook-monitor') {
      if (/webhook|callback|endpoint|integration|debug.*api|api.*debug/i.test(text)) {
        score += 3;
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestOffer = offer;
    }
  }
  
  return bestScore >= 2 ? bestOffer : null;
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
      auto_approved: 0,
      blocked_low_trust: 0,
      blocked_low_pain: 0,
    };

    for (const signal of signals || []) {
      const offer = matchOffer(signal as Signal, offers as Offer[]);
      
      if (!offer) {
        await supabase
          .from('demand_signals')
          .update({ status: 'rejected', rejection_reason: 'no_matching_offer' })
          .eq('id', signal.id);
        results.signals_processed++;
        continue;
      }

      // Check for existing opportunity
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
      const { score, painScore, trustAction, canCheckout } = scoreSignal(
        signal as Signal, 
        offer as Offer, 
        sourceHealthScore
      );
      
      // Apply trust gates
      if (trustAction === 'BLOCK') {
        await supabase
          .from('demand_signals')
          .update({ status: 'rejected', rejection_reason: 'trust_too_low' })
          .eq('id', signal.id);
        results.blocked_low_trust++;
        results.signals_processed++;
        continue;
      }
      
      if (painScore < PAIN_THRESHOLD) {
        await supabase
          .from('demand_signals')
          .update({ status: 'rejected', rejection_reason: 'pain_below_threshold' })
          .eq('id', signal.id);
        results.blocked_low_pain++;
        results.signals_processed++;
        continue;
      }
      
      // Estimate value
      const pricing = offer.pricing_model;
      const starterPrice = pricing?.starter?.price || pricing?.micro?.price || offer.min_value_usd;
      const estValue = starterPrice * (0.5 + score);
      
      // Only auto-approve if checkout is allowed
      const autoApprove = canCheckout && 
                          score >= (settings.auto_approve_threshold || 0.8) && 
                          estValue >= (settings.min_opportunity_value_usd || 20);
      
      // Create opportunity with trust metadata
      const { error: insertError } = await supabase
        .from('opportunities')
        .insert({
          signal_id_v2: signal.id,
          signal_id: signal.id,
          offer_id: offer.id,
          composite_score: score,
          est_value_usd: estValue,
          expected_value_usd: estValue,
          status: autoApprove ? 'approved' : (trustAction === 'FREE_ONLY' ? 'free_value' : 'pending'),
          auto_approved: autoApprove,
          approved_at: autoApprove ? new Date().toISOString() : null,
          metadata: {
            pain_score: painScore,
            trust_action: trustAction,
            can_checkout: canCheckout,
            scoring_version: 'trust_gated_v1',
          },
        });
      
      if (!insertError) {
        results.opportunities_created++;
        if (autoApprove) results.auto_approved++;
      }

      await supabase
        .from('demand_signals')
        .update({ status: 'processed' })
        .eq('id', signal.id);
      
      results.signals_processed++;
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
        action: 'brain-score:trust-gated',
        metadata: results
      });
    }

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
