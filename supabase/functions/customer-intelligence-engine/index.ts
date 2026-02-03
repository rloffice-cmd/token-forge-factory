/**
 * Customer Intelligence Engine
 * 
 * AI-Lite analysis for customer DNA updates and learning loop
 * 
 * RESPONSIBILITIES:
 * 1. Analyze customer interactions with lightweight AI
 * 2. Update customer_dna profiles based on behavior
 * 3. Detect buying style changes
 * 4. Track fear/trust signals over time
 * 5. Generate adaptive offer recommendations
 * 6. Continuous learning from outcomes
 * 
 * GOLDEN RULE: Build trust before selling
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  DNA_THRESHOLDS,
  ADAPTIVE_STRATEGIES,
  TRUST_FIRST_RULES,
  SUCCESS_KPIS,
  CONVERSATION_TONE,
  LEARNING_RULES,
  detectFearSignals,
  detectConfusion,
  detectCuriosity,
  detectMoneyAnxiety,
  classifyBuyingStyle,
  detectEmotionalState,
  getAdaptiveStrategy,
  canMakeSale,
  updateDNATrust,
  computeActorFingerprint,
  type CustomerDNA,
  type BuyingStyle,
  type EmotionalState,
  type OfferStrategy,
  type FeedbackLoop,
} from '../_shared/master-prompt-config.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  last_positive_interaction_at: string | null;
  last_negative_signal_at: string | null;
}

interface LearningInput {
  actor_fingerprint: string;
  event_type: 'interaction' | 'payment' | 'feedback' | 'churn_signal' | 'objection';
  event_data: {
    text?: string;
    is_positive?: boolean;
    amount_usd?: number;
    objection?: string;
    outcome?: 'success' | 'failure' | 'neutral';
  };
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
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'analyze';

    // ===========================================
    // ACTION: Analyze all active DNA profiles
    // ===========================================
    if (action === 'analyze') {
      return await analyzeAllProfiles(supabase);
    }

    // ===========================================
    // ACTION: Update DNA from event
    // ===========================================
    if (action === 'learn') {
      const body: LearningInput = await req.json();
      return await processLearningEvent(supabase, body);
    }

    // ===========================================
    // ACTION: Get recommendations for fingerprint
    // ===========================================
    if (action === 'recommend') {
      const fingerprint = url.searchParams.get('fingerprint');
      if (!fingerprint) {
        return new Response(
          JSON.stringify({ error: 'fingerprint required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return await getRecommendations(supabase, fingerprint);
    }

    // ===========================================
    // ACTION: Run learning loop on recent outcomes
    // ===========================================
    if (action === 'learning-loop') {
      return await runLearningLoop(supabase);
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action', available: ['analyze', 'learn', 'recommend', 'learning-loop'] }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Customer Intelligence Engine error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Analyze all active DNA profiles and update predictions
async function analyzeAllProfiles(supabase: AnySupabase) {
  const { data: profiles, error } = await supabase
    .from('customer_dna')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  const results = {
    profiles_analyzed: 0,
    churn_risks_detected: 0,
    ready_to_sell: 0,
    need_nurturing: 0,
    ltv_updates: 0,
  };

  for (const profile of profiles || []) {
    const dna = profile as CustomerDNARecord;
    
    // Calculate churn risk based on engagement velocity and last interaction
    const daysSinceInteraction = dna.last_positive_interaction_at
      ? Math.floor((Date.now() - new Date(dna.last_positive_interaction_at).getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    
    let churnRisk = 0.3; // Base risk
    if (daysSinceInteraction > 7) churnRisk += 0.2;
    if (daysSinceInteraction > 14) churnRisk += 0.2;
    if (daysSinceInteraction > 30) churnRisk += 0.2;
    if (dna.fear_signals.length > 2) churnRisk += 0.1;
    if (dna.trust_level < 50) churnRisk += 0.1;
    churnRisk = Math.min(1, churnRisk);

    // Calculate LTV prediction
    let ltv = dna.total_paid_usd;
    if (dna.trust_level >= 80 && churnRisk < 0.4) {
      // High trust, low churn = likely to buy again
      ltv += 50; // Potential future value
    }
    if (dna.buying_style === 'fast-buyer') {
      ltv *= 1.5; // Fast buyers have higher LTV
    }

    // Determine if ready to sell
    const canSell = canMakeSale({
      trust_level: dna.trust_level,
      fear_signals: dna.fear_signals,
      curiosity_level: dna.curiosity_level,
      technical_level: dna.technical_level as any,
      buying_style: dna.buying_style as BuyingStyle,
      time_to_value: dna.time_to_value,
      objections_history: dna.objections_history,
      preferred_channel: 'telegram',
      engagement_velocity: dna.engagement_velocity,
      payment_resistance_score: dna.payment_resistance_score,
      lifetime_value_prediction: dna.lifetime_value_prediction,
      churn_risk: dna.churn_risk,
    });

    // Update profile
    await supabase
      .from('customer_dna')
      .update({
        churn_risk: churnRisk,
        lifetime_value_prediction: ltv,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dna.id);

    results.profiles_analyzed++;
    if (churnRisk > 0.6) results.churn_risks_detected++;
    if (canSell.allowed) results.ready_to_sell++;
    if (!canSell.allowed && dna.trust_level > 40) results.need_nurturing++;
    if (ltv !== dna.lifetime_value_prediction) results.ltv_updates++;
  }

  return new Response(
    JSON.stringify({ success: true, ...results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Process a learning event and update DNA
async function processLearningEvent(supabase: AnySupabase, input: LearningInput) {
  const { actor_fingerprint, event_type, event_data } = input;

  // Get existing DNA profile
  const { data: existing } = await supabase
    .from('customer_dna')
    .select('*')
    .eq('actor_fingerprint', actor_fingerprint)
    .maybeSingle();

  const dna = existing as CustomerDNARecord | null;

  if (!dna) {
    return new Response(
      JSON.stringify({ success: false, error: 'DNA profile not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const updates: Partial<CustomerDNARecord> = {
    total_interactions: dna.total_interactions + 1,
  };

  // Process based on event type
  switch (event_type) {
    case 'interaction':
      if (event_data.text) {
        // Analyze text for signals
        const fearSignals = detectFearSignals(event_data.text);
        const curiosity = detectCuriosity(event_data.text);
        const confusion = detectConfusion(event_data.text);

        if (fearSignals.length > 0) {
          updates.fear_signals = [...dna.fear_signals, ...fearSignals].slice(-10);
          updates.trust_level = Math.max(0, dna.trust_level - 5);
          updates.last_negative_signal_at = new Date().toISOString();
        }

        if (confusion) {
          // Customer is confused - activate safe mode approach
          updates.trust_level = Math.max(0, dna.trust_level - 10);
        }

        if (curiosity > 60) {
          updates.curiosity_level = Math.min(100, dna.curiosity_level + 10);
          updates.last_positive_interaction_at = new Date().toISOString();
        }
      }

      if (event_data.is_positive) {
        updates.trust_level = updateDNATrust(dna.trust_level, 'positive_feedback', true);
        updates.last_positive_interaction_at = new Date().toISOString();
      }
      break;

    case 'payment':
      updates.total_paid_usd = dna.total_paid_usd + (event_data.amount_usd || 0);
      updates.trust_level = Math.min(100, dna.trust_level + 20);
      updates.payment_resistance_score = Math.max(0, dna.payment_resistance_score - 20);
      updates.time_to_value = true;
      updates.last_positive_interaction_at = new Date().toISOString();
      
      // Reclassify as fast-buyer if they paid quickly
      if (dna.buying_style === 'unknown' || dna.buying_style === 'cautious') {
        updates.buying_style = 'explorer'; // At least explorer, maybe fast-buyer next
      }
      break;

    case 'feedback':
      if (event_data.is_positive) {
        updates.trust_level = Math.min(100, dna.trust_level + 15);
        updates.churn_risk = Math.max(0, dna.churn_risk - 0.2);
      } else {
        updates.trust_level = Math.max(0, dna.trust_level - 20);
        updates.churn_risk = Math.min(1, dna.churn_risk + 0.3);
        updates.last_negative_signal_at = new Date().toISOString();
      }
      break;

    case 'churn_signal':
      updates.churn_risk = Math.min(1, dna.churn_risk + 0.4);
      updates.trust_level = Math.max(0, dna.trust_level - 15);
      break;

    case 'objection':
      if (event_data.objection) {
        updates.objections_history = [...dna.objections_history, event_data.objection].slice(-20);
        updates.payment_resistance_score = Math.min(100, dna.payment_resistance_score + 10);
        
        // Money-related objections increase resistance more
        if (detectMoneyAnxiety(event_data.objection)) {
          updates.payment_resistance_score = Math.min(100, (updates.payment_resistance_score || dna.payment_resistance_score) + 10);
          updates.buying_style = 'skeptic';
        }
      }
      break;
  }

  // Reclassify buying style based on current state
  const newBuyingStyle = classifyBuyingStyle(
    updates.fear_signals || dna.fear_signals,
    updates.curiosity_level || dna.curiosity_level,
    dna.engagement_velocity,
    (updates.payment_resistance_score || dna.payment_resistance_score) > 60,
    (updates.total_paid_usd || dna.total_paid_usd) > 0 ? 1 : 0
  );
  
  if (newBuyingStyle !== 'unknown') {
    updates.buying_style = newBuyingStyle;
  }

  // Update DNA
  await supabase
    .from('customer_dna')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', dna.id);

  return new Response(
    JSON.stringify({ 
      success: true, 
      fingerprint: actor_fingerprint,
      event_type,
      updates_applied: Object.keys(updates).length,
      new_trust_level: updates.trust_level || dna.trust_level,
      new_buying_style: updates.buying_style || dna.buying_style,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Get recommendations for a customer
async function getRecommendations(supabase: AnySupabase, fingerprint: string) {
  const { data: dna } = await supabase
    .from('customer_dna')
    .select('*')
    .eq('actor_fingerprint', fingerprint)
    .maybeSingle();

  if (!dna) {
    return new Response(
      JSON.stringify({ error: 'DNA profile not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const dnaRecord = dna as CustomerDNARecord;
  
  // Build DNA object
  const customerDNA: CustomerDNA = {
    trust_level: dnaRecord.trust_level,
    fear_signals: dnaRecord.fear_signals,
    curiosity_level: dnaRecord.curiosity_level,
    technical_level: dnaRecord.technical_level as any,
    buying_style: dnaRecord.buying_style as BuyingStyle,
    time_to_value: dnaRecord.time_to_value,
    objections_history: dnaRecord.objections_history,
    preferred_channel: 'telegram',
    engagement_velocity: dnaRecord.engagement_velocity,
    payment_resistance_score: dnaRecord.payment_resistance_score,
    lifetime_value_prediction: dnaRecord.lifetime_value_prediction,
    churn_risk: dnaRecord.churn_risk,
  };

  // Get adaptive strategy
  const strategy = getAdaptiveStrategy(customerDNA);
  
  // Check if can sell
  const saleCheck = canMakeSale(customerDNA);
  
  // Determine emotional state (simplified without current text)
  const emotionalState: EmotionalState = 
    dnaRecord.fear_signals.length >= 2 ? 'panicking' :
    dnaRecord.fear_signals.length === 1 ? 'skeptical' :
    dnaRecord.curiosity_level > 60 ? 'curious' :
    dnaRecord.trust_level >= 80 ? 'ready' : 'calm';

  // Build recommendations
  const recommendations = {
    fingerprint,
    dna_summary: {
      trust_level: dnaRecord.trust_level,
      buying_style: dnaRecord.buying_style,
      emotional_state: emotionalState,
      time_to_value: dnaRecord.time_to_value,
      ltv_prediction: dnaRecord.lifetime_value_prediction,
      churn_risk: dnaRecord.churn_risk,
    },
    strategy: strategy.strategy,
    strategy_reason: strategy.reason,
    can_sell: saleCheck.allowed,
    sale_block_reason: saleCheck.allowed ? null : saleCheck.reason,
    allowed_actions: strategy.allowed_actions,
    forbidden_actions: strategy.forbidden_actions,
    next_steps: generateNextSteps(customerDNA, strategy, emotionalState),
    conversation_guidelines: {
      tone: CONVERSATION_TONE.required,
      forbidden: CONVERSATION_TONE.forbidden,
      include: CONVERSATION_TONE.include,
    },
  };

  return new Response(
    JSON.stringify(recommendations),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Generate specific next steps based on DNA
function generateNextSteps(
  dna: CustomerDNA,
  strategy: OfferStrategy,
  emotionalState: EmotionalState
): string[] {
  const steps: string[] = [];

  // If not ready to sell
  if (!canMakeSale(dna).allowed) {
    if (!dna.time_to_value) {
      steps.push('Provide free value: scan, demo, or educational content');
    }
    if (dna.trust_level < 80) {
      steps.push('Build trust through helpful interactions');
    }
    if (dna.fear_signals.length > 0) {
      steps.push(`Address fears: ${dna.fear_signals.slice(0, 3).join(', ')}`);
    }
  }

  // Based on emotional state
  switch (emotionalState) {
    case 'panicking':
      steps.push('Calm the customer first - no selling');
      steps.push('Provide immediate, actionable help');
      break;
    case 'confused':
      steps.push('Clarify and educate - do not proceed with offers');
      steps.push('Ask what specific questions they have');
      break;
    case 'skeptical':
      steps.push('Provide social proof and testimonials');
      steps.push('Offer micro-trial or money-back guarantee');
      break;
    case 'curious':
      steps.push('Feed curiosity with detailed information');
      steps.push('Offer hands-on demo or sandbox');
      break;
    case 'ready':
      steps.push('Customer is ready - can proceed with appropriate offer');
      steps.push('Use single, clear offer matching their needs');
      break;
  }

  // Based on buying style
  switch (dna.buying_style) {
    case 'skeptic':
      steps.push('Offer smallest possible commitment first');
      break;
    case 'explorer':
      steps.push('Provide trial access without payment');
      break;
    case 'fast-buyer':
      steps.push('Dont slow them down with too many questions');
      break;
    case 'cautious':
      steps.push('Emphasize refund policy and guarantees');
      break;
  }

  return steps.slice(0, 5); // Max 5 steps
}

// Run learning loop on recent outcomes
async function runLearningLoop(supabase: AnySupabase) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Get recent payments (successes)
  const { data: recentPayments } = await supabase
    .from('payments')
    .select('customer_email, amount_usd, confirmed_at')
    .eq('status', 'confirmed')
    .gte('confirmed_at', cutoff)
    .limit(100);

  // Get recent abandoned checkouts (failures)
  const { data: recentCheckouts } = await supabase
    .from('closing_attempts')
    .select('*')
    .eq('result', 'checkout_created')
    .gte('created_at', cutoff)
    .limit(100);

  const { data: confirmedPaymentIds } = await supabase
    .from('payments')
    .select('id')
    .eq('status', 'confirmed')
    .gte('confirmed_at', cutoff);

  const confirmedIds = new Set((confirmedPaymentIds || []).map(p => p.id));
  
  // Find abandoned checkouts (created but not confirmed)
  const abandoned = (recentCheckouts || []).filter(c => 
    c.payment_id && !confirmedIds.has(c.payment_id)
  );

  const results = {
    payments_analyzed: recentPayments?.length || 0,
    abandoned_checkouts: abandoned.length,
    feedback_incorporated: 0,
  };

  // Learn from abandoned checkouts
  for (const checkout of abandoned) {
    // Find associated fingerprint from opportunity
    const { data: opp } = await supabase
      .from('opportunities')
      .select('metadata')
      .eq('id', checkout.opportunity_id)
      .maybeSingle();

    if (opp?.metadata?.actor_fingerprint) {
      const fingerprint = opp.metadata.actor_fingerprint as string;
      
      // Update DNA with abandonment signal
      const { data: dna } = await supabase
        .from('customer_dna')
        .select('*')
        .eq('actor_fingerprint', fingerprint)
        .maybeSingle();

      if (dna) {
        const record = dna as CustomerDNARecord;
        await supabase
          .from('customer_dna')
          .update({
            trust_level: Math.max(0, record.trust_level - 10),
            payment_resistance_score: Math.min(100, record.payment_resistance_score + 15),
            churn_risk: Math.min(1, record.churn_risk + 0.15),
            updated_at: new Date().toISOString(),
          })
          .eq('id', record.id);
        
        results.feedback_incorporated++;
      }
    }
  }

  // Learn from successful payments
  for (const payment of recentPayments || []) {
    // Find customer and update DNA with positive signal
    const { data: customer } = await supabase
      .from('users_customers')
      .select('id')
      .eq('email', payment.customer_email)
      .maybeSingle();

    if (customer) {
      // Get any associated fingerprint
      const { data: link } = await supabase
        .from('actor_lead_links')
        .select('actor_fingerprint')
        .ilike('lead_key', `%${payment.customer_email.split('@')[0]}%`)
        .maybeSingle();

      if (link) {
        const { data: dna } = await supabase
          .from('customer_dna')
          .select('*')
          .eq('actor_fingerprint', link.actor_fingerprint)
          .maybeSingle();

        if (dna) {
          const record = dna as CustomerDNARecord;
          await supabase
            .from('customer_dna')
            .update({
              trust_level: Math.min(100, record.trust_level + 20),
              payment_resistance_score: Math.max(0, record.payment_resistance_score - 20),
              total_paid_usd: record.total_paid_usd + (payment.amount_usd || 0),
              time_to_value: true,
              churn_risk: Math.max(0, record.churn_risk - 0.2),
              last_positive_interaction_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', record.id);
          
          results.feedback_incorporated++;
        }
      }
    }
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
      action: 'customer-intelligence:learning-loop',
      metadata: results
    });
  }

  return new Response(
    JSON.stringify({ success: true, ...results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}