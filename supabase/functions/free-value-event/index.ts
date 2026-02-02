/**
 * Free Value Event Tracker
 * 
 * Client-side events that count as "free value received"
 * This builds Trust and enables Paid flow
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
import { isValidFreeValueEvent, computeLeadKey } from "../_shared/master-prompt-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FreeValueEventRequest {
  event_type: string;
  lead_key?: string;       // Stable lead identifier
  session_id?: string;     // Browser session UUID
  source_url?: string;     // Current page URL
  metadata?: Record<string, unknown>;
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

    // Use lead_key from request or generate one
    const leadKey = body.lead_key || computeLeadKey(
      'web',  // Default platform for direct visits
      sessionId.slice(0, 8),  // Use session prefix as pseudo-author
      body.source_url || null
    );

    // Insert the free value event
    const { data: event, error: eventError } = await supabase
      .from("free_value_events")
      .insert({
        event_type: body.event_type,
        session_id: sessionId,
        source_url: body.source_url || null,
        event_data: {
          ...body.metadata,
          lead_key: leadKey,
          timestamp: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (eventError) {
      console.error("Failed to insert event:", eventError);
      throw eventError;
    }

    // Update actor_profiles to increment free_value_events_count
    const { data: existingProfile } = await supabase
      .from("actor_profiles")
      .select("id, free_value_events_count, interaction_count_30d")
      .eq("fingerprint", leadKey)
      .maybeSingle();

    if (existingProfile) {
      // Update existing profile
      await supabase
        .from("actor_profiles")
        .update({
          free_value_events_count: (existingProfile.free_value_events_count || 0) + 1,
          interaction_count_30d: (existingProfile.interaction_count_30d || 0) + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id);
    } else {
      // Create new profile
      await supabase
        .from("actor_profiles")
        .insert({
          fingerprint: leadKey,
          platform: 'web',
          author: sessionId.slice(0, 8),
          interaction_count_30d: 1,
          free_value_events_count: 1,
        });
    }

    console.log(`✅ Free value event: ${body.event_type} for lead ${leadKey}`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        event_id: event.id,
        lead_key: leadKey,
        session_id: sessionId,
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
