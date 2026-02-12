import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API = "https://api.resend.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: admin token or session
    const adminToken = req.headers.get("x-admin-token") || "";
    const authHeader = req.headers.get("authorization") || "";
    const expectedAdmin = Deno.env.get("ADMIN_API_TOKEN") || "";

    if (adminToken !== expectedAdmin && !authHeader.includes("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action } = await req.json();
    const DOMAIN = "truthtoken.io";

    // ===== ACTION: register =====
    if (action === "register") {
      // Check if already registered
      const listRes = await fetch(`${RESEND_API}/domains`, {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      const listData = await listRes.json();

      const existing = listData.data?.find(
        (d: { name: string }) => d.name === DOMAIN
      );

      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            already_registered: true,
            domain: existing,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Register new domain
      const createRes = await fetch(`${RESEND_API}/domains`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: DOMAIN }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        return new Response(
          JSON.stringify({
            error: `Resend ${createRes.status}: ${JSON.stringify(createData)}`,
            status_code: createRes.status,
          }),
          {
            status: createRes.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          already_registered: false,
          domain: createData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== ACTION: get-records =====
    if (action === "get-records") {
      const listRes = await fetch(`${RESEND_API}/domains`, {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      const listData = await listRes.json();

      const domain = listData.data?.find(
        (d: { name: string }) => d.name === DOMAIN
      );

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not registered in Resend. Register first." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get detailed domain info with records
      const detailRes = await fetch(`${RESEND_API}/domains/${domain.id}`, {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      const detailData = await detailRes.json();

      return new Response(
        JSON.stringify({
          success: true,
          domain_id: domain.id,
          domain_name: DOMAIN,
          status: detailData.status,
          records: detailData.records || [],
          region: detailData.region,
          created_at: detailData.created_at,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== ACTION: verify =====
    if (action === "verify") {
      const listRes = await fetch(`${RESEND_API}/domains`, {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      const listData = await listRes.json();

      const domain = listData.data?.find(
        (d: { name: string }) => d.name === DOMAIN
      );

      if (!domain) {
        return new Response(
          JSON.stringify({ error: "Domain not registered" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Trigger verification
      const verifyRes = await fetch(
        `${RESEND_API}/domains/${domain.id}/verify`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}` },
        }
      );

      const verifyData = await verifyRes.json();

      // Re-fetch domain status
      const statusRes = await fetch(`${RESEND_API}/domains/${domain.id}`, {
        headers: { Authorization: `Bearer ${resendKey}` },
      });
      const statusData = await statusRes.json();

      return new Response(
        JSON.stringify({
          success: true,
          verification_triggered: true,
          status: statusData.status,
          records: statusData.records || [],
          raw_verify: verifyData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: register, get-records, verify" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
