/**
 * Opportunity Scorer - מנקד ומסנן הזדמנויות
 * 
 * לוקח signals חדשים ומחשב:
 * - composite_score (ציון משוקלל)
 * - התאמה ל-offers קיימים
 * - risk_flags (סיכונים)
 * 
 * Kill Gates:
 * - מדלג על signals עם relevance נמוך מ-0.3
 * - פוסל signals מקטגוריות אסורות
 * - לא יוצר opportunity ללא offer מתאים
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DemandSignal {
  id: string;
  query_text: string;
  payload_json: Record<string, unknown>;
  urgency_score: number;
  relevance_score: number;
  category: string;
}

interface Offer {
  id: string;
  name: string;
  keywords: string[];
  min_value_usd: number;
  pack_id: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Get config values
    const { data: configs } = await supabase
      .from('engine_config')
      .select('config_key, config_value')
      .in('config_key', ['auto_approve_threshold', 'min_opportunity_value_usd']);

    const configMap: Record<string, number> = {};
    for (const c of configs || []) {
      configMap[c.config_key] = parseFloat(c.config_value) || 0;
    }

    const autoApproveThreshold = configMap['auto_approve_threshold'] || 0.8;
    const minValue = configMap['min_opportunity_value_usd'] || 20;

    // Get new signals that haven't been scored
    const { data: signals, error: signalsError } = await supabase
      .from('demand_signals')
      .select('*')
      .eq('status', 'new')
      .order('detected_at', { ascending: true })
      .limit(50);

    if (signalsError) {
      throw new Error(`Failed to fetch signals: ${signalsError.message}`);
    }

    if (!signals || signals.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No new signals to score', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get active offers
    const { data: offers } = await supabase
      .from('offers')
      .select('*')
      .eq('is_active', true);

    if (!offers || offers.length === 0) {
      // Mark signals as unmatched since no offers exist
      await supabase
        .from('demand_signals')
        .update({ status: 'rejected', rejection_reason: 'No active offers configured' })
        .in('id', signals.map(s => s.id));

      return new Response(
        JSON.stringify({ success: true, message: 'No offers configured', processed: signals.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let scored = 0;
    let rejected = 0;
    let autoApproved = 0;

    for (const signal of signals as DemandSignal[]) {
      // Kill Gate: Low relevance
      if (signal.relevance_score < 0.3) {
        await supabase
          .from('demand_signals')
          .update({ status: 'rejected', rejection_reason: 'Low relevance score' })
          .eq('id', signal.id);
        rejected++;
        continue;
      }

      // Find matching offer based on keywords and category
      const matchedOffer = findMatchingOffer(signal, offers as Offer[]);
      
      if (!matchedOffer) {
        await supabase
          .from('demand_signals')
          .update({ status: 'rejected', rejection_reason: 'No matching offer found' })
          .eq('id', signal.id);
        rejected++;
        continue;
      }

      // Calculate composite score
      const compositeScore = calculateCompositeScore(signal, matchedOffer);
      
      // Identify risk flags
      const riskFlags = identifyRiskFlags(signal);

      // Calculate expected value (from matching offer)
      const expectedValue = matchedOffer.min_value_usd;

      // Kill Gate: Value too low
      if (expectedValue < minValue) {
        await supabase
          .from('demand_signals')
          .update({ status: 'rejected', rejection_reason: `Expected value $${expectedValue} below minimum $${minValue}` })
          .eq('id', signal.id);
        rejected++;
        continue;
      }

      // Determine if auto-approve
      const shouldAutoApprove = compositeScore >= autoApproveThreshold && riskFlags.length === 0;

      // Create opportunity
      const { error: oppError } = await supabase
        .from('opportunities')
        .insert({
          signal_id: signal.id,
          offer_id: matchedOffer.id,
          expected_value_usd: expectedValue,
          composite_score: compositeScore,
          confidence_score: signal.relevance_score,
          risk_flags: riskFlags,
          status: shouldAutoApprove ? 'approved' : 'new',
          auto_approved: shouldAutoApprove,
          approved_at: shouldAutoApprove ? new Date().toISOString() : null,
        });

      if (oppError) {
        console.error(`Failed to create opportunity for signal ${signal.id}:`, oppError);
        continue;
      }

      // Update signal status
      await supabase
        .from('demand_signals')
        .update({ status: 'matched' })
        .eq('id', signal.id);

      scored++;
      if (shouldAutoApprove) autoApproved++;
    }

    const duration = Date.now() - startTime;
    console.log(`Scoring complete: ${scored} scored, ${rejected} rejected, ${autoApproved} auto-approved in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: signals.length,
        scored,
        rejected,
        auto_approved: autoApproved,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Opportunity scorer error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function findMatchingOffer(signal: DemandSignal, offers: Offer[]): Offer | null {
  const signalText = signal.query_text.toLowerCase();
  
  let bestMatch: Offer | null = null;
  let bestScore = 0;

  for (const offer of offers) {
    let matchScore = 0;
    
    // Check keyword matches
    for (const keyword of offer.keywords) {
      if (signalText.includes(keyword.toLowerCase())) {
        matchScore += 1;
      }
    }

    // Normalize by number of keywords
    if (offer.keywords.length > 0) {
      matchScore = matchScore / offer.keywords.length;
    }

    if (matchScore > bestScore) {
      bestScore = matchScore;
      bestMatch = offer;
    }
  }

  // Require at least 20% keyword match
  return bestScore >= 0.2 ? bestMatch : null;
}

function calculateCompositeScore(signal: DemandSignal, offer: Offer): number {
  // Weighted combination of factors
  const weights = {
    urgency: 0.3,
    relevance: 0.4,
    engagement: 0.3,
  };

  // Engagement score from payload (reactions, comments, etc.)
  const payload = signal.payload_json || {};
  const reactions = (payload.reactions as number) || 0;
  const comments = (payload.comments as number) || 0;
  const engagementScore = Math.min(1, (reactions * 0.1 + comments * 0.05));

  const compositeScore = 
    weights.urgency * signal.urgency_score +
    weights.relevance * signal.relevance_score +
    weights.engagement * engagementScore;

  return Math.round(compositeScore * 100) / 100;
}

function identifyRiskFlags(signal: DemandSignal): string[] {
  const flags: string[] = [];
  const text = signal.query_text.toLowerCase();

  // Check for spam indicators
  if (text.includes('urgent') && text.includes('!!!')) {
    flags.push('spam_indicators');
  }

  // Check for very low scores
  if (signal.urgency_score < 0.1 && signal.relevance_score < 0.4) {
    flags.push('low_quality_signal');
  }

  // Check for potentially problematic content
  const problematicKeywords = ['hack', 'exploit', 'bypass', 'crack', 'illegal'];
  for (const keyword of problematicKeywords) {
    if (text.includes(keyword)) {
      flags.push('problematic_content');
      break;
    }
  }

  return flags;
}
