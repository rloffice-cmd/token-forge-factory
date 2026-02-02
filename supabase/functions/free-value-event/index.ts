/**
 * Free Value Event Tracker v2
 * 
 * Client-side events that count as "free value received"
 * This builds Trust and enables Paid flow
 * 
 * v2 UPGRADES:
 * - Anti-abuse: rate limiting + dedup
 * - Proper identity: actor_fingerprint vs lead_key separation
 * - Trusted events only boost trust
 * 
 * VALID EVENTS:
 * - scan_started
 * - results_viewed
 * - time_on_page_30s
 * - report_downloaded
 * - risk_item_copied
 * - revoke_guide_opened
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { 
  isValidFreeValueEvent, 
  computeActorFingerprint, 
  computeLeadKeyAsync,
  extractActorFromLeadKey,
} from "../_shared/master-prompt-config.ts";
import {
  ABUSE_POLICY,
  isTrustedEvent,
  isUntrustedEvent,
  generateDedupKey,
} from "../_shared/self-heal-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FreeValueEventRequest {
  event_type: string;
  lead_key?: string;       // Context key (optional - for linking)
  actor_fingerprint?: string; // Stable actor identity (optional)
  session_id?: string;     // Browser session UUID
  source_url?: string;     // Current page URL
  page_path?: string;      // Just the path for dedup
  metadata?: Record<string, unknown>;
  // Anti-abuse
  signature?: string;      // HMAC signature for trusted sources
}

// Simple IP hash for rate limiting
function hashIP(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash) + ip.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: FreeValueEventRequest = await req.json();
    
    // Validate event type
    if (!body.event_type) {
      return new Response(
        JSON.stringify({ error: "event_type required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if this is a valid free value event
    if (!isValidFreeValueEvent(body.event_type)) {
      console.log(`⚠️ Invalid event type: ${body.event_type}`);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "invalid_event_type",
          valid_types: [
            'scan_started', 'results_viewed', 'time_on_page_30s',
            'report_downloaded', 'risk_item_copied', 'revoke_guide_opened'
          ]
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate session_id if not provided
    const sessionId = body.session_id || crypto.randomUUID();
    
    // Get IP for rate limiting (hashed for privacy)
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";
    const ipHash = hashIP(clientIP);

    // ============================================================
    // ANTI-ABUSE: Deduplication Check
    // ============================================================
    const pagePath = body.page_path || (body.source_url ? new URL(body.source_url).pathname : '/');
    const dedupKey = generateDedupKey(sessionId, body.event_type, pagePath);

    // Check for duplicate within dedup window
    const dedupWindowStart = new Date(
      Date.now() - ABUSE_POLICY.rate_limit.dedup_window_minutes * 60 * 1000
    ).toISOString();

    const { data: existingEvent } = await supabase
      .from("free_value_events")
      .select("id, created_at")
      .eq("dedup_key", dedupKey)
      .gte("created_at", dedupWindowStart)
      .maybeSingle();

    if (existingEvent) {
      console.log(`🚫 Dedup: ${body.event_type} already recorded for session ${sessionId.slice(0, 8)}`);
      return new Response(
        JSON.stringify({ 
          ok: true, 
          deduplicated: true,
          existing_event_id: existingEvent.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // ANTI-ABUSE: Rate Limiting Check
    // ============================================================
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentEventsCount } = await supabase
      .from("free_value_events")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .gte("created_at", hourAgo);

    if ((recentEventsCount || 0) >= ABUSE_POLICY.rate_limit.max_per_session_per_hour) {
      console.log(`🚫 Rate limit: session ${sessionId.slice(0, 8)} exceeded hourly limit`);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: "rate_limited",
          retry_after_minutes: 60,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // IDENTITY RESOLUTION (v2 Policy)
    // ============================================================
    // Determine actor_fingerprint (stable identity)
    let actorFingerprint: string | null = null;
    let leadKey: string | null = body.lead_key || null;
    let isTrusted = false;

    // If lead_key provided via lk param, extract actor from it
    if (leadKey) {
      actorFingerprint = extractActorFromLeadKey(leadKey);
      isTrusted = true; // lk param means trusted source
    } else if (body.actor_fingerprint) {
      // Direct actor fingerprint (from signed token or known source)
      actorFingerprint = body.actor_fingerprint;
      isTrusted = !!body.signature; // Only trusted if signed
    } else {
      // Generate new lead_key for anonymous visitors
      leadKey = await computeLeadKeyAsync('web', sessionId.slice(0, 8), body.source_url || null);
      actorFingerprint = extractActorFromLeadKey(leadKey);
      // Anonymous = not trusted, won't boost trust score
      isTrusted = false;
    }

    // ============================================================
    // INSERT EVENT
    // ============================================================
    const { data: event, error: eventError } = await supabase
      .from("free_value_events")
      .insert({
        event_type: body.event_type,
        session_id: sessionId,
        source_url: body.source_url || null,
        page_path: pagePath,
        actor_fingerprint: actorFingerprint,
        lead_key: leadKey,
        ip_hash: ipHash,
        is_trusted: isTrusted,
        dedup_key: dedupKey,
        event_data: {
          ...body.metadata,
          timestamp: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (eventError) {
      console.error("Failed to insert event:", eventError);
      throw eventError;
    }

    // ============================================================
    // UPDATE ACTOR PROFILE (v2 Policy - event semantics)
    // ============================================================
    // CRITICAL: free_value_events only increment free_value_events_count
    // They do NOT increment interaction_count_30d (per EVENT_SEMANTICS)
    
    if (actorFingerprint) {
      const { data: existingProfile } = await supabase
        .from("actor_profiles")
        .select("id, free_value_events_count")
        .eq("fingerprint", actorFingerprint)
        .maybeSingle();

      if (existingProfile) {
        // Update existing profile - ONLY increment free_value_events_count
        await supabase
          .from("actor_profiles")
          .update({
            free_value_events_count: (existingProfile.free_value_events_count || 0) + 1,
            last_seen_at: new Date().toISOString(),
            // NOTE: interaction_count_30d is NOT incremented here (per policy)
          })
          .eq("id", existingProfile.id);
      } else {
        // Create new profile
        await supabase
          .from("actor_profiles")
          .insert({
            fingerprint: actorFingerprint,
            platform: 'web',
            author: sessionId.slice(0, 8),
            interaction_count_30d: 0, // Start at 0 - only real interactions count
            free_value_events_count: 1,
          });
      }

      // ============================================================
      // ACTOR-LEAD LINK (if confidence is high)
      // ============================================================
      if (leadKey && actorFingerprint && isTrusted) {
        // Upsert link with confidence
        await supabase
          .from("actor_lead_links")
          .upsert({
            actor_fingerprint: actorFingerprint,
            lead_key: leadKey,
            confidence: isTrustedEvent(body.event_type) ? 0.9 : 0.6,
            last_seen_at: new Date().toISOString(),
          }, {
            onConflict: 'actor_fingerprint,lead_key',
          });
      }
    }

    // Determine if this event should boost trust
    const boostsTrust = isTrusted && isTrustedEvent(body.event_type);

    console.log(`✅ Free value event: ${body.event_type} | actor: ${actorFingerprint?.slice(0, 20)} | trusted: ${isTrusted} | boosts_trust: ${boostsTrust}`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        event_id: event.id,
        actor_fingerprint: actorFingerprint,
        lead_key: leadKey,
        session_id: sessionId,
        is_trusted: isTrusted,
        boosts_trust: boostsTrust,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Free value event error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
