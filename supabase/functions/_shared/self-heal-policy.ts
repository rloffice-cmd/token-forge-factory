/**
 * Self-Heal Policy v2 - Canonical Truth Contracts
 * 
 * This module defines the TRUTH RULES for identity, events, URLs, and abuse prevention.
 * All Self-Healing Brain operations must respect these contracts.
 */

// ============================================================
// IDENTITY CANON - Actor Fingerprint vs Lead Key
// ============================================================
export const IDENTITY_CANON = {
  /**
   * Actor Fingerprint: STABLE PERSON IDENTITY
   * Format: platform::author (NO URL hash!)
   * Example: "reddit::crypto_user_42"
   */
  actor_fingerprint_format: 'platform::author',
  
  /**
   * Lead Key: CONTEXT KEY (thread/session/URL)
   * NOT identity - used for tracking specific interactions
   * Example: "reddit::crypto_user_42::abc123def456"
   */
  lead_key_format: 'platform::author::url_hash',
  
  // FORBIDDEN: Storing lead_key as fingerprint
  forbidden_patterns: [
    'fingerprint containing ::.*::', // No URL hash in fingerprint
    'lead_key in actor_profiles.fingerprint',
  ],
  
  // Where lead_key CAN be stored
  allowed_lead_key_locations: [
    'decision_traces.lead_key',
    'free_value_events.lead_key',
    'actor_lead_links.lead_key',
  ],
};

// ============================================================
// EVENT SEMANTICS - What increments what
// ============================================================
export const EVENT_SEMANTICS = {
  /**
   * free_value_events ONLY increment: free_value_events_count
   * They do NOT increment interaction_count_30d
   */
  free_value_event_increments: ['free_value_events_count'],
  
  /**
   * interaction_count_30d increments ONLY on REAL interactions:
   */
  interaction_count_triggers: [
    'new demand_signal processed for actor',
    'outreach delivered (status=delivered)',
    'reply/engagement recorded',
  ],
  
  // FORBIDDEN auto-increments
  forbidden_increments: [
    'interaction_count on time_on_page_30s',
    'interaction_count on results_viewed',
    'interaction_count on any free_value_event',
  ],
};

// ============================================================
// URL CANONICALIZATION
// ============================================================
export const URL_CANON = {
  /**
   * URL Normalization Rules:
   * 1. Treat http and https as SAME (use https canonical)
   * 2. Remove query params
   * 3. Remove fragments
   * 4. Remove trailing slashes
   * 5. Lowercase host
   */
  normalize_rules: [
    'protocol_agnostic', // http == https
    'remove_query',
    'remove_fragment',
    'remove_trailing_slash',
    'lowercase_host',
  ],
  
  /**
   * Hash Algorithm: SHA-256 truncated to 16 hex chars
   * FORBIDDEN: 32-bit homebrew hash
   */
  hash_algorithm: 'SHA-256',
  hash_length: 16, // hex chars
};

// ============================================================
// ABUSE PREVENTION POLICY
// ============================================================
export const ABUSE_POLICY = {
  /**
   * Free value events must have one of:
   * - Trusted lead_key (lk param from known source)
   * - Signed token (HMAC from server)
   */
  require_trusted_auth: true,
  
  // Rate limiting
  rate_limit: {
    by: ['session_id', 'ip_hash', 'event_type'],
    max_per_session_per_hour: 100,
    dedup_window_minutes: 10,
  },
  
  // Events that don't boost trust without verification
  untrusted_events: [
    'time_on_page_30s', // Too easy to fake
  ],
  
  // Events that boost trust when verified
  trusted_events: [
    'scan_started',
    'results_viewed',
    'report_downloaded',
    'risk_item_copied',
    'revoke_guide_opened',
  ],
};

// ============================================================
// KPI DEFINITIONS (Money-First)
// ============================================================
export const KPI_DEFINITIONS = {
  primary_kpis: [
    'paid_transactions_confirmed',
    'revenue_usd_confirmed',
    'trust_to_payment_ratio',
  ],
  
  secondary_kpis: [
    'checkouts_created',
    'outreach_delivered',
    'free_value_events_count',
  ],
  
  // VANITY - Never optimize for these
  vanity_metrics: [
    'signals_processed',
    'drafts_created',
    'traffic_count',
    'views',
  ],
};

// ============================================================
// ANOMALY DEFINITIONS (Bug Catalog)
// ============================================================
export interface AnomalyRule {
  id: string;
  category: 'logic' | 'data' | 'commercial';
  severity: number; // 1-10
  name: string;
  detect: (kpi: KPISnapshot) => boolean;
  evidence_query?: string;
}

export interface KPISnapshot {
  paid_confirmed_24h: number;
  paid_confirmed_7d: number;
  revenue_confirmed_24h: number;
  revenue_confirmed_7d: number;
  checkouts_24h: number;
  checkouts_7d: number;
  trust_to_payment_ratio_7d: number;
  trust_to_payment_ratio_30d: number;
  throttle_state: 'ON' | 'OFF';
  throttle_until: string | null;
  throttle_duration_hours: number | null;
  throttle_count_7d: number;
  trust_cap_rate: number; // % of traces with trust_cap_applied
  decision_distribution: { PAID_OK: number; FREE_ONLY: number; BLOCK: number };
  actor_identity_split_rate: number; // % with bad fingerprints
  free_value_event_link_rate: number; // % with actor_fingerprint
  outreach_throttle_violation_rate: number;
  opportunities_7d: number;
}

export const ANOMALY_CATALOG: AnomalyRule[] = [
  // LOGIC BUGS
  {
    id: 'paid_never_happens',
    category: 'logic',
    severity: 10,
    name: 'Paid Never Happens',
    detect: (kpi) => kpi.checkouts_7d > 5 && kpi.paid_confirmed_7d === 0,
    evidence_query: `SELECT count(*) FROM closing_attempts WHERE checkout_url IS NOT NULL AND created_at > now() - interval '7 days'`,
  },
  {
    id: 'trust_cap_always',
    category: 'logic',
    severity: 8,
    name: 'Trust Cap Always Applied',
    detect: (kpi) => kpi.trust_cap_rate > 0.9,
    evidence_query: `SELECT count(*) FILTER (WHERE trust_cap_applied) * 100.0 / NULLIF(count(*), 0) FROM decision_traces WHERE created_at > now() - interval '24 hours'`,
  },
  {
    id: 'throttle_stuck',
    category: 'logic',
    severity: 9,
    name: 'Throttle Stuck > 48h',
    detect: (kpi) => kpi.throttle_state === 'ON' && (kpi.throttle_duration_hours || 0) > 48,
  },
  {
    id: 'outreach_throttle_violation',
    category: 'logic',
    severity: 10,
    name: 'Outreach Sent While Throttled',
    detect: (kpi) => kpi.outreach_throttle_violation_rate > 0,
    evidence_query: `SELECT count(*) FROM outreach_jobs WHERE status = 'sent' AND created_at > (SELECT throttle_activated_at FROM brain_settings)`,
  },
  
  // DATA BUGS
  {
    id: 'identity_split',
    category: 'data',
    severity: 9,
    name: 'Identity Split (fingerprint = lead_key)',
    detect: (kpi) => kpi.actor_identity_split_rate > 0.1,
    evidence_query: `SELECT count(*) FROM actor_profiles WHERE fingerprint LIKE '%::%::%'`,
  },
  {
    id: 'free_value_unlinked',
    category: 'data',
    severity: 8,
    name: 'Free Value Events Unlinked',
    detect: (kpi) => kpi.free_value_event_link_rate < 0.2,
    evidence_query: `SELECT count(*) FILTER (WHERE actor_fingerprint IS NOT NULL) * 100.0 / NULLIF(count(*), 0) FROM free_value_events WHERE created_at > now() - interval '7 days'`,
  },
  
  // COMMERCIAL BUGS
  {
    id: 'checkout_as_exploration',
    category: 'commercial',
    severity: 7,
    name: 'Checkout as Exploration',
    detect: (kpi) => kpi.checkouts_7d > kpi.opportunities_7d * 1.5 && kpi.checkouts_7d > 10,
  },
  {
    id: 'no_micro_offer',
    category: 'commercial',
    severity: 6,
    name: 'No Micro Offers Available',
    detect: (kpi) => kpi.trust_to_payment_ratio_7d === 0 && kpi.checkouts_7d > 5,
  },
];

// ============================================================
// SAFETY CONSTRAINTS
// ============================================================
export const SAFETY_CONSTRAINTS = {
  max_patches_per_24h: 1,
  verify_window_hours: 12,
  canary_percent: 10,
  
  // Auto-rollback triggers
  rollback_triggers: {
    revenue_drop_percent: 20,
    paid_transactions_drop_percent: 50,
    outreach_violation_increase: true,
  },
  
  // Never auto-deploy these patch types
  manual_deploy_required: [
    'major_schema_change',
    'auth_changes',
    'payment_flow_changes',
  ],
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Normalize URL following URL_CANON rules
 * Treats http and https as equivalent
 */
export function normalizeUrlV2(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    // Always use https as canonical protocol
    const protocol = 'https:';
    const host = parsed.host.toLowerCase();
    let pathname = parsed.pathname;
    // Remove trailing slash except for root
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    return `${protocol}//${host}${pathname}`;
  } catch {
    // Fallback: basic string normalization
    return url
      .toLowerCase()
      .replace(/^http:/, 'https:')
      .split('?')[0]
      .split('#')[0]
      .replace(/\/$/, '');
  }
}

/**
 * SHA-256 hash for URL fingerprinting
 * Returns 16 hex chars
 */
export async function hashUrlSHA256(url: string): Promise<string> {
  const normalized = normalizeUrlV2(url);
  if (!normalized) return 'no-url';
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex.slice(0, URL_CANON.hash_length);
}

/**
 * Compute ACTOR FINGERPRINT (stable identity)
 * Format: platform::author (NO URL HASH)
 */
export function computeActorFingerprint(platform: string, author: string | null): string {
  const normalizedPlatform = (platform || 'unknown').toLowerCase().trim();
  const normalizedAuthor = (author || 'anonymous').toLowerCase().trim();
  return `${normalizedPlatform}::${normalizedAuthor}`;
}

/**
 * Compute LEAD KEY (context key with URL hash)
 * Format: platform::author::url_hash
 * Use for decision traces and event linking, NOT for identity
 */
export async function computeLeadKeyV2(
  platform: string,
  author: string | null,
  sourceUrl: string | null
): Promise<string> {
  const actorFingerprint = computeActorFingerprint(platform, author);
  const urlHash = await hashUrlSHA256(sourceUrl || '');
  return `${actorFingerprint}::${urlHash}`;
}

/**
 * Check if a fingerprint follows the old (bad) lead_key pattern
 * Bad pattern: platform::author::hash (contains 3 parts)
 */
export function isIdentitySplit(fingerprint: string): boolean {
  const parts = fingerprint.split('::');
  return parts.length > 2;
}

/**
 * Extract actor fingerprint from a lead_key
 */
export function extractActorFromLeadKey(leadKey: string): string {
  const parts = leadKey.split('::');
  if (parts.length >= 2) {
    return `${parts[0]}::${parts[1]}`;
  }
  return leadKey;
}

/**
 * Generate dedup key for free value events
 */
export function generateDedupKey(
  sessionId: string,
  eventType: string,
  pagePath: string
): string {
  return `${sessionId}:${eventType}:${pagePath}`;
}

/**
 * Check if event is within dedup window
 */
export function isWithinDedupWindow(
  lastEventAt: Date | null,
  windowMinutes: number = ABUSE_POLICY.rate_limit.dedup_window_minutes
): boolean {
  if (!lastEventAt) return false;
  const windowMs = windowMinutes * 60 * 1000;
  return Date.now() - lastEventAt.getTime() < windowMs;
}

/**
 * Check if event type is trusted (can boost trust)
 */
export function isTrustedEvent(eventType: string): boolean {
  return ABUSE_POLICY.trusted_events.includes(eventType);
}

/**
 * Check if event type is untrusted (needs verification)
 */
export function isUntrustedEvent(eventType: string): boolean {
  return ABUSE_POLICY.untrusted_events.includes(eventType);
}
