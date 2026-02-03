/**
 * 🧠💰 MASTER SYSTEM PROMPT
 * AUTONOMOUS AI SALES & CUSTOMER INTELLIGENCE ENGINE
 * FULL AUTO – TRUST-GATED – CUSTOMER DNA DRIVEN
 * 
 * ROLE: Chief Revenue Officer + Head of Customer Psychology
 * 
 * NON-NEGOTIABLE PRINCIPLES:
 * 1. NO HUMAN APPROVAL — EVER
 * 2. NO TRUST = NO PAYMENT FLOW
 * 3. CHECKOUT IS A PRIVILEGE, NOT A DEFAULT
 * 4. SILENCE IS BETTER THAN WEAK ACTION
 * 5. VANITY METRICS ARE FAILURES
 * 6. REPUTATION > SPEED > VOLUME
 * 7. אין מכירה אגרסיבית - בניית אמון לפני כסף
 * 8. כל החלטת מכירה מבוססת דאטה + התנהגות לקוח
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
// 🧬 CUSTOMER DNA ENGINE - Layer 1
// =====================================================
export type BuyingStyle = 'cautious' | 'explorer' | 'fast-buyer' | 'skeptic' | 'unknown';
export type TechnicalLevel = 'beginner' | 'intermediate' | 'advanced' | 'unknown';
export type EmotionalState = 'calm' | 'curious' | 'confused' | 'panicking' | 'skeptical' | 'ready';

export interface CustomerDNA {
  trust_level: number;           // 0-100
  fear_signals: string[];        // Detected fears
  curiosity_level: number;       // 0-100
  technical_level: TechnicalLevel;
  buying_style: BuyingStyle;
  time_to_value: boolean;        // Has received real value
  objections_history: string[];  // Past objections
  preferred_channel: string;
  engagement_velocity: number;   // Interactions per day
  payment_resistance_score: number; // 0-100 (high = resistant)
  lifetime_value_prediction: number;
  churn_risk: number;           // 0-1
}

// DNA Thresholds
export const DNA_THRESHOLDS = {
  // Trust levels for different actions
  SAFE_MODE_TRIGGER: 40,        // Below = SAFE MODE (educate only)
  FREE_VALUE_ALLOWED: 60,       // 40-60 = free value only
  PAID_CONSIDERATION: 80,       // 60-80 = can discuss paid, no push
  FULL_OFFER: 90,               // 80+ = can make offer
  
  // Fear detection triggers safe mode
  MAX_FEAR_SIGNALS: 2,          // More than 2 = forced safe mode
  
  // Confusion detection
  CONFUSION_KEYWORDS: ['מה זה בכלל', 'לא הבנתי', 'what is this', 'confused', 'not sure', 'איך זה עובד'],
  
  // Minimum value before sale
  MIN_VALUE_EVENTS_FOR_SALE: 2,
};

// =====================================================
// 🎭 EMOTIONAL & COGNITIVE ANALYSIS - Layer 2
// =====================================================
export const EMOTIONAL_SIGNALS = {
  // Fear/Risk Aversion
  fear_keywords: [
    'scared', 'worried', 'afraid', 'nervous', 'risky', 'dangerous',
    'מפחד', 'חושש', 'מסוכן', 'פוחד', 'לא בטוח',
    'lose money', 'get hacked', 'scam', 'fraud',
  ],
  
  // Confusion/Cognitive Overload
  confusion_keywords: [
    'confused', 'dont understand', "don't get it", 'complicated', 'too much',
    'מבולבל', 'לא מבין', 'מסובך', 'יותר מדי',
    'what do you mean', 'can you explain', 'תסביר לי',
  ],
  
  // Curiosity (positive)
  curiosity_keywords: [
    'interesting', 'how does', 'tell me more', 'curious', 'want to know',
    'מעניין', 'איך זה', 'ספר לי עוד', 'סקרן',
  ],
  
  // Control need
  control_keywords: [
    'i want to control', 'my decision', 'let me decide', 'options',
    'אני רוצה לשלוט', 'ההחלטה שלי', 'תן לי לבחור',
  ],
  
  // Money anxiety
  money_anxiety_keywords: [
    'waste money', 'too expensive', 'cant afford', 'burn money',
    'בזבוז כסף', 'יקר מדי', 'לא יכול להרשות', 'שריפת כסף',
  ],
};

// =====================================================
// 🛡️ TRUST-FIRST SALES STRATEGY - Layer 3
// =====================================================
export const TRUST_FIRST_RULES = {
  // HARD BLOCK conditions for payment
  block_payment_if: {
    trust_level_below: 80,
    free_value_events_below: 2,
    time_to_value: false,
  },
  
  // Alternative actions when blocked
  alternatives: [
    'explanation',      // הסבר
    'demonstration',    // הדגמה
    'free_result',      // תוצאה חינמית
    'success_story',    // סיפור שימוש אמיתי
    'before_after',     // השוואה לפני/אחרי
  ],
  
  // Trust building events
  trust_boosters: {
    scan_completed: 10,
    results_viewed: 5,
    time_on_page_60s: 5,
    report_downloaded: 15,
    return_visit: 10,
    positive_feedback: 20,
  },
  
  // Trust reducers
  trust_reducers: {
    abandoned_checkout: -15,
    ignored_message: -5,
    quick_bounce: -10,
    negative_feedback: -30,
  },
};

// =====================================================
// 🎯 ADAPTIVE OFFER ENGINE - Layer 4
// =====================================================
export type AdaptiveStrategy = 'micro_offer' | 'trial' | 'direct' | 'pay_after_value' | 'educate_only';

export interface OfferStrategy {
  strategy: AdaptiveStrategy;
  reason: string;
  allowed_actions: string[];
  forbidden_actions: string[];
}

export const ADAPTIVE_STRATEGIES: Record<BuyingStyle, OfferStrategy> = {
  skeptic: {
    strategy: 'micro_offer',
    reason: 'Low commitment to reduce perceived risk',
    allowed_actions: ['micro_trial', 'free_scan', 'money_back_guarantee'],
    forbidden_actions: ['direct_checkout', 'upsell', 'bundle'],
  },
  explorer: {
    strategy: 'trial',
    reason: 'Wants to test before committing',
    allowed_actions: ['free_trial', 'demo', 'sandbox_access'],
    forbidden_actions: ['hard_sell', 'limited_time'],
  },
  'fast-buyer': {
    strategy: 'direct',
    reason: 'Ready to buy, dont slow them down',
    allowed_actions: ['direct_checkout', 'quick_start'],
    forbidden_actions: ['excessive_education', 'too_many_steps'],
  },
  cautious: {
    strategy: 'pay_after_value',
    reason: 'Needs to see value before paying',
    allowed_actions: ['free_first', 'guarantee', 'refund_policy', 'testimonials'],
    forbidden_actions: ['upfront_payment', 'no_refund'],
  },
  unknown: {
    strategy: 'educate_only',
    reason: 'Insufficient data - gather more before offering',
    allowed_actions: ['free_value', 'education', 'questions'],
    forbidden_actions: ['any_paid_offer', 'checkout'],
  },
};

// Offer components for trust building
export const OFFER_TRUST_COMPONENTS = {
  always_include: [
    'למה זה בטוח',           // Why it's safe
    'מה קורה אם לא עובד',    // What if it doesn't work
    'איך יוצאים בלי כאב',    // How to exit painlessly
  ],
  optional: [
    'money_back_guarantee',
    'free_cancellation',
    'no_credit_card_required',
  ],
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

// =====================================================
// 🎙️ CONVERSATIONAL AI TONE - Layer 5
// =====================================================
export const CONVERSATION_TONE = {
  // Required tone attributes
  required: [
    'human',           // אנושי
    'calm',            // רגוע
    'not_pushy',       // לא לוחץ
    'supportive',      // "אנחנו איתך, לא נגדך"
  ],
  
  // Forbidden elements
  forbidden: [
    'FOMO',            // Fear of missing out
    'pressure',        // לחץ
    'manipulation',    // מניפולציות
    'artificial_urgency',
  ],
  
  // Required elements
  include: [
    'transparency',    // שקיפות
    'empathy',         // אמפתיה
    'confidence_building', // חיזוק ביטחון
  ],
};

// =====================================================
// 🔄 CONTINUOUS LEARNING LOOP - Layer 6
// =====================================================
export interface FeedbackLoop {
  what_worked: string[];
  what_failed: string[];
  objections_detected: string[];
  revenue_result: number;
  churn_risk: number;
  trust_delta: number;
}

export const LEARNING_RULES = {
  // After each interaction, update:
  update_on_interaction: [
    'customer_dna',
    'sales_strategy',
    'offer_timing',
    'messaging_style',
  ],
  
  // Success indicators
  success_signals: [
    'payment_completed',
    'positive_feedback',
    'return_visit',
    'referral',
  ],
  
  // Failure indicators
  failure_signals: [
    'abandoned_checkout',
    'negative_feedback',
    'unsubscribe',
    'complaint',
  ],
};

// =====================================================
// 🛑 KILL GATES (ENHANCED) - Safety Layer
// =====================================================
export const ENHANCED_KILL_GATES = {
  // Stop sale immediately if:
  stop_sale_if: {
    customer_confused: true,          // לקוח מבולבל
    asked_what_is_this: true,         // שאל יותר מדי "מה זה בכלל"
    no_value_seen: true,              // לא ראה ערך בפועל
    previous_payment_failed: true,    // נכשל בתשלום קודם
  },
  
  // Action on kill gate
  fallback_action: 'educate_and_value', // חזור לחינוך + ערך
  
  // Cool-off period after kill gate
  cooloff_hours: 24,
};

// =====================================================
// 📈 KPI MEASUREMENTS
// =====================================================
export const SUCCESS_KPIS = {
  // Primary metrics
  primary: [
    'trust_growth',           // Trust Growth
    'time_to_first_value',    // Time To First Value
    'conversion_after_value', // Conversion After Value
    'churn_prevention',       // Churn Prevention
    'revenue_per_customer',   // Revenue / Customer
  ],
  
  // Hard requirement
  negative_feedback_target: 0, // Must be ZERO
  
  // Golden rule
  golden_rule: 'If you are not sure customer will say "wow, this helped me" — DO NOT SELL',
};

// =====================================================
// 🧠 DNA ANALYSIS FUNCTIONS
// =====================================================

/**
 * Detect fear signals in text
 */
export function detectFearSignals(text: string): string[] {
  const lower = text.toLowerCase();
  const detected: string[] = [];
  
  for (const keyword of EMOTIONAL_SIGNALS.fear_keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      detected.push(keyword);
    }
  }
  
  return detected;
}

/**
 * Detect confusion signals
 */
export function detectConfusion(text: string): boolean {
  const lower = text.toLowerCase();
  return EMOTIONAL_SIGNALS.confusion_keywords.some(kw => lower.includes(kw.toLowerCase())) ||
         DNA_THRESHOLDS.CONFUSION_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Detect curiosity level (0-100)
 */
export function detectCuriosity(text: string): number {
  const lower = text.toLowerCase();
  let score = 30; // Base
  
  for (const keyword of EMOTIONAL_SIGNALS.curiosity_keywords) {
    if (lower.includes(keyword.toLowerCase())) {
      score += 15;
    }
  }
  
  // Questions indicate curiosity
  const questionCount = (text.match(/\?/g) || []).length;
  score += questionCount * 10;
  
  return Math.min(100, score);
}

/**
 * Detect money anxiety
 */
export function detectMoneyAnxiety(text: string): boolean {
  const lower = text.toLowerCase();
  return EMOTIONAL_SIGNALS.money_anxiety_keywords.some(kw => lower.includes(kw.toLowerCase()));
}

/**
 * Classify buying style from behavior
 */
export function classifyBuyingStyle(
  fearSignals: string[],
  curiosityLevel: number,
  interactionVelocity: number,
  hasMoneyAnxiety: boolean,
  previousPurchases: number
): BuyingStyle {
  // Fast buyer: low fear, has purchased before, high velocity
  if (fearSignals.length === 0 && previousPurchases > 0 && interactionVelocity > 2) {
    return 'fast-buyer';
  }
  
  // Skeptic: high fear, money anxiety
  if (fearSignals.length >= 2 || hasMoneyAnxiety) {
    return 'skeptic';
  }
  
  // Explorer: high curiosity, some interactions
  if (curiosityLevel > 60 && interactionVelocity > 0.5) {
    return 'explorer';
  }
  
  // Cautious: moderate fear, slow velocity
  if (fearSignals.length > 0 || interactionVelocity < 0.3) {
    return 'cautious';
  }
  
  return 'unknown';
}

/**
 * Detect current emotional state
 */
export function detectEmotionalState(
  text: string,
  fearSignals: string[],
  confusionDetected: boolean,
  curiosityLevel: number,
  trustLevel: number
): EmotionalState {
  // Panicking
  if (fearSignals.length >= 2 || PAIN_INDICATORS.emotional_keywords.some(kw => text.toLowerCase().includes(kw))) {
    return 'panicking';
  }
  
  // Confused
  if (confusionDetected) {
    return 'confused';
  }
  
  // Skeptical
  if (fearSignals.length === 1 || trustLevel < 50) {
    return 'skeptical';
  }
  
  // Curious
  if (curiosityLevel > 60) {
    return 'curious';
  }
  
  // Ready
  if (trustLevel >= 80 && fearSignals.length === 0) {
    return 'ready';
  }
  
  return 'calm';
}

/**
 * Get adaptive offer strategy based on DNA
 */
export function getAdaptiveStrategy(dna: CustomerDNA): OfferStrategy {
  // Force safe mode if too many fear signals
  if (dna.fear_signals.length > DNA_THRESHOLDS.MAX_FEAR_SIGNALS) {
    return {
      strategy: 'educate_only',
      reason: 'Too many fear signals detected - need trust building',
      allowed_actions: ['free_value', 'education', 'reassurance'],
      forbidden_actions: ['any_offer', 'checkout', 'pricing'],
    };
  }
  
  // Force safe mode if no value received
  if (!dna.time_to_value) {
    return {
      strategy: 'educate_only',
      reason: 'Customer hasnt seen value yet',
      allowed_actions: ['free_scan', 'demo', 'free_result'],
      forbidden_actions: ['paid_offer', 'checkout'],
    };
  }
  
  return ADAPTIVE_STRATEGIES[dna.buying_style];
}

/**
 * Check if sale is allowed based on DNA
 */
export function canMakeSale(dna: CustomerDNA): { allowed: boolean; reason: string } {
  if (dna.trust_level < TRUST_FIRST_RULES.block_payment_if.trust_level_below) {
    return { 
      allowed: false, 
      reason: `Trust level ${dna.trust_level} below threshold ${TRUST_FIRST_RULES.block_payment_if.trust_level_below}` 
    };
  }
  
  if (!dna.time_to_value) {
    return { 
      allowed: false, 
      reason: 'Customer has not received value yet' 
    };
  }
  
  if (dna.fear_signals.length > DNA_THRESHOLDS.MAX_FEAR_SIGNALS) {
    return { 
      allowed: false, 
      reason: `Too many fear signals: ${dna.fear_signals.join(', ')}` 
    };
  }
  
  return { allowed: true, reason: 'All trust gates passed' };
}

/**
 * Update DNA trust level based on event
 */
export function updateDNATrust(
  currentTrust: number, 
  event: string, 
  isPositive: boolean
): number {
  const boosters = TRUST_FIRST_RULES.trust_boosters;
  const reducers = TRUST_FIRST_RULES.trust_reducers;
  
  let delta = 0;
  
  if (isPositive && event in boosters) {
    delta = boosters[event as keyof typeof boosters];
  } else if (!isPositive && event in reducers) {
    delta = reducers[event as keyof typeof reducers];
  }
  
  return Math.max(0, Math.min(100, currentTrust + delta));
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

// =====================================================
// LEAD FINGERPRINTING (Stable Identity) - v2 with SHA-256
// =====================================================

/**
 * Normalize a URL for stable fingerprinting
 * - Treats http and https as SAME (protocol agnostic)
 * - Remove query params, fragments, trailing slashes
 * - Lowercase host
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    // Use https as canonical protocol (ignore http/https difference)
    const protocol = 'https:';
    const host = parsed.host.toLowerCase();
    let pathname = parsed.pathname;
    // Remove trailing slash (except for root)
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${protocol}//${host}${pathname}`;
  } catch {
    // If URL parsing fails, do basic normalization
    return url
      .toLowerCase()
      .replace(/^http:/, 'https:')
      .split('?')[0]
      .split('#')[0]
      .replace(/\/$/, '');
  }
}

/**
 * SHA-256 hash for URL fingerprinting (async)
 * Returns 16 hex chars
 * 
 * REPLACES old 32-bit homebrew hash!
 */
export async function hashUrlSHA256(url: string): Promise<string> {
  const normalized = normalizeUrl(url);
  if (!normalized) return 'no-url';
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex.slice(0, 16); // 16 hex chars
}

/**
 * SYNC fallback for SHA-256 (using Web Crypto when available)
 * For backwards compatibility - prefer async version
 */
function hashStringSHA256Sync(str: string): string {
  // Simple but deterministic hash for sync contexts
  // This is a placeholder - in production, always use async version
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  return (Math.abs(hash1).toString(16) + Math.abs(hash2).toString(16)).slice(0, 16);
}

/**
 * Compute ACTOR FINGERPRINT (stable person identity)
 * Format: platform::author (NO URL hash!)
 * 
 * This is the CANONICAL identity - use for actor_profiles.fingerprint
 */
export function computeActorFingerprint(platform: string, author: string | null): string {
  const normalizedPlatform = (platform || 'unknown').toLowerCase().trim();
  const normalizedAuthor = (author || 'anonymous').toLowerCase().trim();
  return `${normalizedPlatform}::${normalizedAuthor}`;
}

/**
 * Compute LEAD KEY (context key with URL hash)
 * Format: platform::author::url_hash
 * 
 * Use for decision_traces, event linking - NOT for actor identity
 * 
 * @deprecated Use async computeLeadKeyAsync instead for SHA-256
 */
export function computeLeadKey(
  platform: string, 
  author: string | null, 
  sourceUrl: string | null
): string {
  const normalizedPlatform = (platform || 'unknown').toLowerCase().trim();
  const normalizedAuthor = (author || 'anonymous').toLowerCase().trim();
  const normalizedUrl = normalizeUrl(sourceUrl || '');
  
  // Use SHA-256-like sync hash (for backwards compat)
  const urlHash = normalizedUrl ? hashStringSHA256Sync(normalizedUrl) : 'no-url';
  
  return `${normalizedPlatform}::${normalizedAuthor}::${urlHash}`;
}

/**
 * Compute LEAD KEY with proper SHA-256 (async)
 * Format: platform::author::url_hash
 */
export async function computeLeadKeyAsync(
  platform: string, 
  author: string | null, 
  sourceUrl: string | null
): Promise<string> {
  const actorFingerprint = computeActorFingerprint(platform, author);
  const urlHash = await hashUrlSHA256(sourceUrl || '');
  return `${actorFingerprint}::${urlHash}`;
}

/**
 * Check if a fingerprint is in the OLD (bad) lead_key pattern
 * Bad pattern: platform::author::hash (contains 3 parts)
 * Good pattern: platform::author (exactly 2 parts)
 */
export function isIdentitySplit(fingerprint: string): boolean {
  const parts = fingerprint.split('::');
  return parts.length > 2;
}

/**
 * Extract actor fingerprint from a lead_key
 * lead_key format: platform::author::hash
 * Returns: platform::author
 */
export function extractActorFromLeadKey(leadKey: string): string {
  const parts = leadKey.split('::');
  if (parts.length >= 2) {
    return `${parts[0]}::${parts[1]}`;
  }
  return leadKey;
}

/**
 * Extract author from signal payload based on platform conventions
 */
export function extractAuthorFromPayload(payload: Record<string, unknown>): string | null {
  // Try common author field names in order of preference
  return (
    (payload.author as string) ||
    (payload.username as string) ||
    (payload.user as string) ||
    (payload.by as string) || // HN style
    (payload.reddit_user as string) ||
    (payload.twitter_handle as string) ||
    null
  );
}

/**
 * Extract platform from signal payload
 */
export function extractPlatformFromPayload(payload: Record<string, unknown>, fallbackCategory?: string): string {
  return (
    (payload.platform as string) ||
    (payload.source as string) ||
    fallbackCategory ||
    'unknown'
  );
}
