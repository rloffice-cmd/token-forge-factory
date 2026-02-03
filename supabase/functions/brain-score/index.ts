/**
 * Brain Score - Trust-Gated + Customer DNA Intelligence
 * 
 * IMPLEMENTS:
 * - Customer DNA Engine (Layer 1)
 * - Emotional & Cognitive Analysis (Layer 2)
 * - Trust-First Sales Strategy (Layer 3)
 * - Adaptive Offer Engine (Layer 4)
 * - Continuous Learning Loop (Layer 6)
 * 
 * GOLDEN RULE: If not sure customer will say "wow, this helped me" — DO NOT SELL
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  classifyIntent,
  isActionableIntent,
  calculatePainScore,
  PAIN_THRESHOLD,
  TRUST_GATES,
  TRUST_CAP,
  canCreateCheckout,
  FREE_VALUE_EVENTS,
  isThrottleActive,
  computeLeadKey,
  computeActorFingerprint,
  extractAuthorFromPayload,
  extractPlatformFromPayload,
  PAIN_INDICATORS,
  // DNA Engine imports
  DNA_THRESHOLDS,
  ADAPTIVE_STRATEGIES,
  ENHANCED_KILL_GATES,
  detectFearSignals,
  detectConfusion,
  detectCuriosity,
  detectMoneyAnxiety,
  classifyBuyingStyle,
  detectEmotionalState,
  getAdaptiveStrategy,
  canMakeSale,
  updateDNATrust,
  type CustomerDNA,
  type BuyingStyle,
  type EmotionalState,
  type OfferStrategy,
} from '../_shared/master-prompt-config.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

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

interface ActorProfile {
  id: string;
  fingerprint: string;
  interaction_count_30d: number;
  free_value_events_count: number;
  has_paid: boolean;
  highest_trust_score: number;
  total_paid_usd: number;
}

interface CustomerDNARecord {
  id: string;
  actor_fingerprint: string;
  trust_level: number;
  curiosity_level: number;
  fear_signals: string[];
  buying_style: string;
  technical_level: string;
  time_to_value: boolean;
  payment_resistance_score: number;
  objections_history: string[];
  engagement_velocity: number;
  lifetime_value_prediction: number;
  churn_risk: number;
  total_interactions: number;
  total_value_received: number;
  total_paid_usd: number;
}

// Score signal using Trust-Gated + DNA Intelligence
async function scoreSignalWithDNA(
  supabase: AnySupabase,
  signal: Signal,
  offer: Offer, 
  sourceHealthScore: number,
  actorProfile: ActorProfile | null,
  dnaRecord: CustomerDNARecord | null
): Promise<{
  score: number;
  painScore: number;
  trustScore: number;
  trustAction: string;
  canCheckout: boolean;
  intent: string;
  interactionCount: number;
  freeValueEventsCount: number;
  trustCapApplied: boolean;
  reasonCodes: string[];
  // DNA additions
  buyingStyle: BuyingStyle;
  emotionalState: EmotionalState;
  fearDetected: boolean;
  safeModeActivated: boolean;
  adaptiveStrategy: OfferStrategy;
  dnaScore: number;
}> {
  const text = `${signal.query_text || ''} ${JSON.stringify(signal.payload_json || {})}`.toLowerCase();
  const reasonCodes: string[] = [];
  
  // 1. Intent Classification
  const intent = classifyIntent(text);
  const isActionable = isActionableIntent(intent);
  
  if (!isActionable) {
    return createBlockedResult('intent_not_actionable', intent);
  }
  
  // 2. Pain Score
  const painScore = calculatePainScore(text);
  
  if (painScore < PAIN_THRESHOLD) {
    return createBlockedResult('pain_below_threshold', intent, painScore);
  }
  reasonCodes.push('pain_threshold_met');
  
  // ===========================================
  // 🧬 DNA ANALYSIS - Layer 1 & 2
  // ===========================================
  
  // Detect emotional signals
  const fearSignals = detectFearSignals(text);
  const confusionDetected = detectConfusion(text);
  const curiosityLevel = detectCuriosity(text);
  const hasMoneyAnxiety = detectMoneyAnxiety(text);
  
  // Check for kill gate triggers
  const killGateTriggered = confusionDetected || 
    fearSignals.length > DNA_THRESHOLDS.MAX_FEAR_SIGNALS ||
    DNA_THRESHOLDS.CONFUSION_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
  
  if (killGateTriggered) {
    reasonCodes.push('kill_gate_triggered');
  }
  
  // 3. Buying Signal Detection
  const buyingSignalKeywords = ['any tool', 'recommend', 'how can i', 'is there a way', 'looking for', 'need'];
  const hasBuyingSignal = buyingSignalKeywords.some(kw => text.includes(kw));
  if (hasBuyingSignal) reasonCodes.push('buying_signal_detected');
  
  // 4. Get interaction data from actor profile
  const interactionCount = actorProfile?.interaction_count_30d || 0;
  const freeValueEventsCount = actorProfile?.free_value_events_count || 0;
  const hasPaid = actorProfile?.has_paid || false;
  const totalPaidUsd = actorProfile?.total_paid_usd || 0;
  
  // 5. Build or update DNA profile
  let dna: CustomerDNA;
  let buyingStyle: BuyingStyle;
  
  if (dnaRecord) {
    // Use existing DNA
    buyingStyle = dnaRecord.buying_style as BuyingStyle;
    dna = {
      trust_level: dnaRecord.trust_level,
      fear_signals: [...dnaRecord.fear_signals, ...fearSignals].slice(-10), // Keep last 10
      curiosity_level: Math.round((dnaRecord.curiosity_level + curiosityLevel) / 2),
      technical_level: dnaRecord.technical_level as 'beginner' | 'intermediate' | 'advanced' | 'unknown',
      buying_style: buyingStyle,
      time_to_value: dnaRecord.time_to_value || freeValueEventsCount >= DNA_THRESHOLDS.MIN_VALUE_EVENTS_FOR_SALE,
      objections_history: dnaRecord.objections_history,
      preferred_channel: 'telegram',
      engagement_velocity: dnaRecord.engagement_velocity,
      payment_resistance_score: dnaRecord.payment_resistance_score,
      lifetime_value_prediction: dnaRecord.lifetime_value_prediction,
      churn_risk: dnaRecord.churn_risk,
    };
  } else {
    // Classify buying style from signals
    buyingStyle = classifyBuyingStyle(
      fearSignals,
      curiosityLevel,
      interactionCount / 30, // Velocity: interactions per day
      hasMoneyAnxiety,
      hasPaid ? 1 : 0
    );
    
    dna = {
      trust_level: 30, // Start low
      fear_signals: fearSignals,
      curiosity_level: curiosityLevel,
      technical_level: 'unknown',
      buying_style: buyingStyle,
      time_to_value: freeValueEventsCount >= DNA_THRESHOLDS.MIN_VALUE_EVENTS_FOR_SALE,
      objections_history: [],
      preferred_channel: 'telegram',
      engagement_velocity: interactionCount / 30,
      payment_resistance_score: hasMoneyAnxiety ? 70 : 50,
      lifetime_value_prediction: 0,
      churn_risk: 0.5,
    };
  }
  
  // 6. Detect emotional state
  const emotionalState = detectEmotionalState(
    text,
    fearSignals,
    confusionDetected,
    curiosityLevel,
    dna.trust_level
  );
  reasonCodes.push(`emotional_state:${emotionalState}`);
  
  // 7. Check if safe mode should be activated
  const safeModeActivated = 
    emotionalState === 'panicking' ||
    emotionalState === 'confused' ||
    fearSignals.length > DNA_THRESHOLDS.MAX_FEAR_SIGNALS ||
    killGateTriggered;
  
  if (safeModeActivated) {
    reasonCodes.push('safe_mode_activated');
  }
  
  // ===========================================
  // 🛡️ TRUST SCORING WITH DNA - Layer 3
  // ===========================================
  
  let estimatedTrust = dna.trust_level;
  
  // Boost trust based on actor history
  if (interactionCount > 0) {
    estimatedTrust += Math.min(15, interactionCount * 3);
    reasonCodes.push(`interaction_history:${interactionCount}`);
  }
  
  if (freeValueEventsCount > 0) {
    estimatedTrust += Math.min(20, freeValueEventsCount * 10);
    reasonCodes.push(`free_value_received:${freeValueEventsCount}`);
  }
  
  if (hasPaid) {
    estimatedTrust += 25;
    reasonCodes.push('previous_payment');
  }
  
  // Boost trust if source is healthy
  estimatedTrust += sourceHealthScore * 10;
  
  // REDUCE trust based on emotional state
  if (emotionalState === 'panicking') {
    estimatedTrust -= 20;
    reasonCodes.push('trust_reduced:panicking');
  } else if (emotionalState === 'confused') {
    estimatedTrust -= 15;
    reasonCodes.push('trust_reduced:confused');
  } else if (emotionalState === 'skeptical') {
    estimatedTrust -= 10;
    reasonCodes.push('trust_reduced:skeptical');
  }
  
  // Reduce trust for money anxiety
  if (hasMoneyAnxiety) {
    estimatedTrust -= 10;
    reasonCodes.push('money_anxiety_detected');
  }
  
  // 🔒 TRUST CAP: Apply if insufficient interaction history
  let trustCapApplied = false;
  if (interactionCount < TRUST_CAP.min_interactions_for_paid) {
    const originalTrust = estimatedTrust;
    estimatedTrust = Math.min(estimatedTrust, TRUST_CAP.no_history_max);
    if (originalTrust > TRUST_CAP.no_history_max) {
      trustCapApplied = true;
      reasonCodes.push(`trust_capped:${originalTrust}->${estimatedTrust}`);
    }
  }
  
  estimatedTrust = Math.max(0, Math.min(100, estimatedTrust));
  
  // Update DNA trust level
  dna.trust_level = estimatedTrust;
  
  // Determine trust action
  let trustAction: 'BLOCK' | 'FREE_ONLY' | 'PAID_OK';
  if (safeModeActivated || estimatedTrust < TRUST_GATES.BLOCK_PAYMENT) {
    trustAction = 'BLOCK';
    reasonCodes.push('trust_blocked');
  } else if (estimatedTrust < TRUST_GATES.PAID_ALLOWED) {
    trustAction = 'FREE_ONLY';
    reasonCodes.push('trust_free_only');
  } else {
    trustAction = 'PAID_OK';
    reasonCodes.push('trust_paid_ok');
  }
  
  // ===========================================
  // 🎯 ADAPTIVE OFFER STRATEGY - Layer 4
  // ===========================================
  
  const adaptiveStrategy = getAdaptiveStrategy(dna);
  reasonCodes.push(`strategy:${adaptiveStrategy.strategy}`);
  
  // Check if sale is allowed using DNA rules
  const saleCheck = canMakeSale(dna);
  if (!saleCheck.allowed) {
    trustAction = trustAction === 'PAID_OK' ? 'FREE_ONLY' : trustAction;
    reasonCodes.push(`sale_blocked:${saleCheck.reason}`);
  }
  
  // 5. Can Create Checkout? (with real interactionCount + DNA validation)
  const canCheckout = !safeModeActivated && 
                      saleCheck.allowed &&
                      canCreateCheckout(painScore, hasBuyingSignal, estimatedTrust, interactionCount);
  
  if (!canCheckout && trustAction === 'PAID_OK') {
    reasonCodes.push('checkout_blocked_by_requirements');
  }
  
  // 6. Calculate composite score with DNA weight
  let compositeScore = 0;
  compositeScore += (painScore / 100) * 0.30;
  if (hasBuyingSignal) compositeScore += 0.15;
  compositeScore += (estimatedTrust / 100) * 0.25;
  compositeScore += sourceHealthScore * 0.10;
  
  // DNA-based scoring adjustments
  if (emotionalState === 'ready') compositeScore += 0.10;
  if (buyingStyle === 'fast-buyer') compositeScore += 0.05;
  if (safeModeActivated) compositeScore -= 0.20;
  
  const matchedKeywords = offer.keywords.filter(kw => text.includes(kw.toLowerCase()));
  compositeScore += Math.min(0.10, matchedKeywords.length * 0.02);
  
  // DNA Score: 0-100 overall quality
  const dnaScore = Math.round(
    (dna.trust_level * 0.3) +
    (dna.curiosity_level * 0.2) +
    ((100 - dna.payment_resistance_score) * 0.2) +
    (dna.time_to_value ? 20 : 0) +
    (fearSignals.length === 0 ? 10 : 0)
  );
  
  // ===========================================
  // 🔄 UPDATE DNA IN DATABASE - Layer 6
  // ===========================================
  
  const fingerprint = computeActorFingerprint(
    extractPlatformFromPayload(signal.payload_json || {}, signal.category),
    extractAuthorFromPayload(signal.payload_json || {})
  );
  
  // Use raw table operation with type assertion to bypass strict typing
  await (supabase as AnySupabase).from('customer_dna').upsert({
    actor_fingerprint: fingerprint,
    trust_level: estimatedTrust,
    curiosity_level: dna.curiosity_level,
    fear_signals: dna.fear_signals,
    buying_style: buyingStyle,
    technical_level: dna.technical_level,
    time_to_value: dna.time_to_value,
    payment_resistance_score: dna.payment_resistance_score,
    objections_history: dna.objections_history,
    engagement_velocity: dna.engagement_velocity,
    lifetime_value_prediction: dna.lifetime_value_prediction,
    churn_risk: dna.churn_risk,
    total_interactions: (dnaRecord?.total_interactions || 0) + 1,
    total_value_received: freeValueEventsCount,
    total_paid_usd: totalPaidUsd,
    updated_at: new Date().toISOString(),
  }, {
    onConflict: 'actor_fingerprint',
  });
  
  return {
    score: Math.min(1.0, Math.max(0, compositeScore)),
    painScore,
    trustScore: estimatedTrust,
    trustAction,
    canCheckout,
    intent,
    interactionCount,
    freeValueEventsCount,
    trustCapApplied,
    reasonCodes,
    buyingStyle,
    emotionalState,
    fearDetected: fearSignals.length > 0,
    safeModeActivated,
    adaptiveStrategy,
    dnaScore,
  };
}

// Helper to create blocked results
function createBlockedResult(reason: string, intent: string, painScore = 0): ReturnType<typeof scoreSignalWithDNA> extends Promise<infer T> ? T : never {
  const defaultStrategy: OfferStrategy = {
    strategy: 'educate_only',
    reason: 'Blocked',
    allowed_actions: [],
    forbidden_actions: ['all'],
  };
  
  return {
    score: 0,
    painScore,
    trustScore: 0,
    trustAction: 'BLOCK',
    canCheckout: false,
    intent,
    interactionCount: 0,
    freeValueEventsCount: 0,
    trustCapApplied: false,
    reasonCodes: [reason],
    buyingStyle: 'unknown',
    emotionalState: 'calm',
    fearDetected: false,
    safeModeActivated: false,
    adaptiveStrategy: defaultStrategy,
    dnaScore: 0,
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
    // Check brain_enabled and throttle state
    const { data: settings } = await supabase
      .from('brain_settings')
      .select('brain_enabled, auto_approve_threshold, min_opportunity_value_usd, throttle_until')
      .single();
    
    if (!settings?.brain_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Brain disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine throttle state
    const throttleState = isThrottleActive(settings?.throttle_until) ? 'ON' : 'OFF';

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
      safe_mode_activations: 0,
      dna_profiles_updated: 0,
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

      // 🔑 Actor Fingerprinting - STABLE IDENTITY
      const platform = extractPlatformFromPayload(signal.payload_json || {}, signal.category);
      const author = extractAuthorFromPayload(signal.payload_json || {});
      const fingerprint = computeActorFingerprint(platform, author);
      const leadKey = computeLeadKey(platform, author, signal.source_url);
      
      // Lookup actor profile
      let actorProfile: ActorProfile | null = null;
      const { data: existingActor } = await supabase
        .from('actor_profiles')
        .select('*')
        .eq('fingerprint', fingerprint)
        .maybeSingle();
      
      if (existingActor) {
        actorProfile = existingActor as ActorProfile;
        await supabase.from('actor_profiles')
          .update({ 
            last_seen_at: new Date().toISOString(), 
            interaction_count_30d: (existingActor.interaction_count_30d || 0) + 1 
          })
          .eq('id', existingActor.id);
      } else {
        const { data: newActor } = await supabase
          .from('actor_profiles')
          .insert({ 
            fingerprint, 
            platform, 
            author, 
            interaction_count_30d: 1 
          })
          .select()
          .single();
        actorProfile = newActor as ActorProfile;
      }
      
      // Link actor to lead_key
      if (actorProfile) {
        await supabase
          .from('actor_lead_links')
          .upsert({
            actor_fingerprint: fingerprint,
            lead_key: leadKey,
            confidence: 0.9,
            last_seen_at: new Date().toISOString(),
          }, {
            onConflict: 'actor_fingerprint,lead_key',
          });
      }

      // 🧬 Lookup DNA profile
      const { data: dnaRecord } = await supabase
        .from('customer_dna')
        .select('*')
        .eq('actor_fingerprint', fingerprint)
        .maybeSingle();

      const sourceHealthScore = signal.offer_sources?.health_score || 0.5;
      
      // Score with DNA Intelligence
      const scoringResult = await scoreSignalWithDNA(
        supabase as AnySupabase,
        signal as Signal,
        offer as Offer, 
        sourceHealthScore,
        actorProfile,
        dnaRecord as CustomerDNARecord | null
      );
      
      const { 
        score, painScore, trustScore, trustAction, canCheckout, intent, 
        interactionCount, freeValueEventsCount, trustCapApplied, reasonCodes,
        buyingStyle, emotionalState, fearDetected, safeModeActivated, adaptiveStrategy, dnaScore
      } = scoringResult;

      if (safeModeActivated) {
        results.safe_mode_activations++;
      }
      results.dna_profiles_updated++;

      // 📝 Write Decision Trace with DNA data
      await supabase.from('decision_traces').insert({
        entity_type: 'signal',
        entity_id: signal.id,
        source_url: signal.source_url,
        intent,
        pain_score: painScore,
        trust_score: trustScore,
        trust_cap_applied: trustCapApplied,
        interaction_count: interactionCount,
        free_value_events_count_24h: freeValueEventsCount,
        throttle_state: throttleState,
        throttle_until: settings?.throttle_until,
        decision: trustAction,
        reason_codes: reasonCodes,
        offer_id: offer.id,
        platform,
        actor_fingerprint: fingerprint,
        lead_key: leadKey,
        // DNA fields
        buying_style: buyingStyle,
        fear_detected: fearDetected,
        safe_mode_activated: safeModeActivated,
        dna_score: dnaScore,
        emotional_state: emotionalState,
      });
      
      // Apply trust gates
      if (trustAction === 'BLOCK') {
        await supabase
          .from('demand_signals')
          .update({ status: 'rejected', rejection_reason: safeModeActivated ? 'safe_mode_kill_gate' : 'trust_too_low' })
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
      
      // Only auto-approve if checkout is allowed AND not in safe mode
      const autoApprove = canCheckout && 
                          !safeModeActivated &&
                          score >= (settings.auto_approve_threshold || 0.8) && 
                          estValue >= (settings.min_opportunity_value_usd || 20);
      
      // Determine opportunity status based on adaptive strategy
      let oppStatus: string;
      if (autoApprove) {
        oppStatus = 'approved';
      } else if (safeModeActivated || trustAction === 'FREE_ONLY') {
        oppStatus = 'free_value';
      } else if (adaptiveStrategy.strategy === 'educate_only') {
        oppStatus = 'nurture';
      } else {
        oppStatus = 'pending';
      }
      
      // Create opportunity with DNA metadata
      const { error: insertError } = await supabase
        .from('opportunities')
        .insert({
          signal_id_v2: signal.id,
          signal_id: signal.id,
          offer_id: offer.id,
          composite_score: score,
          est_value_usd: estValue,
          expected_value_usd: estValue,
          status: oppStatus,
          auto_approved: autoApprove,
          approved_at: autoApprove ? new Date().toISOString() : null,
          metadata: {
            pain_score: painScore,
            trust_score: trustScore,
            trust_action: trustAction,
            can_checkout: canCheckout,
            trust_cap_applied: trustCapApplied,
            interaction_count: interactionCount,
            reason_codes: reasonCodes,
            actor_fingerprint: fingerprint,
            // DNA Intelligence
            scoring_version: 'customer_dna_v1',
            buying_style: buyingStyle,
            emotional_state: emotionalState,
            fear_detected: fearDetected,
            safe_mode_activated: safeModeActivated,
            adaptive_strategy: adaptiveStrategy.strategy,
            dna_score: dnaScore,
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
        action: 'brain-score:customer-dna-v1',
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