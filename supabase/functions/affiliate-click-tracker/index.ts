/**
 * Affiliate Click Tracker
 * Tracks clicks on affiliate links and redirects to affiliate URL
 * Public endpoint for link tracking
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const programId = url.searchParams.get("p");
    const contentId = url.searchParams.get("c");
    const source = url.searchParams.get("s") || "direct";

    if (!programId) {
      return new Response("Missing program ID", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get program details
    const { data: program } = await supabase
      .from("affiliate_programs")
      .select("*")
      .eq("id", programId)
      .single();

    if (!program) {
      return new Response("Program not found", { status: 404 });
    }

    // Hash IP for privacy using Web Crypto API
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const encoder = new TextEncoder();
    const data = encoder.encode(clientIP + new Date().toDateString());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const ipHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);

    // Track click
    await supabase.from("affiliate_clicks").insert({
      program_id: programId,
      source: source,
      source_id: contentId,
      ip_hash: ipHash,
      user_agent: req.headers.get("user-agent"),
      referrer_url: req.headers.get("referer"),
    });

    // Update content click count if applicable
    if (contentId) {
      const { data: currentContent } = await supabase
        .from("affiliate_content")
        .select("clicks")
        .eq("id", contentId)
        .single();
      
      if (currentContent) {
        await supabase
          .from("affiliate_content")
          .update({ clicks: (currentContent.clicks || 0) + 1 })
          .eq("id", contentId);
      }
    }

    // Build affiliate URL
    let affiliateUrl = program.base_url;
    if (program.affiliate_link_template && program.affiliate_id) {
      affiliateUrl = program.affiliate_link_template.replace("{affiliate_id}", program.affiliate_id);
    }

    // Redirect to affiliate URL
    return new Response(null, {
      status: 302,
      headers: {
        "Location": affiliateUrl,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (e) {
    console.error("Click tracker error:", e);
    return new Response("Error tracking click", { status: 500 });
  }
});
