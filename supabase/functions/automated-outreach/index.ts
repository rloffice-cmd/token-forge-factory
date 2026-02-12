/**
 * Automated Outreach — Resend Email Sender
 * 
 * When a lead matches one of our 4 partners (AdTurbo, Lucro CRM,
 * EmailListVerify, EasyFund), sends a personalized email via Resend
 * with tracked affiliate links and notifies Telegram.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PARTNER_MAPPING: Record<string, { slug: string; category: string }> = {
  "adturbo ai":      { slug: "adturbo",       category: "Marketing / Ad Optimization" },
  "lucro crm":       { slug: "lucro",          category: "CRM / Sales Pipeline" },
  "emaillistverify": { slug: "emaillistverify", category: "Contact Validation" },
  "easyfund":        { slug: "easyfund",        category: "Fundraising / Non-profit" },
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
    const cronSecret = Deno.env.get("CRON_SECRET") || "";
    const authHeader = req.headers.get("authorization") || "";
    const cronHeader = req.headers.get("x-cron-secret") || "";

    if (!(adminToken && authHeader.includes(adminToken)) && !(cronSecret && cronHeader === cronSecret)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = mustEnv("RESEND_API_KEY");
    const supabaseUrl = mustEnv("SUPABASE_URL");
    const supabaseKey = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      lead_email,
      lead_name,
      lead_id,
      partner_name,
      subject,
      email_body,
      affiliate_url,
    } = body;

    if (!lead_email || !partner_name) {
      return new Response(JSON.stringify({ error: "lead_email and partner_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const partnerKey = partner_name.toLowerCase();
    const partnerInfo = PARTNER_MAPPING[partnerKey];
    if (!partnerInfo) {
      return new Response(JSON.stringify({ error: `Unknown partner: ${partner_name}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build tracked affiliate link
    const trackedLink = affiliate_url ||
      `${supabaseUrl}/functions/v1/affiliate-click-tracker?p=${partnerInfo.slug}&s=email&c=${lead_id || "direct"}`;

    // Build email
    const fromAddress = "outreach@truthtoken.io";
    const finalSubject = subject || `Quick insight for your ${partnerInfo.category} workflow`;
    const finalBody = email_body || buildDefaultEmail(lead_name || "there", partnerInfo.category, partner_name, trackedLink);

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `TruthToken Insights <${fromAddress}>`,
        to: [lead_email],
        subject: finalSubject,
        html: finalBody,
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      // Log failure
      await supabase.from("outreach_jobs").insert({
        source: "automated-outreach",
        intent_topic: partnerInfo.category,
        channel: "email",
        destination: lead_email,
        status: "failed",
        gate_fail_reason: `resend_error:${resendData?.message || resendRes.status}`,
        lead_payload: { lead_email, lead_name, lead_id, partner_name },
      }).catch(() => {});

      return new Response(JSON.stringify({ ok: false, error: resendData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`✅ Email sent to ${lead_email} for partner ${partner_name} (Resend ID: ${resendData.id})`);

    // Log success to outreach_jobs
    await supabase.from("outreach_jobs").insert({
      source: "automated-outreach",
      intent_topic: partnerInfo.category,
      channel: "email",
      destination: lead_email,
      status: "sent",
      confidence: 1,
      lead_payload: { lead_email, lead_name, lead_id, partner_name },
      provider_response: { resend_id: resendData.id, sent_at: new Date().toISOString() },
    }).catch(() => {});

    // Notify Telegram
    try {
      await supabase.functions.invoke("telegram-notify", {
        body: {
          message: [
            `📧 <b>Email Sent via Resend</b>`,
            ``,
            `<b>To:</b> ${lead_email}`,
            `<b>Partner:</b> ${partner_name}`,
            `<b>Category:</b> ${partnerInfo.category}`,
            `<b>Resend ID:</b> <code>${resendData.id}</code>`,
            `<b>Tracked Link:</b> ${trackedLink}`,
          ].join("\n"),
          type: "email_sent",
        },
      });
    } catch (tgErr) {
      console.warn("Telegram notify failed:", tgErr);
    }

    return new Response(
      JSON.stringify({ ok: true, resend_id: resendData.id, partner: partner_name, to: lead_email }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("automated-outreach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildDefaultEmail(name: string, category: string, partner: string, link: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;">
  <p>Hey ${name},</p>
  <p>I came across your recent activity and noticed you're working on <strong>${category.toLowerCase()}</strong> challenges. I've been researching tools in this space and wanted to share something that might help.</p>
  <p><strong>${partner}</strong> has been getting great results for teams in similar situations — particularly with automation and reducing manual work.</p>
  <p style="margin: 24px 0;">
    <a href="${link}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Check it out →</a>
  </p>
  <p style="font-size: 13px; color: #666;">No pressure — just thought it was worth sharing based on what I've seen work for others.</p>
  <p>Best,<br/>TruthToken Insights</p>
</body>
</html>`;
}
