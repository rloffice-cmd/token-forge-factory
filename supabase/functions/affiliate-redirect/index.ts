/**
 * Affiliate Redirect Engine V4.0
 * Public endpoint: /go/[partner_slug]/[lead_id]
 * 
 * 1. Records click in click_analytics (privacy-safe IP hash)
 * 2. Fetches partner's affiliate_base_url from m2m_partners
 * 3. 302 redirects to the partner site
 * 
 * SECURITY: PUBLIC - No auth required (tracking endpoint)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const partnerSlug = url.searchParams.get("partner");
    const leadId = url.searchParams.get("lead") || "direct";
    const source = url.searchParams.get("src") || "unknown";

    if (!partnerSlug) {
      return new Response("Missing partner slug", { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch partner by slug (name lowercased, hyphenated)
    const { data: partners } = await supabase
      .from("m2m_partners")
      .select("id, name, affiliate_base_url, is_active")
      .eq("is_active", true);

    const partner = (partners || []).find(
      (p: { name: string }) => p.name.toLowerCase().replace(/[^a-z0-9]/g, "-") === partnerSlug.toLowerCase()
    );

    if (!partner) {
      return new Response("Partner not found", { status: 404, headers: corsHeaders });
    }

    // Privacy-safe IP hashing
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0] ||
                     req.headers.get("cf-connecting-ip") || "unknown";
    const encoder = new TextEncoder();
    const hashData = encoder.encode(clientIP + new Date().toDateString() + partnerSlug);
    const hashBuffer = await crypto.subtle.digest("SHA-256", hashData);
    const ipHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);

    // Record click
    await supabase.from("click_analytics").insert({
      lead_id: leadId,
      partner_id: partner.id,
      partner_slug: partnerSlug,
      source_platform: source,
      source_url: req.headers.get("referer")?.slice(0, 500) || null,
      ip_hash: ipHash,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) || null,
      referrer_url: req.headers.get("referer")?.slice(0, 500) || null,
      redirect_url: partner.affiliate_base_url,
    });

    console.log(`🔗 Click: ${partnerSlug} | Lead: ${leadId} | Source: ${source}`);

    // 302 Redirect
    return new Response(null, {
      status: 302,
      headers: {
        "Location": partner.affiliate_base_url,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (e) {
    console.error("Redirect error:", e);
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});
