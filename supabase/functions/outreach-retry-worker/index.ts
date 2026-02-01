/**
 * Outreach Retry Worker - Self-Heal
 * מחפש jobs שנכשלו ומנסה שוב
 * Runs every 5-10 minutes via pg_cron
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const supabase = createClient(
      mustEnv("SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    console.log("🔄 Outreach Retry Worker starting...");

    const now = new Date().toISOString();

    // Find failed jobs ready for retry
    const { data: failedJobs, error: fetchErr } = await supabase
      .from("outreach_jobs")
      .select("id, attempts, gate_fail_reason")
      .eq("status", "failed")
      .lte("next_retry_at", now)
      .order("next_retry_at", { ascending: true })
      .limit(10);

    if (fetchErr) {
      console.error("Failed to fetch failed jobs:", fetchErr);
      throw fetchErr;
    }

    if (!failedJobs || failedJobs.length === 0) {
      console.log("✅ No failed jobs to retry");
      return new Response(
        JSON.stringify({ ok: true, retried: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📋 Found ${failedJobs.length} failed jobs to retry`);

    const adminToken = Deno.env.get("ADMIN_API_TOKEN") || "";
    const senderUrl = `${mustEnv("SUPABASE_URL")}/functions/v1/outreach-sender`;
    
    let retried = 0;
    let errors = 0;

    for (const job of failedJobs) {
      try {
        console.log(`🔁 Retrying job ${job.id} (attempt ${job.attempts + 1})`);
        
        const resp = await fetch(senderUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ job_id: job.id }),
        });

        if (resp.ok) {
          retried++;
        } else {
          errors++;
          console.warn(`Failed to retry job ${job.id}: ${resp.status}`);
        }

        // Rate limiting between retries
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (e) {
        errors++;
        console.error(`Error retrying job ${job.id}:`, e);
      }
    }

    // Also check for gated jobs with next_retry_at (daily cap etc)
    const { data: gatedJobs } = await supabase
      .from("outreach_jobs")
      .select("id, gate_fail_reason")
      .eq("status", "gated")
      .eq("gate_fail_reason", "daily_cap_reached")
      .lte("next_retry_at", now)
      .limit(5);

    if (gatedJobs && gatedJobs.length > 0) {
      console.log(`📋 Found ${gatedJobs.length} gated jobs to retry`);
      
      for (const job of gatedJobs) {
        // Reset to queued for retry
        await supabase
          .from("outreach_jobs")
          .update({ status: "queued", gate_fail_reason: null, next_retry_at: null })
          .eq("id", job.id);

        try {
          await fetch(senderUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ job_id: job.id }),
          });
          retried++;
        } catch (e) {
          errors++;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Retry complete: ${retried} retried, ${errors} errors`);

    return new Response(
      JSON.stringify({ ok: true, retried, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("outreach-retry-worker error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
