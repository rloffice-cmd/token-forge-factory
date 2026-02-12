# SignalForge — Complete Technical Specification for Replit Migration
## Generated: 2026-02-12 | Version: FORENSIC EXPORT v1.0

> **Purpose**: This document contains 100% of the system intelligence, prompts, schemas, and logic flows needed to rebuild SignalForge in a new environment.

---

# TABLE OF CONTENTS

1. [System Prompts (The Brains)](#1-system-prompts-the-brains)
2. [Full SQL Schema](#2-full-sql-schema)
3. [Edge Function Logic Flows](#3-edge-function-logic-flows)
4. [Integration Map](#4-integration-map)
5. [The /go/ Redirect Logic](#5-the-go-redirect-logic)
6. [Complete Code Reference](#6-complete-code-reference)

---

# 1. SYSTEM PROMPTS (THE BRAINS)

## 1.1 Master System Prompt (master-prompt-config.ts)

This is the CORE intelligence file. Every Edge Function imports from it.

### Role Definition
```
AUTONOMOUS AI SALES & CUSTOMER INTELLIGENCE ENGINE
FULL AUTO – TRUST-GATED – CUSTOMER DNA DRIVEN

ROLE: Chief Revenue Officer + Head of Customer Psychology

NON-NEGOTIABLE PRINCIPLES:
1. NO HUMAN APPROVAL — EVER
2. NO TRUST = NO PAYMENT FLOW
3. CHECKOUT IS A PRIVILEGE, NOT A DEFAULT
4. SILENCE IS BETTER THAN WEAK ACTION
5. VANITY METRICS ARE FAILURES
6. REPUTATION > SPEED > VOLUME
7. אין מכירה אגרסיבית - בניית אמון לפני כסף
8. כל החלטת מכירה מבוססת דאטה + התנהגות לקוח
```

### Execution Mode (LOCKED)
```typescript
export const EXECUTION_MODE = {
  AUTO_PUBLISH: true,
  MANUAL_REVIEW: false,
  DRAFT_MODE: false,
  IMMEDIATE_ACTION: true,
  HUMAN_IN_LOOP: false, // NEVER
};
```

### 1.2 AI Prompt: Intent Classifier
```
Classify this text into ONE category:
- NOISE: Casual, no problem
- DISCUSSION: General talk, no urgency
- CURIOSITY: Learning, no pain
- ACTIVE_PAIN: Real problem, emotional, money involved
- BUYING_SIGNAL: Actively seeking solution

Return ONLY the category name.
```

### 1.3 AI Prompt: Pain Scorer
```
Score the pain severity (0-100):
- Money at risk/lost: 35%
- Emotional language (panic/regret): 20%
- Personal experience ("I/my"): 20%
- Pattern/recurring issue: 15%
- Freshness: 10%

Return JSON: { "score": number, "factors": string[] }
```

### 1.4 AI Prompt: Trust Scorer
```
Score trust readiness (0-100):
- Received free value: 30%
- Interaction depth: 25%
- Crypto fear/skepticism: -25%
- Social proof seen: 20%
- Timing (calm vs panic): 10%

Return JSON: { "score": number, "recommendation": "BLOCK" | "FREE_ONLY" | "PAID_OK" }
```

### 1.5 AI Prompt: Lead Scorer (Legacy)
```
You are a strict lead qualification AI for Trust-Gated Revenue Engine.

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
- Ends with one open question (if appropriate)
```

### 1.6 AI Prompt: Content Generator
```
You are generating VALUE-FIRST content for Trust-Gated Revenue Engine.

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
Quality over quantity - it's better to produce nothing than spam.
```

### 1.7 AI Prompt: Response Generator
```
Generate a response following these rules:
1. Identify with the pain briefly
2. Provide real technical insight
3. Offer clear solution
4. ONE link maximum
5. NO CTA, NO marketing language
6. NO mentions of AI/bot/automation
7. Keep it helpful and human

If you cannot help genuinely, return empty.
```

### 1.8 AI Prompt: Email Personalization (in automated-outreach)
```
System: You write hyper-personalized email opening sentences. One sentence only, max 25 words. Sound like a knowledgeable peer, NOT a marketer. Reference the lead's specific pain or industry. Never mention AI, automation, or affiliates.

User: Lead name: {{NAME}}. Their intent: "{{INTENT_TOPIC}}". Category: {{CATEGORY}}. Partner solution: {{PARTNER}}. Write ONE personalized opening sentence.
```

---

## 1.9 Customer DNA Engine — Complete Type System

```typescript
// Types
export type BuyingStyle = 'cautious' | 'explorer' | 'fast-buyer' | 'skeptic' | 'unknown';
export type TechnicalLevel = 'beginner' | 'intermediate' | 'advanced' | 'unknown';
export type EmotionalState = 'calm' | 'curious' | 'confused' | 'panicking' | 'skeptical' | 'ready';
export type IntentType = 'NOISE' | 'DISCUSSION' | 'CURIOSITY' | 'ACTIVE_PAIN' | 'BUYING_SIGNAL';
export type AdaptiveStrategy = 'micro_offer' | 'trial' | 'direct' | 'pay_after_value' | 'educate_only';

export interface CustomerDNA {
  trust_level: number;           // 0-100
  fear_signals: string[];
  curiosity_level: number;       // 0-100
  technical_level: TechnicalLevel;
  buying_style: BuyingStyle;
  time_to_value: boolean;        // Has received real value
  objections_history: string[];
  preferred_channel: string;
  engagement_velocity: number;   // Interactions per day
  payment_resistance_score: number; // 0-100
  lifetime_value_prediction: number;
  churn_risk: number;           // 0-1
}
```

### DNA Thresholds
```typescript
export const DNA_THRESHOLDS = {
  SAFE_MODE_TRIGGER: 40,        // Below = SAFE MODE (educate only)
  FREE_VALUE_ALLOWED: 60,       // 40-60 = free value only
  PAID_CONSIDERATION: 80,       // 60-80 = can discuss paid, no push
  FULL_OFFER: 90,               // 80+ = can make offer
  MAX_FEAR_SIGNALS: 2,          // More than 2 = forced safe mode
  CONFUSION_KEYWORDS: ['מה זה בכלל', 'לא הבנתי', 'what is this', 'confused', 'not sure', 'איך זה עובד'],
  MIN_VALUE_EVENTS_FOR_SALE: 2,
};
```

### Trust Gates
```typescript
export const TRUST_GATES = {
  BLOCK_PAYMENT: 60,  // Trust < 60 = BLOCK ANY PAYMENT FLOW
  FREE_ONLY: 79,      // Trust 60-79 = FREE/SOFT VALUE ONLY
  PAID_ALLOWED: 80,   // Trust >= 80 = PAID FLOW ALLOWED
};
```

### Velocity Limits
```typescript
export const VELOCITY_LIMITS = {
  max_public_replies_per_day: 2,
  max_dm_per_day: 1,
  max_checkouts_per_day: 5,
  max_checkouts_throttled: 1,
  cooldown_after_block_hours: 72,
};
```

### Payment Throttle
```typescript
export const PAYMENT_THROTTLE = {
  window_hours: 24,
  checkout_threshold: 10,
  throttle_action: 'FREE_ONLY',
  auto_reduce_checkouts: true,
  sticky_duration_hours: 12,
};
```

### Trust Cap
```typescript
export const TRUST_CAP = {
  no_history_max: 70,
  min_interactions_for_paid: 2,
};
```

### Content Guardrails
```typescript
export const GUARDRAILS = {
  FORBIDDEN_WORDS_WHOLE: ['AI', 'bot', 'bots'],
  FORBIDDEN_PHRASES: [
    'guaranteed', 'risk-free', 'no-brainer', 'game-changer', 'revolutionary',
    'best in the market', 'number one', '#1', 'unbeatable',
    'buy now', 'sign up today', 'limited time', 'act now', 'dont miss',
    'exclusive offer', 'special deal', 'hurry',
    'you wont believe', 'shocking', 'secret hack', 'secret trick',
    'automated system', 'automation tool', 'machine learning', 'artificial intelligence',
    'premium tier', 'pro version', 'upgrade now', 'unlock full', 'full access',
    'unlimited plan', 'bundle deal', 'package deal',
  ],
};
```

### Emotional Signal Keywords
```typescript
export const EMOTIONAL_SIGNALS = {
  fear_keywords: [
    'scared', 'worried', 'afraid', 'nervous', 'risky', 'dangerous',
    'מפחד', 'חושש', 'מסוכן', 'פוחד', 'לא בטוח',
    'lose money', 'get hacked', 'scam', 'fraud',
  ],
  confusion_keywords: [
    'confused', 'dont understand', "don't get it", 'complicated', 'too much',
    'מבולבל', 'לא מבין', 'מסובך', 'יותר מדי',
    'what do you mean', 'can you explain', 'תסביר לי',
  ],
  curiosity_keywords: [
    'interesting', 'how does', 'tell me more', 'curious', 'want to know',
    'מעניין', 'איך זה', 'ספר לי עוד', 'סקרן',
  ],
  money_anxiety_keywords: [
    'waste money', 'too expensive', 'cant afford', 'burn money',
    'בזבוז כסף', 'יקר מדי', 'לא יכול להרשות', 'שריפת כסף',
  ],
};
```

### Intent Keywords
```typescript
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
```

### Adaptive Strategies by Buying Style
```typescript
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
```

### Pain Scoring Algorithm
```typescript
export const PAIN_THRESHOLD = 75; // Hard threshold - below = NO ACTION

export const PAIN_INDICATORS = {
  money_keywords: ['lost', 'drained', 'stolen', 'scammed', '$', 'eth', 'usd', 'funds'],
  emotional_keywords: ['panic', 'scared', 'worried', 'regret', 'stupid', 'mistake', 'help', 'please'],
  personal_keywords: ['i ', 'my ', 'me ', 'mine', "i'm", "i've", 'my wallet', 'my funds'],
};

// Algorithm:
// Money matches * 10 (max 35)
// Emotional matches * 7 (max 20)
// Personal matches * 5 (max 20)
// Pattern recurrence ("again", "always"): +15
// Freshness ("just", "now", "today"): +10
```

### Buying Style Classification Algorithm
```typescript
function classifyBuyingStyle(fearSignals, curiosityLevel, interactionVelocity, hasMoneyAnxiety, previousPurchases): BuyingStyle {
  if (fearSignals.length === 0 && previousPurchases > 0 && interactionVelocity > 2) return 'fast-buyer';
  if (fearSignals.length >= 2 || hasMoneyAnxiety) return 'skeptic';
  if (curiosityLevel > 60 && interactionVelocity > 0.5) return 'explorer';
  if (fearSignals.length > 0 || interactionVelocity < 0.3) return 'cautious';
  return 'unknown';
}
```

### Emotional State Detection
```typescript
function detectEmotionalState(text, fearSignals, confusionDetected, curiosityLevel, trustLevel): EmotionalState {
  if (fearSignals.length >= 2 || emotionalKeywordsMatch) return 'panicking';
  if (confusionDetected) return 'confused';
  if (fearSignals.length === 1 || trustLevel < 50) return 'skeptical';
  if (curiosityLevel > 60) return 'curious';
  if (trustLevel >= 80 && fearSignals.length === 0) return 'ready';
  return 'calm';
}
```

### Lead Fingerprinting
```typescript
// Actor Fingerprint (stable person identity): "platform::author"
function computeActorFingerprint(platform, author): string {
  return `${platform.toLowerCase()}::${(author || 'anonymous').toLowerCase()}`;
}

// Lead Key (context key with URL hash): "platform::author::url_hash"
async function computeLeadKeyAsync(platform, author, sourceUrl): string {
  const actorFingerprint = computeActorFingerprint(platform, author);
  const urlHash = await hashUrlSHA256(sourceUrl || '');
  return `${actorFingerprint}::${urlHash}`;
}
```

---

# 2. FULL SQL SCHEMA

## Critical Tables (with approximate row counts from live system)

### brain_settings (~1 row — singleton config)
```sql
CREATE TABLE public.brain_settings (
  id boolean NOT NULL DEFAULT true PRIMARY KEY,
  brain_enabled boolean DEFAULT true,
  emergency_stop boolean DEFAULT false,
  scan_enabled boolean DEFAULT true,
  outreach_enabled boolean DEFAULT true,
  auto_closing_enabled boolean DEFAULT true,
  fulfillment_enabled boolean DEFAULT true,
  auto_sweep_enabled boolean DEFAULT false,
  auto_swap_enabled boolean DEFAULT false,
  session_rotation_enabled boolean DEFAULT false,
  session_ttl_hours integer DEFAULT 24,
  session_rotate_if_hours_left integer DEFAULT 6,
  max_daily_txs integer DEFAULT 10,
  max_daily_value_usd numeric DEFAULT 500,
  max_value_per_tx_usd numeric DEFAULT 100,
  max_daily_outreach integer DEFAULT 100,
  min_opportunity_value_usd numeric DEFAULT 5,
  auto_approve_threshold numeric DEFAULT 0.7,
  allowed_contracts jsonb DEFAULT '[]',
  allowed_functions jsonb DEFAULT '[]',
  treasury_target_asset text DEFAULT 'ETH',
  treasury_target_network text DEFAULT 'base',
  payout_wallet_address text,
  last_sweep_at timestamptz,
  throttle_until timestamptz,
  throttle_reason text,
  throttle_activated_at timestamptz,
  throttle_count_7d integer DEFAULT 0,
  last_throttle_reset_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### hunter_settings (~1 row — singleton config)
```sql
CREATE TABLE public.hunter_settings (
  id boolean NOT NULL DEFAULT true PRIMARY KEY,
  monster_mode boolean DEFAULT false,
  dry_run_mode boolean DEFAULT true,
  daily_limit integer DEFAULT 50,
  sends_today integer DEFAULT 0,
  last_reset_at timestamptz DEFAULT now(),
  last_run_at timestamptz,
  domain text DEFAULT 'getsignalforge.com',
  created_at timestamptz DEFAULT now()
);
```

### demand_signals (~154 rows)
```sql
CREATE TABLE public.demand_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id uuid REFERENCES offer_sources(id),
  external_id text,
  query_text text NOT NULL,
  source_url text,
  payload_json jsonb DEFAULT '{}',
  urgency_score numeric,
  relevance_score numeric,
  category text,
  status text DEFAULT 'new',
  m2m_status text,
  rejection_reason text,
  travel_tier integer,           -- 0=non-travel, 1=Scout, 2=Architect, 3=Concierge
  travel_intent_data jsonb,      -- { tier, label, action, matched_keywords, classified_at }
  detected_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_id, external_id)
);
```

### auto_leads (~0 rows — pipeline not yet active)
```sql
CREATE TABLE public.auto_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  name text,
  company text,
  lead_category text NOT NULL,
  matched_partner text,
  source text DEFAULT 'manual',
  source_url text,
  confidence numeric,
  dry_run boolean DEFAULT false,
  metadata jsonb,
  status text DEFAULT 'discovered',
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(email)
);
```

### outreach_jobs (~87 rows)
```sql
CREATE TABLE public.outreach_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text,
  source_id text,
  channel text DEFAULT 'email',
  destination text,
  intent_topic text,
  confidence numeric,
  status text DEFAULT 'queued',   -- queued, sent, failed, gated, deferred
  gate_fail_reason text,
  next_retry_at timestamptz,
  ai_draft text,
  message_draft text,
  draft_text text,
  lead_payload jsonb,
  provider_response jsonb,
  created_at timestamptz DEFAULT now()
);
```

### click_analytics (~0 rows)
```sql
CREATE TABLE public.click_analytics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id text,
  partner_id uuid REFERENCES m2m_partners(id),
  partner_slug text NOT NULL,
  source_platform text,
  source_url text,
  ip_hash text,
  user_agent text,
  referrer_url text,
  redirect_url text NOT NULL,
  actor_fingerprint text,
  created_at timestamptz DEFAULT now()
);
```

### m2m_partners
```sql
CREATE TABLE public.m2m_partners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  affiliate_base_url text,
  category text,
  is_active boolean DEFAULT true,
  total_dispatches integer DEFAULT 0,
  total_conversions integer DEFAULT 0,
  total_revenue_usd numeric DEFAULT 0,
  suspicious boolean DEFAULT false,
  suspicious_reason text,
  created_at timestamptz DEFAULT now()
);
```

### m2m_ledger
```sql
CREATE TABLE public.m2m_ledger (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id uuid REFERENCES m2m_partners(id),
  signal_id uuid,
  status text DEFAULT 'dispatched',   -- dispatched, confirmed, rejected
  estimated_value_usd numeric,
  actual_revenue_usd numeric,
  confirmed_at timestamptz,
  postback_log jsonb,
  created_at timestamptz DEFAULT now()
);
```

### affiliate_programs
```sql
CREATE TABLE public.affiliate_programs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  base_url text NOT NULL,
  category text NOT NULL,
  commission_type text DEFAULT 'percentage',
  commission_value numeric DEFAULT 0,
  cookie_days integer,
  affiliate_id text,
  affiliate_link_template text,
  min_payout_usd numeric,
  payout_method text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

### affiliate_clicks
```sql
CREATE TABLE public.affiliate_clicks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id uuid REFERENCES affiliate_programs(id),
  source text NOT NULL,
  source_id text,
  clicked_at timestamptz DEFAULT now(),
  ip_hash text,
  user_agent text,
  referrer_url text,
  converted boolean DEFAULT false,
  converted_at timestamptz,
  commission_usd numeric,
  actor_fingerprint text
);
```

### affiliate_earnings
```sql
CREATE TABLE public.affiliate_earnings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id uuid REFERENCES affiliate_programs(id),
  affiliate_click_id uuid REFERENCES affiliate_clicks(id),
  click_id uuid REFERENCES affiliate_clicks(id),
  amount_usd numeric NOT NULL,
  currency text DEFAULT 'USD',
  status text DEFAULT 'pending',
  earned_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  reference_id text,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

### payments (~4 rows)
```sql
CREATE TABLE public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES users_customers(id),
  amount_usd numeric NOT NULL,
  amount_eth numeric,
  credits_purchased integer DEFAULT 0,
  pack_id text,
  charge_id text,
  charge_code text,
  status text DEFAULT 'pending',
  confirmed_at timestamptz,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
```

### treasury_ledger (~5 rows — INSERT-ONLY)
```sql
CREATE TABLE public.treasury_ledger (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid,
  direction text NOT NULL,          -- 'IN' or 'OUT'
  amount numeric NOT NULL,
  amount_usd numeric,
  asset text DEFAULT 'ETH',
  currency text DEFAULT 'ETH',
  network text DEFAULT 'base',
  source text,                       -- 'payment', 'affiliate_revenue', etc.
  tx_hash text,
  payment_id uuid,
  payer_email text,
  charge_code text,
  ref_id text,
  note text,
  created_at timestamptz DEFAULT now()
);
-- INSERT-ONLY trigger prevents UPDATE/DELETE
```

### users_customers
```sql
CREATE TABLE public.users_customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  company text,
  plan text DEFAULT 'free',
  created_at timestamptz DEFAULT now()
);
```

### credit_wallets
```sql
CREATE TABLE public.credit_wallets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid REFERENCES users_customers(id),
  credits_balance integer DEFAULT 0,
  total_credits_purchased integer DEFAULT 0,
  total_credits_burned integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### customer_dna (~0 rows)
```sql
CREATE TABLE public.customer_dna (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_fingerprint text NOT NULL UNIQUE,
  trust_level integer DEFAULT 30,
  curiosity_level integer DEFAULT 30,
  fear_signals jsonb DEFAULT '[]',
  buying_style text DEFAULT 'unknown',
  technical_level text DEFAULT 'unknown',
  time_to_value boolean DEFAULT false,
  payment_resistance_score integer DEFAULT 50,
  objections_history jsonb DEFAULT '[]',
  engagement_velocity numeric DEFAULT 0,
  lifetime_value_prediction numeric DEFAULT 0,
  churn_risk numeric DEFAULT 0.5,
  total_interactions integer DEFAULT 0,
  total_value_received integer DEFAULT 0,
  total_paid_usd numeric DEFAULT 0,
  last_positive_interaction_at timestamptz,
  last_negative_signal_at timestamptz,
  preferred_channel text,
  first_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### denylist
```sql
CREATE TABLE public.denylist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,           -- 'email', 'domain', 'ip'
  value text NOT NULL,
  reason text,
  blocked_by text,
  active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(type, value)
);
```

### offer_sources (~8 rows)
```sql
CREATE TABLE public.offer_sources (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  source_type text NOT NULL,    -- 'rss', 'github_issues', 'github_search', 'manual'
  url text NOT NULL,
  query text,
  query_keywords text[] DEFAULT '{}',
  scan_config jsonb DEFAULT '{}',
  scan_interval_minutes integer DEFAULT 60,
  is_active boolean DEFAULT true,
  health_score numeric DEFAULT 1.0,
  failure_count integer DEFAULT 0,
  last_scanned_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### actor_profiles
```sql
CREATE TABLE public.actor_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint text NOT NULL UNIQUE,
  platform text NOT NULL,
  author text,
  interaction_count_30d integer DEFAULT 0,
  free_value_events_count integer DEFAULT 0,
  outreach_received_count integer DEFAULT 0,
  highest_trust_score integer DEFAULT 50,
  has_paid boolean DEFAULT false,
  first_payment_at timestamptz,
  total_paid_usd numeric DEFAULT 0,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### decision_traces
```sql
CREATE TABLE public.decision_traces (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text,
  decision text NOT NULL,
  intent text,
  pain_score numeric,
  trust_score numeric,
  trust_cap_applied boolean,
  interaction_count integer,
  lead_key text,
  actor_fingerprint text,
  platform text,
  source_url text,
  offer_id text,
  reason_codes text[],
  throttle_state text,
  throttle_until timestamptz,
  buying_style text,
  emotional_state text,
  fear_detected boolean,
  safe_mode_activated boolean,
  dna_score numeric,
  free_value_events_count_24h integer,
  free_value_events_count_30d integer,
  created_at timestamptz DEFAULT now()
);
```

### system_metrics (used by outreach-limiter)
```sql
CREATE TABLE public.system_metrics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_name text NOT NULL,
  metric_value numeric DEFAULT 0,
  metric_type text,
  dimensions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

### hunter_activity_log (used by autonomous-hunter)
```sql
CREATE TABLE public.hunter_activity_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  lead_id text,
  partner_name text,
  details text,
  status text,
  dry_run boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

### outreach_limits
```sql
CREATE TABLE public.outreach_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  limit_date text NOT NULL,
  sent_count integer DEFAULT 0,
  cap_count integer DEFAULT 20,
  UNIQUE(limit_date)
);
```

### notifications
```sql
CREATE TABLE public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text,
  charge_id text,
  amount numeric,
  currency text,
  message text,
  was_sent boolean DEFAULT false,
  is_test boolean DEFAULT false,
  source text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
```

### audit_logs
```sql
CREATE TABLE public.audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
```

---

# 3. EDGE FUNCTION LOGIC FLOWS

## 3.1 demand-scanner (Signal Discovery)

**Purpose**: Scans GitHub Issues and GitHub Repos for demand signals.

**Flow**:
1. Check `engine_config.scan_enabled`
2. Fetch active `offer_sources` with `is_active = true`
3. For each source, check if enough time passed since `last_scanned_at`
4. Scan based on `source_type`:
   - `github_issues`: Fetch open issues matching keywords via GitHub API
   - `github_search`: Search repos matching keywords
5. For each result, calculate `urgency_score` and `relevance_score`
6. Upsert into `demand_signals` with dedup on `(source_id, external_id)`
7. Update `offer_sources.last_scanned_at`

**Auth**: Requires `GITHUB_TOKEN` env var.

## 3.2 brain-scan (RSS/Source Scanner)

**Purpose**: Scans RSS feeds and stores signals.

**Flow**:
1. Verify `x-cron-secret` header
2. Check `brain_settings.emergency_stop` and `brain_enabled` and `scan_enabled`
3. Fetch active `offer_sources` ordered by oldest scan first, limit 10
4. For RSS sources: fetch and parse XML, extract items
5. Check keyword match against `query_keywords`
6. Generate SHA-256 fingerprint of URL+title for dedup
7. Detect intent type (replay_webhook, bug_webhook, risk_scoring, looking_for_tool, need_help)
8. Insert into `demand_signals` with fingerprint as `external_id`
9. Update source health scores (increase on success, decrease on failure, disable after 10 failures)
10. Log to `audit_logs`

## 3.3 brain-score (Trust-Gated Lead Scoring)

**Purpose**: Scores signals using Customer DNA + Trust Gates.

**Flow**:
1. Receive signal data
2. **Intent Classification**: Match keywords → NOISE/DISCUSSION/CURIOSITY/ACTIVE_PAIN/BUYING_SIGNAL
3. **Pain Score**: Calculate 0-100 based on money/emotional/personal keywords
4. If pain < 75 → BLOCK
5. **DNA Analysis Layer 1**: Detect fear signals, confusion, curiosity, money anxiety
6. **Kill Gate**: If confusion OR fear > 2 → triggered
7. **Buying Style Classification**: Based on fear, curiosity, velocity, anxiety, purchase history
8. **Emotional State Detection**: panicking/confused/skeptical/curious/ready/calm
9. **Safe Mode**: Activated if panicking/confused/kill gate/fear > 2
10. **Trust Scoring**: Base from DNA + boosts from interactions/value/payments - reductions from emotions
11. **Trust Cap**: If < 2 interactions → cap at 70
12. **Trust Action**: < 60 = BLOCK, 60-79 = FREE_ONLY, >= 80 = PAID_OK
13. **Adaptive Strategy**: Based on buying style (micro_offer/trial/direct/pay_after_value/educate_only)
14. **Composite Score**: 30% pain + 15% buying signal + 25% trust + 10% source health + DNA adjustments
15. **Update customer_dna** table via upsert
16. **Log to decision_traces**

## 3.4 travel-classifier (3-Tier Travel Intent)

**Purpose**: Classifies travel-related demand signals into tiers.

**Tier Keywords**:
```
Tier 1 (Scout): cheap flights, budget travel, low cost, discount hotel, hostel, backpacking, flight deal, last minute deal
Tier 2 (Architect): family vacation, road trip, itinerary, travel route, honeymoon, group travel, island hopping
Tier 3 (Concierge): luxury hotel, business class, first class, 5 star, private villa, concierge, luxury resort, private jet
```

**Flow**:
1. Auth: x-cron-secret OR x-admin-token
2. Fetch `demand_signals` where `travel_tier IS NULL` and status IN ('new', 'approved')
3. For each signal, classify by checking tiers 3→2→1 (highest priority first)
4. Update signal with `travel_tier` and `travel_intent_data`
5. Tier 1: Auto-create lead in `auto_leads` with `matched_partner = 'TravelAffiliate'`
6. Tier 2/3: Create lead with `matched_partner = 'TravelPremium'`, includes social proof metadata

## 3.5 autonomous-hunter (Monster Mode Engine)

**Purpose**: Discovers leads from signals and sends outreach emails.

**Partner Category Mapping**:
```
email_automation → Woodpecker
email_verification → EmailListVerify
ecommerce_analytics → Compass
marketing_roas → AdTurbo AI
crm_sales → Lucro CRM
fundraising → EasyFund
webinar → WebinarGeek
travel_budget → TravelAffiliate
travel_planning → TravelPremium
travel_luxury → TravelPremium
```

**Flow**:
1. Auth: x-cron-secret OR x-admin-token
2. Check brain emergency_stop and brain_enabled
3. Check `hunter_settings.monster_mode` (must be true)
4. Check daily limit and reset counter if new day
5. **Discover**: Scan `demand_signals` with relevance >= 0.6, match to partner by keywords
6. Check denylist, check duplicate in auto_leads
7. Insert matched leads into `auto_leads`
8. **Send**: Fetch unsent leads ordered by confidence desc
9. Generate trackable link: `https://getsignalforge.com/go/[partner-slug]/[lead-id]`
10. Generate unsubscribe link: `${SUPABASE_URL}/functions/v1/email-unsubscribe?email=...&token=...`
11. Personalize email template with {{NAME}}, {{TRACKABLE_LINK}}, {{UNSUBSCRIBE_LINK}}
12. If dry_run: log only. If real: send via Resend API with `List-Unsubscribe` header
13. Human-like delay: 15-60s between sends
14. Update daily counter, send Hebrew Telegram hunt summary

**Email Templates** (per partner): See Section 6 for complete templates.

## 3.6 automated-outreach (Smart Personalization)

**Purpose**: Sends individual outreach emails with AI-personalized opening.

**Flow**:
1. Auth: ADMIN_API_TOKEN or CRON_SECRET
2. Check denylist for email
3. Apply human-like delay (60-300s) in batch mode
4. Generate cloaked link: `https://truthtoken.io/go/[slug]/[lead-id]?src=email`
5. Generate unsubscribe link
6. Call Lovable AI Gateway for personalized opening sentence (gemini-3-flash-preview)
7. Build HTML email with CTA button
8. Send via Resend API from `outreach@truthtoken.io`
9. Log to outreach_jobs
10. Send Telegram notification

## 3.7 outreach-sender (Telegram Hot Lead Alerts)

**Purpose**: Processes outreach jobs, sends Telegram alerts with trackable links.

**Flow**:
1. Auth: ADMIN_API_TOKEN or CRON_SECRET
2. Check throttle_until in brain_settings
3. Check outreach_enabled
4. Load job by job_id
5. **Kill Gates**:
   - Gate 1: Must have thread_url
   - Gate 2: Confidence >= 0.85 (OUTREACH_MIN_CONFIDENCE env)
   - Gate 3: Daily cap (OUTREACH_DAILY_CAP env, default 20)
6. Generate trackable link: `https://truthtoken.io/go/[source_id]/[job_id]`
7. Build Telegram message with source, topic, confidence, AI draft, trackable + original links
8. Send via telegram-notify function
9. Increment daily limit in outreach_limits
10. Mark job as 'sent'

## 3.8 outreach-limiter (Domain Warm-Up)

**Purpose**: Enforces email sending limits for domain reputation protection.

**Warm-Up Rules**:
- Days 1-3: Max 20 emails/day
- Day 4+: Increase by 20% daily (compound): `floor(20 * 1.2^(day - 3))`

**Flow**:
1. Auth: x-cron-secret OR x-admin-token
2. Get warm-up start date from `system_metrics`
3. Calculate days since start and daily limit
4. Actions: "check" (read-only), "increment" (bump count), "status"
5. If limit reached: update remaining leads to 'queued' status

## 3.9 affiliate-redirect (Click Tracking & Redirect)

**Purpose**: Public endpoint for `/go/[partner]/[lead]` redirect tracking.

**Flow**:
1. **NO AUTH** — public endpoint
2. Parse query params: `partner`, `lead`, `src`
3. Find partner in `m2m_partners` by slug match (name lowercased, hyphenated)
4. Hash client IP with SHA-256 + date + slug (privacy-safe, 16 hex chars)
5. Insert click record into `click_analytics`
6. 302 Redirect to `partner.affiliate_base_url`

## 3.10 email-unsubscribe

**Purpose**: Handles email unsubscribe requests.

**Flow**:
1. Parse email and token from query params
2. Validate token (base64 decode must match email)
3. Upsert into `denylist` with type='email', active=true
4. Update any matching leads to status='blacklisted'
5. Return styled HTML confirmation page

## 3.11 coinbase-webhook (Payment Processing)

**Purpose**: Processes Coinbase Commerce webhook events.

**Flow**:
1. Verify HMAC-SHA256 signature using `COINBASE_COMMERCE_WEBHOOK_SECRET`
2. **Kill Gate 1**: Find payment in DB by charge_id (no match = ignore)
3. For charge:confirmed/resolved:
   - Update payment status to 'confirmed'
   - **Kill Gate 2**: Prevent duplicate ledger entries (check by payment_id and tx_hash)
   - Insert to treasury_ledger (INSERT-ONLY)
   - Update credit_wallets
   - Insert credit_event
   - Auto-provision API key
   - Send Telegram notification (Hebrew)
4. For charge:failed: Update payment status
5. Log everything to notifications and audit_logs

## 3.12 m2m-postback (Revenue Bridge)

**Purpose**: Processes partner conversion postbacks.

**Flow**:
1. Rate limit: 60 requests/minute per IP
2. Optional HMAC verification via `PARTNERSTACK_WEBHOOK_SECRET`
3. Find dispatch in `m2m_ledger` by dispatch_id
4. Idempotency: skip if already confirmed
5. Update dispatch status and actual_revenue_usd
6. On confirmed conversion:
   - Update partner stats (total_conversions, total_revenue_usd)
   - **Anti-fraud**: Flag if CTR > 90% (conversion/dispatches ratio)
   - Insert affiliate_earnings record
   - Insert treasury_ledger record (source: 'affiliate_revenue')
   - Send Telegram notification

---

# 4. INTEGRATION MAP

## 4.1 Required Environment Variables / Secrets

| Secret Name | Purpose | Where Used |
|---|---|---|
| `SUPABASE_URL` | Database + Functions base URL | All Edge Functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin DB access | All Edge Functions |
| `SUPABASE_ANON_KEY` | Client-side DB access | Frontend |
| `CRON_SECRET` | Authenticates cron/internal calls | brain-scan, autonomous-hunter, etc. |
| `ADMIN_API_TOKEN` | Admin operations auth | Various admin functions |
| `RESEND_API_KEY` | Email sending via Resend | autonomous-hunter, automated-outreach |
| `LOVABLE_API_KEY` | AI Gateway for LLM calls | automated-outreach, ai-content-engine |
| `TELEGRAM_BOT_TOKEN` | Telegram notifications | telegram-notify |
| `TELEGRAM_CHAT_ID` | Telegram chat target | telegram-notify |
| `COINBASE_COMMERCE_API_KEY` | Create payment charges | create-coinbase-checkout |
| `COINBASE_COMMERCE_WEBHOOK_SECRET` | Verify webhook signatures | coinbase-webhook |
| `FIRECRAWL_API_KEY` | Web scraping (connector-managed) | lead-hunter |
| `INGEST_WEBHOOK_TOKEN` | Signal ingestion auth | ingest-webhook |
| `API_KEY_PEPPER` | API key hashing salt | provision-api-key |
| `PAYPAL_API_USERNAME` | PayPal payouts | paypal-payout |
| `PAYPAL_API_PASSWORD` | PayPal payouts | paypal-payout |
| `PAYPAL_API_SIGNATURE` | PayPal payouts | paypal-payout |

## 4.2 External API Endpoints

| Service | Endpoint | Method | Headers |
|---|---|---|---|
| Resend (Email) | `https://api.resend.com/emails` | POST | `Authorization: Bearer ${RESEND_API_KEY}` |
| Lovable AI Gateway | `https://ai.gateway.lovable.dev/v1/chat/completions` | POST | `Authorization: Bearer ${LOVABLE_API_KEY}` |
| Telegram Bot API | `https://api.telegram.org/bot${TOKEN}/sendMessage` | POST | Content-Type: application/json |
| Coinbase Commerce | `https://api.commerce.coinbase.com/charges` | POST | `X-CC-Api-Key: ${API_KEY}` |
| GitHub API | `https://api.github.com/search/issues` | GET | `Authorization: Bearer ${GITHUB_TOKEN}` |

## 4.3 Email Configuration

- **From address (Hunter)**: `outreach@getsignalforge.com` (configurable via hunter_settings.domain)
- **From address (Outreach)**: `outreach@truthtoken.io`
- **Required Headers**: `List-Unsubscribe`, `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- **Domain Verification**: Resend requires DNS records (SPF, DKIM, DMARC)

---

# 5. THE /go/ REDIRECT LOGIC

## Client-Side Route (React)

File: `src/pages/AffiliateRedirect.tsx`

```typescript
// Route: /go/:partnerSlug/:leadId
// Constructs URL and redirects to Edge Function:
const redirectUrl = `${SUPABASE_URL}/functions/v1/affiliate-redirect?partner=${partnerSlug}&lead=${leadId}&src=${source}`;
window.location.href = redirectUrl;
```

## Edge Function (affiliate-redirect)

```typescript
// 1. Parse query params: partner, lead, src
// 2. Find partner in m2m_partners by slug matching:
const partner = partners.find(p => 
  p.name.toLowerCase().replace(/[^a-z0-9]/g, "-") === partnerSlug.toLowerCase()
);

// 3. Privacy-safe IP hashing:
const hashData = encode(clientIP + new Date().toDateString() + partnerSlug);
const ipHash = SHA256(hashData).slice(0, 16);

// 4. Record click in click_analytics table
await supabase.from("click_analytics").insert({
  lead_id, partner_id, partner_slug, source_platform,
  ip_hash, user_agent, referrer_url, redirect_url
});

// 5. 302 Redirect to partner.affiliate_base_url
return new Response(null, {
  status: 302,
  headers: { "Location": partner.affiliate_base_url }
});
```

## Link Generation (in outreach functions)

```typescript
// In autonomous-hunter:
const partnerSlug = partnerName.toLowerCase().replace(/[^a-z0-9]/g, '-');
const trackableLink = `https://getsignalforge.com/go/${partnerSlug}/${lead.id}`;

// In automated-outreach:
const cloakedLink = `https://truthtoken.io/go/${partnerInfo.slug}/${lead_id || "direct"}?src=email`;

// In outreach-sender:
const trackableLink = `https://truthtoken.io/go/${leadSourceId}/${job.id}`;
```

---

# 6. COMPLETE EMAIL TEMPLATES

## Partner Email Templates (autonomous-hunter)

### Woodpecker (Cold Email Automation)
```
Subject: Quick tip on improving cold email deliverability
Body: Hi {{NAME}},

I noticed you might be working on scaling outreach — one thing that made a huge difference for teams I've seen is using smart sending patterns instead of generic blasts.

Woodpecker automates this with human-like sequences that bypass spam filters and auto-rotate sending accounts.

👉 Check it out: {{TRACKABLE_LINK}}

Best,
SignalForge Team

---
To stop receiving updates: {{UNSUBSCRIBE_LINK}}
```

### EmailListVerify
```
Subject: Your bounce rate might be hurting deliverability
Body: Hi {{NAME}},

High bounce rates are a silent reputation killer. Before your next campaign, running your list through EmailListVerify catches invalid emails, spam traps, and disposable addresses.

Teams using it consistently see 98%+ deliverability.

👉 Check it out: {{TRACKABLE_LINK}}

Best,
SignalForge Team

---
To stop receiving updates: {{UNSUBSCRIBE_LINK}}
```

### Compass (eCommerce Analytics)
```
Subject: Are you tracking the right eCommerce metrics?
Body: Hi {{NAME}},

Most eCommerce teams drown in data but miss the insights that drive revenue. Compass gives you product-level analytics and channel attribution out of the box.

👉 Worth exploring: {{TRACKABLE_LINK}}

Best,
SignalForge Team

---
To stop receiving updates: {{UNSUBSCRIBE_LINK}}
```

### AdTurbo AI (Ad Optimization)
```
Subject: Cut your ad CPA by 40% — here's how
Body: Hi {{NAME}},

If you're running paid campaigns, AdTurbo AI optimizes your ROAS across all channels automatically. Teams I've seen cut their CPA by 40% in the first quarter.

👉 Take a look: {{TRACKABLE_LINK}}

Best,
SignalForge Team

---
To stop receiving updates: {{UNSUBSCRIBE_LINK}}
```

### TravelAffiliate (Budget Travel — Tier 1)
```
Subject: Found a flight deal that might interest you
Body: Hi {{NAME}},

I spotted some travel deals that match what you were looking for — budget-friendly options with solid reviews.

👉 See the deals: {{TRACKABLE_LINK}}

✅ Verified Review: 9.2/10 Rating based on recent traveler sentiment analysis.

Happy travels,
SignalForge Team

---
To stop receiving updates: {{UNSUBSCRIBE_LINK}}
```

### TravelPremium (Planning/Luxury — Tier 2/3)
```
Subject: Your personalized travel itinerary is ready
Body: Hi {{NAME}},

Based on your travel interests, we've put together a curated recommendation that includes route planning, accommodation picks, and insider tips.

👉 View your itinerary: {{TRACKABLE_LINK}}

✅ Verified Review: 9.2/10 Rating based on recent traveler sentiment analysis.

Bon voyage,
SignalForge Team

---
To stop receiving updates: {{UNSUBSCRIBE_LINK}}
```

## Hebrew Social Templates (ContentForge)

```
Woodpecker: 🚀 מאבקים בדליברביליטי של מיילים קרים? Woodpecker מאפשר שליחה חכמה עם דפוסים אנושיים — שיעור תגובות x3. ✅ סבב חשבונות אוטומטי ✅ A/B testing בזמן אמת ✅ עקיפת מסנני ספאם {{LINK}}

EmailListVerify: 📧 שיעור הבאונס שלך הורס את המוניטין. EmailListVerify מסנן מיילים מזויפים, מלכודות ספאם וכתובות חד-פעמיות. תוצאה: 98%+ דליברביליטי. {{LINK}}

Compass: 📊 רוב חנויות ה-eCommerce טובעות בדאטה בלי תובנות. Compass נותן אנליטיקס ברמת מוצר + ייחוס הכנסות לפי ערוץ. {{LINK}}

AdTurbo AI: 💰 תפסיקו לשרוף תקציב פרסום. AdTurbo AI מייעל ROAS אוטומטית בכל הערוצים — הורדנו CPA ב-40%. {{LINK}}
```

## HTML Email Template (automated-outreach)

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e; line-height: 1.6;">
  <p>Hey {{NAME}},</p>
  <p>{{AI_PERSONALIZED_OPENING}}</p>
  <p><strong>{{PARTNER}}</strong> has been getting great results for teams in similar situations — particularly with automation and reducing manual overhead.</p>
  <p style="margin: 24px 0;">
    <a href="{{TRACKABLE_LINK}}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Check it out →</a>
  </p>
  <p style="font-size: 13px; color: #666;">No pressure — just thought it was worth sharing based on what I've seen work for others.</p>
  <p>Best,<br/>TruthToken Insights</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
  <p style="font-size: 11px; color: #999; text-align: center;">
    Don't want to hear from us? <a href="{{UNSUBSCRIBE_LINK}}" style="color: #999; text-decoration: underline;">Unsubscribe</a>
  </p>
</body>
</html>
```

---

# 7. SECURITY ARCHITECTURE

## Auth Guard Types

| Guard Type | Header | Comparison | Used By |
|---|---|---|---|
| Cron Secret | `x-cron-secret` | `===` strict | brain-scan, autonomous-hunter, cron jobs |
| Admin Token | `x-admin-token` | `===` strict | Admin functions |
| Webhook Token | `Authorization: Bearer` | `===` strict | ingest-webhook |
| HMAC SHA-256 | `x-cc-webhook-signature` | Constant-time compare | coinbase-webhook |
| HMAC SHA-256 | `x-partnerstack-signature` | Computed comparison | m2m-postback |
| Origin Allow | `Origin` header | URL hostname match | Public endpoints |

## Rate Limiting
- Uses `audit_logs` table with `metadata.identifier` field
- Format: `"type:value"` (e.g., `"postback:192.168.1.1"`)
- Queries count within time window using `.contains('metadata', { identifier })`

## Insert-Only Ledger
- `treasury_ledger` has a trigger `prevent_mutations` that raises exception on UPDATE/DELETE

---

# 8. AI GATEWAY CONFIGURATION

**Endpoint**: `https://ai.gateway.lovable.dev/v1/chat/completions`

**Supported Models** (no API key needed from user):
- `google/gemini-2.5-pro`
- `google/gemini-3-pro-preview`
- `google/gemini-3-flash-preview` ← Used for email personalization
- `google/gemini-2.5-flash`
- `openai/gpt-5`
- `openai/gpt-5-mini`

**Note**: For Replit migration, you'll need to replace this with your own AI provider (OpenAI, Anthropic, etc.) and update the endpoint + auth accordingly.

---

# END OF SPECIFICATION

This document contains the complete intelligence of the SignalForge system as of 2026-02-12. All prompts, algorithms, schemas, and logic flows are included verbatim from the production codebase.
