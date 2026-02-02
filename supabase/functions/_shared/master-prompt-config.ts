/**
 * 🧠 MASTER SYSTEM PROMPT
 * TOKEN FORGE FACTORY
 * FULL AUTO – DIRECT CONVERSION – TRUST GATED REVENUE MODE
 * 
 * NON-NEGOTIABLE PRINCIPLES:
 * 1. NO HUMAN APPROVAL — EVER
 * 2. NO TRUST = NO PAYMENT FLOW
 * 3. CHECKOUT IS A PRIVILEGE, NOT A DEFAULT
 * 4. SILENCE IS BETTER THAN WEAK ACTION
 * 5. VANITY METRICS ARE FAILURES
 * 6. REPUTATION > SPEED > VOLUME
 */

// =====================================================
// EXECUTION MODE - FULL AUTO (LOCKED)
// =====================================================
export const EXECUTION_MODE = {
  AUTO_PUBLISH: true,
  MANUAL_REVIEW: false,
  DRAFT_MODE: false,
  IMMEDIATE_ACTION: true,
  HUMAN_IN_LOOP: false, // NEVER
};

// =====================================================
// INTENT CLASSIFICATION
// =====================================================
export type IntentType = 'NOISE' | 'DISCUSSION' | 'CURIOSITY' | 'ACTIVE_PAIN' | 'BUYING_SIGNAL';

export const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  NOISE: ['lol', 'haha', 'cool', 'nice', 'wow', 'interesting'],
  DISCUSSION: ['what do you think', 'opinions on', 'thoughts about', 'anyone else'],
  CURIOSITY: ['how does', 'what is', 'can someone explain', 'wondering'],
  ACTIVE_PAIN: [
    'lost', 'drained', 'hacked', 'scammed', 'stolen', 'rugged',
    'panic', 'help', 'urgent', 'emergency', 'mistake', 'wrong wallet',
    'sent to wrong', 'approved malicious', 'suspicious transaction'
  ],
  BUYING_SIGNAL: [
    'any tool', 'how can I check', 'what do you recommend', 'is there a way',
    'looking for', 'need a solution', 'best way to', 'how to prevent',
    'want to protect', 'need to verify', 'can someone suggest'
  ],
};

// Only proceed with these intents
export const ACTIONABLE_INTENTS: IntentType[] = ['ACTIVE_PAIN', 'BUYING_SIGNAL'];

// =====================================================
// PAIN SEVERITY SCORING (0-100)
// =====================================================
export const PAIN_WEIGHTS = {
  money_at_risk: 0.35,      // Money lost or at risk
  emotional_language: 0.20,  // panic, regret, fear
  personal_experience: 0.20, // "I", "my wallet", first person
  pattern_recurrence: 0.15,  // Repeated issue
  freshness: 0.10,           // How recent
};

export const PAIN_THRESHOLD = 75; // Hard threshold - below = NO ACTION

export const PAIN_INDICATORS = {
  money_keywords: ['lost', 'drained', 'stolen', 'scammed', '$', 'eth', 'usd', 'funds'],
  emotional_keywords: ['panic', 'scared', 'worried', 'regret', 'stupid', 'mistake', 'help', 'please'],
  personal_keywords: ['i ', 'my ', 'me ', 'mine', "i'm", "i've", 'my wallet', 'my funds'],
};

// =====================================================
// TRUST READINESS SCORING (0-100) - CRITICAL GATE
// =====================================================
export const TRUST_WEIGHTS = {
  received_free_value: 0.30,    // Actually got free value
  interaction_depth: 0.25,       // Deep engagement
  perceived_risk: -0.25,         // Crypto fear (negative)
  social_proof_available: 0.20,  // Testimonials, reviews visible
  timing: 0.10,                  // Calm vs panic state
};

export const TRUST_GATES = {
  BLOCK_PAYMENT: 60,  // Trust < 60 = BLOCK ANY PAYMENT FLOW
  FREE_ONLY: 79,      // Trust 60-79 = FREE/SOFT VALUE ONLY
  PAID_ALLOWED: 80,   // Trust >= 80 = PAID FLOW ALLOWED
};

// =====================================================
// OFFER MATCHING BY TRUST LEVEL
// =====================================================
export const OFFER_RULES = {
  low_trust: {
    min: 0,
    max: 59,
    allowed: [], // NO OFFERS
    action: 'SILENT',
  },
  medium_trust: {
    min: 60,
    max: 79,
    allowed: ['free_scan', 'insight', 'educational'],
    action: 'FREE_VALUE',
    forbidden: ['payment', 'checkout', 'pricing'],
  },
  high_trust: {
    min: 80,
    max: 100,
    allowed: ['single_paid_offer'],
    rules: {
      max_offers: 1,
      clear_scope: true,
      clear_outcome: true,
      no_upsell: true,
      no_bundles: true,
      no_premium_tiers: true,
    },
  },
};

// =====================================================
// ACTION DECISION ENGINE
// =====================================================
export const ACTION_REQUIREMENTS = {
  paid_flow: {
    min_pain: 75,
    buying_signal: true,
    min_trust: 80,
  },
  free_flow: {
    min_pain: 50,
    min_trust: 60,
  },
  outreach: {
    min_pain: 85,
    min_trust: 85,
    source_credibility: 'HIGH',
  },
};

// =====================================================
// VELOCITY GUARDS (HARD LIMITS)
// =====================================================
export const VELOCITY_LIMITS = {
  max_public_replies_per_day: 2,
  max_dm_per_day: 1,
  max_checkouts_per_day: 5, // If no payments, reduce to 1
  max_checkouts_throttled: 1, // When payment-first throttle kicks in
  cooldown_after_block_hours: 72,
};

// =====================================================
// PAYMENT-FIRST THROTTLE (CRITICAL)
// =====================================================
export const PAYMENT_THROTTLE = {
  window_hours: 24,
  checkout_threshold: 10, // If checkouts > N and payments = 0
  throttle_action: 'FREE_ONLY', // Force free-only mode
  auto_reduce_checkouts: true,
  sticky_duration_hours: 12, // Throttle stays locked for minimum 12h
};

// =====================================================
// TRUST CAP FOR NEW USERS (NO HISTORY)
// =====================================================
export const TRUST_CAP = {
  no_history_max: 70, // Cap trust at 70 if no interaction history
  min_interactions_for_paid: 2, // Need at least 2 interactions before paid flow
};

// =====================================================
// FREE VALUE EVENTS (What counts as real value)
// =====================================================
export const FREE_VALUE_EVENTS = {
  valid_event_types: [
    'scan_started',
    'results_viewed', 
    'time_on_page_30s',
    'report_downloaded',
    'risk_item_copied',
    'revoke_guide_opened',
  ],
  min_events_for_trust_boost: 1, // At least 1 real event to count as "received free value"
};

// =====================================================
// KILL SWITCHES (AUTOMATIC)
// =====================================================
export const KILL_SWITCHES = {
  no_engagement_threshold: 3,    // 3 actions with no engagement
  silent_mode_hours: 24,          // Silence duration
  negative_feedback_keywords: ['spam', 'bot', 'scam', 'reported', 'blocked', 'banned'],
  negative_feedback_silence_hours: 72,
};

// =====================================================
// PAYMENT FAILURE LEARNING
// =====================================================
export const FAILURE_LEARNING = {
  checkout_no_payment: {
    mark_as: 'HIGH_FRICTION',
    reduce_trust_weight: 0.1,
    block_same_flow: true,
  },
  metrics_to_ignore: ['signals', 'checkouts', 'drafts', 'traffic', 'views'],
  metrics_to_track: ['paid_transactions', 'revenue_usd', 'trust_to_payment_ratio'],
};

// =====================================================
// CONTENT GUARDRAILS (LOCKED)
// =====================================================
export const GUARDRAILS = {
  FORBIDDEN_WORDS: [
    // Marketing promises
    'guaranteed', 'risk-free', 'no-brainer', 'game-changer', 'revolutionary',
    'best in the market', 'number one', '#1', 'unbeatable',
    // Direct CTAs
    'buy now', 'sign up today', 'limited time', 'act now', 'dont miss',
    'exclusive offer', 'special deal', 'hurry',
    // Clickbait
    'you wont believe', 'shocking', 'secret', 'hack', 'trick',
    // Automation reveal
    'AI', 'bot', 'automated', 'automation', 'algorithm', 'machine learning',
    // Upsell language (NEW)
    'premium', 'pro version', 'upgrade', 'unlock', 'full access',
    'unlimited', 'bundle', 'package deal',
  ],
  
  FORUM_REPLY_RULES: {
    identify_with_pain: true,
    technical_insight: true,
    clear_solution: true,
    max_links: 1,
    no_cta: true,
    no_marketing: true,
  },
  
  DM_RULES: {
    single_message: true,
    no_followup: true,
    no_pitch: true,
  },
};

// =====================================================
// AI PROMPT TEMPLATES (UPDATED)
// =====================================================
export const AI_PROMPTS = {
  intent_classifier: `Classify this text into ONE category:
- NOISE: Casual, no problem
- DISCUSSION: General talk, no urgency
- CURIOSITY: Learning, no pain
- ACTIVE_PAIN: Real problem, emotional, money involved
- BUYING_SIGNAL: Actively seeking solution

Return ONLY the category name.`,

  pain_scorer: `Score the pain severity (0-100):
- Money at risk/lost: 35%
- Emotional language (panic/regret): 20%
- Personal experience ("I/my"): 20%
- Pattern/recurring issue: 15%
- Freshness: 10%

Return JSON: { "score": number, "factors": string[] }`,

  trust_scorer: `Score trust readiness (0-100):
- Received free value: 30%
- Interaction depth: 25%
- Crypto fear/skepticism: -25%
- Social proof seen: 20%
- Timing (calm vs panic): 10%

Return JSON: { "score": number, "recommendation": "BLOCK" | "FREE_ONLY" | "PAID_OK" }`,

  // Legacy prompts for backward compatibility
  lead_scorer: `You are a strict lead qualification AI for Trust-Gated Revenue Engine.

SCORING CRITERIA (0-100):
- Relevance to crypto/Web3 security: 25%
- Pain intensity (how urgent is their need): 25%
- Response likelihood (will they engage): 20%
- Credibility (real person, not spam): 15%
- Spam risk (lower = better): 15%

THRESHOLD: ≥80 = qualified, <80 = DISCARD

Return ONLY leads scoring ≥80.
For qualified leads, include:
- score: number (80-100)
- pain_points: string[]
- product_fit: string[]
- suggested_response: string (max 200 chars, VALUE FIRST, no marketing)

FORBIDDEN in suggested_response:
- Direct sales pitch
- Links
- Mentioning "AI", "bot", "automated"
- Exclamation marks (max 1)
- Marketing language

REQUIRED in suggested_response:
- Genuine helpfulness
- Shares insight/experience
- Ends with one open question (if appropriate)`,

  content_generator: `You are generating VALUE-FIRST content for Trust-Gated Revenue Engine.

ABSOLUTE RULES:
❌ NO marketing promises
❌ NO direct CTAs to buy/signup
❌ NO clickbait
❌ NO mentions of "AI", "bot", "automated"
❌ NO promotional language
❌ NO upsells, bundles, or premium tier mentions

✅ Share real experience
✅ Provide genuine insight
✅ Educational content
✅ Real examples
✅ Value before any product mention

If you cannot create content following these rules, return empty.
Quality over quantity - it's better to produce nothing than spam.`,

  response_generator: `Generate a response following these rules:
1. Identify with the pain briefly
2. Provide real technical insight
3. Offer clear solution
4. ONE link maximum
5. NO CTA, NO marketing language
6. NO mentions of AI/bot/automation
7. Keep it helpful and human

If you cannot help genuinely, return empty.`,
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function classifyIntent(text: string): IntentType {
  const lower = text.toLowerCase();
  
  // Check buying signal first (highest priority)
  if (INTENT_KEYWORDS.BUYING_SIGNAL.some(kw => lower.includes(kw))) {
    return 'BUYING_SIGNAL';
  }
  
  // Check active pain
  if (INTENT_KEYWORDS.ACTIVE_PAIN.some(kw => lower.includes(kw))) {
    return 'ACTIVE_PAIN';
  }
  
  // Check curiosity
  if (INTENT_KEYWORDS.CURIOSITY.some(kw => lower.includes(kw))) {
    return 'CURIOSITY';
  }
  
  // Check discussion
  if (INTENT_KEYWORDS.DISCUSSION.some(kw => lower.includes(kw))) {
    return 'DISCUSSION';
  }
  
  return 'NOISE';
}

export function isActionableIntent(intent: IntentType): boolean {
  return ACTIONABLE_INTENTS.includes(intent);
}

export function calculatePainScore(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;
  
  // Money at risk (35%)
  const moneyMatches = PAIN_INDICATORS.money_keywords.filter(kw => lower.includes(kw)).length;
  score += Math.min(35, moneyMatches * 10);
  
  // Emotional language (20%)
  const emotionalMatches = PAIN_INDICATORS.emotional_keywords.filter(kw => lower.includes(kw)).length;
  score += Math.min(20, emotionalMatches * 7);
  
  // Personal experience (20%)
  const personalMatches = PAIN_INDICATORS.personal_keywords.filter(kw => lower.includes(kw)).length;
  score += Math.min(20, personalMatches * 5);
  
  // Pattern/freshness approximation (25%)
  if (lower.includes('again') || lower.includes('always') || lower.includes('every time')) {
    score += 15;
  }
  if (lower.includes('just') || lower.includes('now') || lower.includes('today')) {
    score += 10;
  }
  
  return Math.min(100, score);
}

export function calculateTrustScore(
  receivedFreeValue: boolean,
  interactionCount: number,
  hasNegativeSentiment: boolean,
  socialProofVisible: boolean,
  isPanicking: boolean
): number {
  let score = 50; // Base score
  
  // Received free value (+30)
  if (receivedFreeValue) score += 30;
  
  // Interaction depth (+25 max)
  score += Math.min(25, interactionCount * 5);
  
  // Crypto fear/skepticism (-25)
  if (hasNegativeSentiment) score -= 25;
  
  // Social proof (+20)
  if (socialProofVisible) score += 20;
  
  // Timing - panic reduces trust
  if (isPanicking) score -= 10;
  
  // 🔒 TRUST CAP: If no interaction history, cap at 70 (FREE_ONLY max)
  if (interactionCount < TRUST_CAP.min_interactions_for_paid) {
    score = Math.min(score, TRUST_CAP.no_history_max);
  }
  
  return Math.max(0, Math.min(100, score));
}

export function getTrustAction(trustScore: number): 'BLOCK' | 'FREE_ONLY' | 'PAID_OK' {
  if (trustScore < TRUST_GATES.BLOCK_PAYMENT) return 'BLOCK';
  if (trustScore < TRUST_GATES.PAID_ALLOWED) return 'FREE_ONLY';
  return 'PAID_OK';
}

/**
 * Payment-First Throttle: Check if system should throttle checkouts
 * Returns true if we should block paid flows due to 0 conversions
 */
export function shouldThrottleCheckouts(
  recentCheckouts: number,
  recentPayments: number
): boolean {
  if (recentPayments > 0) return false; // At least one payment = OK
  return recentCheckouts >= PAYMENT_THROTTLE.checkout_threshold;
}

/**
 * Check if throttle is currently active (Sticky Throttle)
 * Returns true if throttle_until hasn't expired yet
 */
export function isThrottleActive(throttleUntil: string | null): boolean {
  if (!throttleUntil) return false;
  return new Date(throttleUntil) > new Date();
}

/**
 * Calculate when throttle should expire (Sticky duration)
 */
export function getThrottleExpiry(): string {
  const expiryMs = Date.now() + (PAYMENT_THROTTLE.sticky_duration_hours * 60 * 60 * 1000);
  return new Date(expiryMs).toISOString();
}

/**
 * Get max checkouts allowed based on payment history
 */
export function getMaxCheckoutsAllowed(recentPayments: number): number {
  if (recentPayments === 0 && PAYMENT_THROTTLE.auto_reduce_checkouts) {
    return VELOCITY_LIMITS.max_checkouts_throttled;
  }
  return VELOCITY_LIMITS.max_checkouts_per_day;
}

/**
 * Check if a free value event is valid (not just forum reply)
 */
export function isValidFreeValueEvent(eventType: string): boolean {
  return FREE_VALUE_EVENTS.valid_event_types.includes(eventType);
}

/**
 * HARD BLOCK: Check if paid flow is allowed
 * Enforces min_interactions REGARDLESS of trust score
 */
export function canCreateCheckout(
  painScore: number, 
  hasBuyingSignal: boolean, 
  trustScore: number,
  interactionCount: number
): boolean {
  // 🔒 HARD BLOCK: Must have minimum interactions
  if (interactionCount < TRUST_CAP.min_interactions_for_paid) {
    return false;
  }
  
  return (
    painScore >= ACTION_REQUIREMENTS.paid_flow.min_pain &&
    hasBuyingSignal === ACTION_REQUIREMENTS.paid_flow.buying_signal &&
    trustScore >= ACTION_REQUIREMENTS.paid_flow.min_trust
  );
}

export function canSendOutreach(painScore: number, trustScore: number): boolean {
  return (
    painScore >= ACTION_REQUIREMENTS.outreach.min_pain &&
    trustScore >= ACTION_REQUIREMENTS.outreach.min_trust
  );
}

export function validateContent(content: string): { valid: boolean; reason?: string } {
  const lower = content.toLowerCase();
  
  for (const word of GUARDRAILS.FORBIDDEN_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      return { valid: false, reason: `Contains forbidden word: ${word}` };
    }
  }
  
  // Check exclamation spam
  const exclamationCount = (content.match(/!/g) || []).length;
  if (exclamationCount > 1) {
    return { valid: false, reason: 'Too many exclamation marks' };
  }
  
  return { valid: true };
}

// KPI: Only these matter
export function isVanityMetric(metricName: string): boolean {
  return FAILURE_LEARNING.metrics_to_ignore.includes(metricName.toLowerCase());
}

export function isRevenueMetric(metricName: string): boolean {
  return FAILURE_LEARNING.metrics_to_track.includes(metricName.toLowerCase());
}

// =====================================================
// BACKWARD COMPATIBILITY - Legacy exports
// =====================================================

// Legacy SCORING object for backward compatibility
export const SCORING = {
  AUTO_PUBLISH_THRESHOLD: 80,
  AUTO_OUTREACH_THRESHOLD: 80,
  MINIMUM_RELEVANCE: 50,
  WEIGHTS: {
    relevance: 0.25,
    pain_intensity: 0.25,
    response_likelihood: 0.20,
    credibility: 0.15,
    spam_risk_inverse: 0.15,
  },
};

// Legacy LIMITS object
export const LIMITS = {
  MAX_POSTS_PER_DAY: 2,
  MAX_POSTS_PER_PLATFORM_PER_DAY: 1,
  MAX_OUTREACH_PER_DAY: VELOCITY_LIMITS.max_dm_per_day,
  DEDUP_WINDOW_HOURS: 72,
  MIN_DELAY_BETWEEN_POSTS_MS: 15 * 60 * 1000,
  RANDOM_DELAY_RANGE_MS: [15 * 60 * 1000, 45 * 60 * 1000] as [number, number],
  BLOCK_RISK_INDICATORS: [
    'rate limit', 'too many requests', 'blocked', 'banned',
    'suspicious activity', 'spam detected', 'account suspended',
  ],
};

// Legacy PLATFORM_CONFIG
export const PLATFORM_CONFIG: Record<string, {
  enabled: boolean;
  auto_publish: boolean;
  style: string;
  delay_range_ms: [number, number];
}> = {
  hackernews: {
    enabled: true,
    auto_publish: true,
    style: 'minimalist_informative',
    delay_range_ms: [5000, 15000],
  },
  reddit: {
    enabled: true,
    auto_publish: true,
    style: 'authentic_user',
    delay_range_ms: [15 * 60 * 1000, 45 * 60 * 1000],
  },
  twitter: {
    enabled: true,
    auto_publish: true,
    style: 'casual_helpful',
    delay_range_ms: [5 * 60 * 1000, 15 * 60 * 1000],
  },
  devto: {
    enabled: true,
    auto_publish: true,
    style: 'educational_technical',
    delay_range_ms: [30 * 60 * 1000, 60 * 60 * 1000],
  },
};

// Legacy helper functions
export function shouldAutoPublish(score: number): boolean {
  return EXECUTION_MODE.AUTO_PUBLISH && score >= SCORING.AUTO_PUBLISH_THRESHOLD;
}

export function shouldOutreach(score: number): boolean {
  return EXECUTION_MODE.IMMEDIATE_ACTION && score >= SCORING.AUTO_OUTREACH_THRESHOLD;
}

export function getContentStatus(score: number): 'published' | 'archived' {
  if (!EXECUTION_MODE.DRAFT_MODE && score >= SCORING.AUTO_PUBLISH_THRESHOLD) {
    return 'published';
  }
  return 'archived';
}

export function getRandomDelay(platform: string): number {
  if (EXECUTION_MODE.IMMEDIATE_ACTION) {
    return Math.floor(Math.random() * 5 * 60 * 1000); // 0-5 min
  }
  const config = PLATFORM_CONFIG[platform];
  if (!config) {
    return LIMITS.RANDOM_DELAY_RANGE_MS[0];
  }
  const [min, max] = config.delay_range_ms;
  return Math.floor(Math.random() * (max - min) + min);
}

export function detectBlockRisk(errorMessage: string): boolean {
  const lower = errorMessage.toLowerCase();
  return LIMITS.BLOCK_RISK_INDICATORS.some(indicator => lower.includes(indicator));
}
