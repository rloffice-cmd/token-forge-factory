/**
 * Outreach Queue - Create Job + Trigger Sender
 * מקבל Intent + Draft + Lead payload, יוצר job ומפעיל שליחה
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function mustEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminToken = Deno.env.get("ADMIN_API_TOKEN") || "";
    const authHeader = req.headers.get("authorization") || "";
    
    if (!adminToken || !authHeader.includes(adminToken)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      mustEnv("SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const body = await req.json();
    const {
      source = "unknown",
      intent_topic,
      confidence = 0,
      lead_payload = {},
      draft_text = "",
      revised_text,
    } = body;

    console.log(`📥 Creating outreach job: ${intent_topic} (confidence: ${confidence})`);

    // Insert job
    const { data: job, error: insErr } = await supabase
      .from("outreach_jobs")
      .insert({
        source,
        intent_topic,
        confidence,
        lead_payload,
        draft_text,
        revised_text,
        channel: "telegram",
        destination: "telegram",
        status: "queued",
      })
      .select("id")
      .single();

    if (insErr || !job) {
      console.error("Failed to create job:", insErr);
      throw insErr || new Error("Failed to create job");
    }

    console.log(`✅ Job created: ${job.id}`);

    // Fire-and-forget sender
    const url = `${mustEnv("SUPABASE_URL")}/functions/v1/outreach-sender`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ job_id: job.id }),
    }).catch((e) => console.warn("Fire-and-forget sender failed:", e));

    return new Response(
      JSON.stringify({ ok: true, job_id: job.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("outreach-queue error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
