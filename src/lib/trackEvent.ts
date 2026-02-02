/**
 * Client-side Free Value Event Tracking
 * 
 * Use this to track user actions that demonstrate "value received"
 * These events build Trust and unlock Paid flows
 * 
 * Valid events:
 * - scan_started: User initiated a scan
 * - results_viewed: User saw scan results
 * - time_on_page_30s: User spent 30+ seconds on page
 * - report_downloaded: User downloaded a report
 * - risk_item_copied: User copied risk information
 * - revoke_guide_opened: User opened revoke guide
 */

import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = 'dtf_session_id';
const LEAD_KEY_PARAM = 'lk';

type FreeValueEventType = 
  | 'scan_started'
  | 'results_viewed'
  | 'time_on_page_30s'
  | 'report_downloaded'
  | 'risk_item_copied'
  | 'revoke_guide_opened';

/**
 * Get or create a persistent session ID
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

/**
 * Get lead_key from URL parameter or localStorage
 */
function getLeadKey(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  
  // Check URL first
  const urlParams = new URLSearchParams(window.location.search);
  const urlLeadKey = urlParams.get(LEAD_KEY_PARAM);
  
  if (urlLeadKey) {
    // Save to localStorage for future use
    localStorage.setItem('dtf_lead_key', urlLeadKey);
    return urlLeadKey;
  }
  
  // Fall back to localStorage
  return localStorage.getItem('dtf_lead_key') || undefined;
}

/**
 * Track a free value event
 * This builds Trust and enables Paid flow
 */
export async function trackFreeValueEvent(
  eventType: FreeValueEventType,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionId = getSessionId();
    const leadKey = getLeadKey();
    const sourceUrl = typeof window !== 'undefined' ? window.location.href : undefined;

    const response = await supabase.functions.invoke('free-value-event', {
      body: {
        event_type: eventType,
        session_id: sessionId,
        lead_key: leadKey,
        source_url: sourceUrl,
        metadata,
      },
    });

    if (response.error) {
      console.error('Track event error:', response.error);
      return { success: false, error: response.error.message };
    }

    console.log(`✅ Tracked: ${eventType}`);
    return { success: true };
  } catch (error) {
    console.error('Track event exception:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Auto-track time on page after threshold
 * Call once when page loads
 */
export function autoTrackTimeOnPage(thresholdSeconds = 30): void {
  if (typeof window === 'undefined') return;
  
  const startTime = Date.now();
  let tracked = false;

  const checkTime = () => {
    if (tracked) return;
    
    const elapsed = (Date.now() - startTime) / 1000;
    if (elapsed >= thresholdSeconds) {
      tracked = true;
      trackFreeValueEvent('time_on_page_30s', { 
        elapsed_seconds: Math.round(elapsed),
        page: window.location.pathname,
      });
    }
  };

  // Check every 5 seconds
  const interval = setInterval(checkTime, 5000);
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    clearInterval(interval);
  });
}

/**
 * Track scan start
 */
export function trackScanStarted(address?: string): void {
  trackFreeValueEvent('scan_started', { address: address?.slice(0, 10) + '...' });
}

/**
 * Track results viewed
 */
export function trackResultsViewed(resultCount?: number): void {
  trackFreeValueEvent('results_viewed', { result_count: resultCount });
}

/**
 * Track report download
 */
export function trackReportDownloaded(reportType?: string): void {
  trackFreeValueEvent('report_downloaded', { report_type: reportType });
}

/**
 * Track risk item copied
 */
export function trackRiskItemCopied(itemType?: string): void {
  trackFreeValueEvent('risk_item_copied', { item_type: itemType });
}

/**
 * Track revoke guide opened
 */
export function trackRevokeGuideOpened(): void {
  trackFreeValueEvent('revoke_guide_opened');
}
