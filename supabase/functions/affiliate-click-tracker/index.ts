/**
 * Affiliate Click Tracker v2
 * Public endpoint that:
 * 1. Tracks clicks with privacy-safe hashing
 * 2. Records analytics
 * 3. Redirects to affiliate URL
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
      return new Response("Missing program ID", { 
        status: 400,
        headers: corsHeaders 
      });
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
      return new Response("Program not found", { 
        status: 404,
        headers: corsHeaders 
      });
    }

    // Check if program has affiliate_id configured
    if (!program.affiliate_id) {
      console.log(`Program ${program.name} has no affiliate_id configured, redirecting to base URL`);
      return new Response(null, {
        status: 302,
        headers: {
          "Location": program.base_url,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // Hash IP for privacy using Web Crypto API
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                     req.headers.get("cf-connecting-ip") || 
                     "unknown";
    const encoder = new TextEncoder();
    const data = encoder.encode(clientIP + new Date().toDateString() + programId);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const ipHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);

    // Check for duplicate clicks (same IP hash within 24 hours)
    const { count: recentClicks } = await supabase
      .from("affiliate_clicks")
      .select("*", { count: "exact", head: true })
      .eq("program_id", programId)
      .eq("ip_hash", ipHash)
      .gte("clicked_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if ((recentClicks || 0) === 0) {
      // Track unique click
      await supabase.from("affiliate_clicks").insert({
        program_id: programId,
        source: source,
        source_id: contentId,
        ip_hash: ipHash,
        user_agent: req.headers.get("user-agent")?.slice(0, 500),
        referrer_url: req.headers.get("referer")?.slice(0, 500),
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

      console.log(`✅ Click tracked for ${program.name} from ${source}`);
    } else {
      console.log(`⏭️ Duplicate click skipped for ${program.name}`);
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
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (e) {
    console.error("Click tracker error:", e);
    return new Response("Error processing request", { 
      status: 500,
      headers: corsHeaders 
    });
  }
});
