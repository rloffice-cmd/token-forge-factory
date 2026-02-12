/**
 * Get Manual Outreach Queue
 * Returns pending manual outreach tasks (fallback logging for API failures)
 * SECURITY: Admin API Token required
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function mustEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: Accept ADMIN_API_TOKEN or x-cron-secret
    const adminToken = Deno.env.get("ADMIN_API_TOKEN") || "";
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const authHeader = req.headers.get("authorization") || "";
    const cronHeader = req.headers.get("x-cron-secret") || "";

    const isAdminAuth = adminToken && authHeader.includes(adminToken);
    const isCronAuth = cronSecret && cronHeader === cronSecret;

    if (!isAdminAuth && !isCronAuth) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      mustEnv("SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const url = new URL(req.url);
    const resolved = url.searchParams.get("resolved") === "true";

    // Query pending manual outreach tasks
    let query = supabase
      .from("manual_outreach_needed")
      .select("*", { count: "exact" });

    if (!resolved) {
      query = query.is("resolved_at", null);
    }

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        pending_count: !resolved ? data?.length || 0 : count,
        total_count: count,
        tasks: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("get-manual-outreach-queue error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
