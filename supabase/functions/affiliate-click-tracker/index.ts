/**
 * Affiliate Click Tracker v3
 * Enhanced: captures source_platform, ip_hash, actor_fingerprint
 * Also writes to click_analytics for real-time tracking
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const programId = url.searchParams.get("p");
    const contentId = url.searchParams.get("c");
    const source = url.searchParams.get("s") || "direct";
    const platform = url.searchParams.get("platform") || detectPlatform(req.headers.get("referer") || "");
    const fingerprint = url.searchParams.get("fp") || null;

    if (!programId) {
      return new Response("Missing program ID", { status: 400, headers: corsHeaders });
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
      return new Response("Program not found", { status: 404, headers: corsHeaders });
    }

    if (!program.affiliate_id) {
      console.log(`Program ${program.name} has no affiliate_id, redirecting to base URL`);
      return new Response(null, {
        status: 302,
        headers: { "Location": program.base_url, "Cache-Control": "no-cache, no-store, must-revalidate" },
      });
    }

    // Hash IP for privacy
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                     req.headers.get("cf-connecting-ip") || "unknown";
    const encoder = new TextEncoder();
    const data = encoder.encode(clientIP + new Date().toDateString() + programId);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const ipHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);

    // Deduplicate: same IP hash within 24h
    const { count: recentClicks } = await supabase
      .from("affiliate_clicks")
      .select("*", { count: "exact", head: true })
      .eq("program_id", programId)
      .eq("ip_hash", ipHash)
      .gte("clicked_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const referrerUrl = req.headers.get("referer")?.slice(0, 500) || null;
    const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;

    if ((recentClicks || 0) === 0) {
      // Track in affiliate_clicks with actor_fingerprint
      const { data: clickRecord } = await supabase.from("affiliate_clicks").insert({
        program_id: programId,
        source: source,
        source_id: contentId,
        ip_hash: ipHash,
        user_agent: userAgent,
        referrer_url: referrerUrl,
        actor_fingerprint: fingerprint,
      }).select("id").single();

      // Also track in click_analytics for real-time dashboard
      const partnerSlug = program.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      await supabase.from("click_analytics").insert({
        partner_slug: partnerSlug,
        source_platform: platform,
        ip_hash: ipHash,
        redirect_url: program.base_url,
        referrer_url: referrerUrl,
        user_agent: userAgent,
        actor_fingerprint: fingerprint,
        lead_id: contentId,
      });

      // Update content click count
      if (contentId) {
        const { data: currentContent } = await supabase
          .from("affiliate_content")
          .select("clicks")
          .eq("id", contentId)
          .single();
        if (currentContent) {
          await supabase.from("affiliate_content")
            .update({ clicks: (currentContent.clicks || 0) + 1 })
            .eq("id", contentId);
        }
      }

      console.log(`✅ Click tracked: ${program.name} | platform=${platform} | fp=${fingerprint || 'none'}`);
    } else {
      console.log(`⏭️ Duplicate click skipped for ${program.name}`);
    }

    // Build affiliate URL
    let affiliateUrl = program.base_url;
    if (program.affiliate_link_template && program.affiliate_id) {
      affiliateUrl = program.affiliate_link_template.replace("{affiliate_id}", program.affiliate_id);
    }

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
    return new Response("Error processing request", { status: 500, headers: corsHeaders });
  }
});

/** Detect platform from referrer URL */
function detectPlatform(referrer: string): string {
  const r = referrer.toLowerCase();
  if (r.includes("linkedin")) return "linkedin";
  if (r.includes("twitter") || r.includes("x.com")) return "twitter";
  if (r.includes("reddit")) return "reddit";
  if (r.includes("whatsapp")) return "whatsapp";
  if (r.includes("t.me") || r.includes("telegram")) return "telegram";
  if (r.includes("facebook") || r.includes("fb.com")) return "facebook";
  if (r.includes("hackernews") || r.includes("ycombinator")) return "hackernews";
  return "direct";
}
