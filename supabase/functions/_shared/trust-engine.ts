/**
 * Trust Engine - Trust-Gated Revenue Logic
 * Separate module for trust scoring and decision making
 */

import {
  classifyIntent,
  isActionableIntent,
  calculatePainScore,
  calculateTrustScore,
  getTrustAction,
  canCreateCheckout,
  canSendOutreach,
  PAIN_THRESHOLD,
  VELOCITY_LIMITS,
  KILL_SWITCHES,
  IntentType,
} from './master-prompt-config.ts';

export interface SignalAnalysis {
  intent: IntentType;
  isActionable: boolean;
  painScore: number;
  trustScore: number;
  trustAction: 'BLOCK' | 'FREE_ONLY' | 'PAID_OK';
  canCheckout: boolean;
  canOutreach: boolean;
  recommendation: string;
}

export interface LeadContext {
  text: string;
  receivedFreeValue: boolean;
  interactionCount: number;
  hasNegativeSentiment: boolean;
  socialProofVisible: boolean;
  isPanicking: boolean;
  hasBuyingSignal: boolean;
}

/**
 * Analyze a signal/lead and determine action
 */
export function analyzeSignal(context: LeadContext): SignalAnalysis {
  const intent = classifyIntent(context.text);
  const isActionable = isActionableIntent(intent);
  const painScore = calculatePainScore(context.text);
  
  const trustScore = calculateTrustScore(
    context.receivedFreeValue,
    context.interactionCount,
    context.hasNegativeSentiment,
    context.socialProofVisible,
    context.isPanicking
  );
  
  const trustAction = getTrustAction(trustScore);
  const canCheckout = canCreateCheckout(painScore, context.hasBuyingSignal, trustScore);
  const canOutreach = canSendOutreach(painScore, trustScore);
  
  let recommendation = 'SILENT';
  
  if (!isActionable) {
    recommendation = 'SILENT - Intent not actionable';
  } else if (painScore < PAIN_THRESHOLD) {
    recommendation = 'SILENT - Pain below threshold';
  } else if (trustAction === 'BLOCK') {
    recommendation = 'SILENT - Trust too low';
  } else if (trustAction === 'FREE_ONLY') {
    recommendation = 'FREE_VALUE - Build trust first';
  } else if (canCheckout) {
    recommendation = 'PAID_FLOW - All gates passed';
  } else {
    recommendation = 'FREE_VALUE - Missing buying signal or pain';
  }
  
  return {
    intent,
    isActionable,
    painScore,
    trustScore,
    trustAction,
    canCheckout,
    canOutreach,
    recommendation,
  };
}

/**
 * Check velocity limits
 */
export async function checkVelocityLimits(
  supabase: any,
  actionType: 'public_reply' | 'dm' | 'checkout'
): Promise<{ allowed: boolean; reason?: string }> {
  const today = new Date().toISOString().split('T')[0];
  
  // Count today's actions
  const { count, error } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00Z`)
    .like('action', `%${actionType}%`);
  
  if (error) {
    console.error('Velocity check error:', error);
    return { allowed: false, reason: 'velocity_check_failed' };
  }
  
  const limits: Record<string, number> = {
    public_reply: VELOCITY_LIMITS.max_public_replies_per_day,
    dm: VELOCITY_LIMITS.max_dm_per_day,
    checkout: VELOCITY_LIMITS.max_checkouts_per_day,
  };
  
  const limit = limits[actionType] || 5;
  
  if ((count || 0) >= limit) {
    return { allowed: false, reason: `daily_limit_reached: ${actionType}` };
  }
  
  return { allowed: true };
}

/**
 * Check for kill switch triggers
 */
export async function checkKillSwitches(
  supabase: any
): Promise<{ triggered: boolean; reason?: string; silenceUntil?: string }> {
  const now = new Date();
  const hoursAgo24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  
  // Check for negative feedback
  const { data: negativeSignals } = await supabase
    .from('demand_signals')
    .select('query_text')
    .gte('created_at', hoursAgo24)
    .limit(100);
  
  const hasNegativeFeedback = (negativeSignals || []).some((s: any) => 
    KILL_SWITCHES.negative_feedback_keywords.some(kw => 
      s.query_text?.toLowerCase().includes(kw)
    )
  );
  
  if (hasNegativeFeedback) {
    const silenceUntil = new Date(now.getTime() + KILL_SWITCHES.negative_feedback_silence_hours * 60 * 60 * 1000);
    return { 
      triggered: true, 
      reason: 'negative_feedback_detected',
      silenceUntil: silenceUntil.toISOString()
    };
  }
  
  // Check for no engagement
  const { data: recentActions } = await supabase
    .from('audit_logs')
    .select('metadata')
    .gte('created_at', hoursAgo24)
    .like('action', '%outreach%')
    .order('created_at', { ascending: false })
    .limit(KILL_SWITCHES.no_engagement_threshold);
  
  const noEngagementCount = (recentActions || []).filter((a: any) => 
    !a.metadata?.engagement && !a.metadata?.response
  ).length;
  
  if (noEngagementCount >= KILL_SWITCHES.no_engagement_threshold) {
    const silenceUntil = new Date(now.getTime() + KILL_SWITCHES.silent_mode_hours * 60 * 60 * 1000);
    return {
      triggered: true,
      reason: 'no_engagement_detected',
      silenceUntil: silenceUntil.toISOString()
    };
  }
  
  return { triggered: false };
}

/**
 * Record payment failure for learning
 */
export async function recordPaymentFailure(
  supabase: any,
  checkoutId: string,
  offerId: string,
  context: Record<string, any>
): Promise<void> {
  // Mark the checkout as high friction
  await supabase
    .from('closing_attempts')
    .update({
      result: 'HIGH_FRICTION',
      metadata_json: {
        ...context,
        marked_at: new Date().toISOString(),
        learning_action: 'reduce_trust_weight',
      }
    })
    .eq('id', checkoutId);
  
  // Log the learning event
  await supabase
    .from('learning_events')
    .insert({
      event_type: 'payment_failure',
      entity_type: 'checkout',
      entity_id: checkoutId,
      change_description: 'Checkout created but no payment received - marking as high friction',
      previous_state: { status: 'checkout_created' },
      new_state: { status: 'HIGH_FRICTION', blocked_flow: true },
      expected_impact: { reduce_similar_checkouts: true },
    });
  
  console.log(`📉 Payment failure recorded for checkout ${checkoutId} - flow blocked`);
}

/**
 * Get trust-to-payment ratio (core KPI)
 */
export async function getTrustToPaymentRatio(supabase: any): Promise<number> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  // Count checkouts
  const { count: checkoutCount } = await supabase
    .from('closing_attempts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thirtyDaysAgo)
    .not('checkout_url', 'is', null);
  
  // Count payments
  const { count: paymentCount } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thirtyDaysAgo)
    .eq('status', 'confirmed');
  
  if (!checkoutCount || checkoutCount === 0) return 0;
  
  return ((paymentCount || 0) / checkoutCount) * 100;
}
