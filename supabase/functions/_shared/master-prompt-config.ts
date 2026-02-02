/**
 * MASTER PROMPT CONFIG - Autonomous Content & Outreach Engine
 * קונפיגורציה מרכזית למנוע ההפצה האוטונומי
 * 
 * SYSTEM OVERRIDE — EXECUTION MODE
 * AUTO_PUBLISH = TRUE | MANUAL_REVIEW = FALSE | DRAFT_MODE = DISABLED
 * 
 * אין אישורים ידניים. אין Drafts. אין שאלות.
 * המנוע מחליט. מבצע. נמדד בתוצאות.
 */

// =====================================================
// EXECUTION MODE - OVERRIDE
// =====================================================
export const EXECUTION_MODE = {
  AUTO_PUBLISH: true,       // Content ≥80 is published IMMEDIATELY
  MANUAL_REVIEW: false,     // No human approval needed
  DRAFT_MODE: false,        // DISABLED - content goes directly to published
  IMMEDIATE_ACTION: true,   // Execute actions without waiting
};

// =====================================================
// SCORING THRESHOLDS - חד וברור
// =====================================================
export const SCORING = {
  // ≥80 = פרסום אוטומטי | <80 = גניזה מיידית
  AUTO_PUBLISH_THRESHOLD: 80,
  
  // ≥80 = outreach אוטומטי
  AUTO_OUTREACH_THRESHOLD: 80,
  
  // Minimum to even consider (below = trash)
  MINIMUM_RELEVANCE: 50,
  
  // Scoring weights
  WEIGHTS: {
    relevance: 0.25,      // רלוונטיות לתחום
    pain_intensity: 0.25, // עוצמת כאב / עניין
    response_likelihood: 0.20, // סבירות לתגובה
    credibility: 0.15,    // רמת אמינות
    spam_risk_inverse: 0.15, // סיכון ספאם (הפוך - גבוה = רע)
  },
};

// =====================================================
// GUARDRAILS - בלתי ניתנים לעקיפה
// =====================================================
export const GUARDRAILS = {
  // מילים אסורות בתוכן
  FORBIDDEN_WORDS: [
    // Marketing promises
    'guaranteed', 'risk-free', 'no-brainer', 'game-changer', 'revolutionary',
    'best in the market', 'number one', '#1', 'unbeatable',
    // Direct CTAs
    'buy now', 'sign up today', 'limited time', 'act now', 'dont miss',
    'exclusive offer', 'special deal', 'hurry',
    // Clickbait
    'you wont believe', 'shocking', 'secret', 'hack', 'trick',
    // Revealing automation
    'AI', 'bot', 'automated', 'automation', 'algorithm', 'machine learning',
    'artificial intelligence', 'generated',
    // Hebrew equivalents
    'מבטיח', 'חינם לגמרי', 'הזדמנות אחרונה', 'מהפכני', 'בוט', 'אוטומטי',
  ],
  
  // Allowed content patterns
  ALLOWED_PATTERNS: [
    'experience', 'insight', 'learned', 'found that', 'noticed',
    'example', 'case study', 'real-world', 'actually',
    'helpful', 'useful', 'tip', 'approach', 'method',
    'here is how', 'one way to', 'consider', 'might help',
  ],
  
  // Content must pass these checks
  CONTENT_RULES: {
    no_exclamation_spam: true, // Max 1 exclamation mark
    no_all_caps: true,
    no_emoji_spam: true, // Max 2 emojis
    value_first: true, // Must provide value before any mention of product
  },
};

// =====================================================
// VOLUME & ANTI-SPAM LIMITS
// =====================================================
export const LIMITS = {
  // יומי
  MAX_POSTS_PER_DAY: 3,
  MAX_POSTS_PER_PLATFORM_PER_DAY: 1,
  MAX_OUTREACH_PER_DAY: 10, // Conservative for safety
  
  // Deduplication
  DEDUP_WINDOW_HOURS: 72,
  
  // Rate limiting
  MIN_DELAY_BETWEEN_POSTS_MS: 15 * 60 * 1000, // 15 minutes minimum
  RANDOM_DELAY_RANGE_MS: [15 * 60 * 1000, 45 * 60 * 1000], // 15-45 min random
  
  // Auto-stop triggers
  BLOCK_RISK_INDICATORS: [
    'rate limit', 'too many requests', 'blocked', 'banned',
    'suspicious activity', 'spam detected', 'account suspended',
  ],
};

// =====================================================
// PLATFORM-SPECIFIC BEHAVIOR
// =====================================================
// Platform config with consistent delay_range_ms
interface PlatformConfig {
  enabled: boolean;
  auto_publish: boolean;
  style: string;
  delay_range_ms: [number, number];
  max_title_length?: number;
  no_marketing_in_title?: boolean;
  adapt_to_subreddit?: boolean;
  allowed_types?: string[];
  link_in_first_comment_only?: boolean;
  answer_only?: boolean;
}

export const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  hackernews: {
    enabled: true,
    auto_publish: true,
    style: 'minimalist_informative',
    max_title_length: 80,
    no_marketing_in_title: true,
    delay_range_ms: [5000, 15000],
  },
  
  reddit: {
    enabled: true,
    auto_publish: true,
    style: 'authentic_user',
    adapt_to_subreddit: true,
    delay_range_ms: [15 * 60 * 1000, 45 * 60 * 1000],
  },
  
  linkedin: {
    enabled: false,
    auto_publish: false,
    style: 'professional_insight',
    allowed_types: ['case_study', 'insight', 'lesson_learned'],
    link_in_first_comment_only: true,
    delay_range_ms: [30 * 60 * 1000, 60 * 60 * 1000],
  },
  
  devto: {
    enabled: true,
    auto_publish: true,
    style: 'educational_technical',
    delay_range_ms: [30 * 60 * 1000, 60 * 60 * 1000],
  },
  
  stackexchange: {
    enabled: true,
    auto_publish: true,
    style: 'helpful_expert',
    answer_only: true,
    delay_range_ms: [5 * 60 * 1000, 15 * 60 * 1000],
  },
};

// =====================================================
// OUTREACH RULES
// =====================================================
export const OUTREACH = {
  // Only for leads with score ≥80
  min_score: 80,
  
  // Message constraints
  max_length: 300,
  must_be_personal: true,
  no_sales_pitch: true,
  
  // Structure
  must_include_open_question: true, // שאלה פתוחה אחת בלבד
  max_questions: 1,
  
  // Follow-up
  no_aggressive_followup: true,
  max_followups: 1,
  min_days_between_followups: 7,
};

// =====================================================
// SELF-LEARNING CONFIG
// =====================================================
export const LEARNING = {
  // Metrics to track after each publish
  track_metrics: ['views', 'clicks', 'comments', 'leads', 'conversions'],
  
  // Update weights based on performance
  auto_adjust_weights: true,
  weight_adjustment_rate: 0.05, // 5% adjustment per learning cycle
  
  // Content that fails
  failure_actions: {
    low_engagement: 'archive', // Don't try to "fix" - just archive
    negative_feedback: 'blacklist_pattern',
    spam_detected: 'stop_and_alert',
  },
};

// =====================================================
// AI PROMPT TEMPLATES
// =====================================================
export const AI_PROMPTS = {
  lead_scorer: `You are a strict lead qualification AI.

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

  content_generator: `You are generating VALUE-FIRST content.

ABSOLUTE RULES:
❌ NO marketing promises
❌ NO direct CTAs to buy/signup
❌ NO clickbait
❌ NO mentions of "AI", "bot", "automated"
❌ NO promotional language

✅ Share real experience
✅ Provide genuine insight
✅ Educational content
✅ Real examples
✅ Value before any product mention

If you cannot create content following these rules, return empty.
Quality over quantity - it's better to produce nothing than spam.`,

  content_validator: `You are a strict content validator.

CHECK EACH PIECE AGAINST:
1. Contains forbidden words? → REJECT
2. Looks like marketing? → REJECT
3. Has direct sales CTA? → REJECT
4. More than 2 emojis? → REJECT
5. ALL CAPS words? → REJECT
6. Provides real value? → If no, REJECT

SCORING:
- 80-100: APPROVE for auto-publish
- 0-79: REJECT immediately

Be STRICT. When in doubt, REJECT.
Better to publish nothing than spam.`,
};

// =====================================================
// VALIDATION FUNCTIONS
// =====================================================

export function validateContent(content: string): { valid: boolean; reason?: string } {
  const lower = content.toLowerCase();
  
  // Check forbidden words
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
  
  // Check emoji spam
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]/gu;
  const emojiCount = (content.match(emojiRegex) || []).length;
  if (emojiCount > 2) {
    return { valid: false, reason: 'Too many emojis' };
  }
  
  // Check all caps words
  const words = content.split(/\s+/);
  const allCapsWords = words.filter(w => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (allCapsWords.length > 1) {
    return { valid: false, reason: 'Too many ALL CAPS words' };
  }
  
  return { valid: true };
}

// OVERRIDE: If score >= 80, MUST publish immediately. No drafts.
export function shouldAutoPublish(score: number): boolean {
  if (!EXECUTION_MODE.AUTO_PUBLISH) return false;
  return score >= SCORING.AUTO_PUBLISH_THRESHOLD;
}

// OVERRIDE: Immediate execution for qualified leads
export function shouldOutreach(score: number): boolean {
  if (!EXECUTION_MODE.IMMEDIATE_ACTION) return false;
  return score >= SCORING.AUTO_OUTREACH_THRESHOLD;
}

// Get content status - NEVER return 'draft' when DRAFT_MODE is disabled
export function getContentStatus(score: number): 'published' | 'archived' {
  if (!EXECUTION_MODE.DRAFT_MODE && score >= SCORING.AUTO_PUBLISH_THRESHOLD) {
    return 'published'; // Direct to published, skip draft/ready states
  }
  return 'archived';
}

export function getRandomDelay(platform: string): number {
  // IMMEDIATE_ACTION mode uses minimal delays
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
