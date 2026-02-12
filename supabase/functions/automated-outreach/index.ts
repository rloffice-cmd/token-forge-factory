/**
 * Automated Outreach V2 — Smart Personalization + Spam Protection
 * 
 * Features:
 * 1. AI-generated custom opening sentence per lead
 * 2. Random 60-300s delay between sends (human-like)
 * 3. Link cloaking via internal redirect (truthtoken.io/go/[slug])
 * 4. Mandatory unsubscribe link + blacklist enforcement
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PARTNER_MAPPING: Record<string, { slug: string; category: string }> = {
  "adturbo ai":      { slug: "adturbo",        category: "Marketing / Ad Optimization" },
  "lucro crm":       { slug: "lucro",           category: "CRM / Sales Pipeline" },
  "emaillistverify": { slug: "emaillistverify",  category: "Contact Validation" },
  "easyfund":        { slug: "easyfund",         category: "Fundraising / Non-profit" },
};

function mustEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/** Random delay between 60-300 seconds */
function randomDelay(): number {
  return Math.floor(Math.random() * (300 - 60 + 1)) + 60;
}

/** Generate AI-personalized opening sentence */
async function generatePersonalizedOpening(
  leadName: string,
  intentTopic: string,
  partnerName: string,
  category: string,
  lovableApiKey: string,
): Promise<string> {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You write hyper-personalized email opening sentences. One sentence only, max 25 words. Sound like a knowledgeable peer, NOT a marketer. Reference the lead's specific pain or industry. Never mention AI, automation, or affiliates.`,
          },
          {
            role: "user",
            content: `Lead name: ${leadName || "there"}. Their intent: "${intentTopic}". Category: ${category}. Partner solution: ${partnerName}. Write ONE personalized opening sentence.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn("AI personalization failed, using fallback");
      return "";
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch (e) {
    console.warn("AI opening generation error:", e);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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
    const lovableApiKey = mustEnv("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const {
      lead_email,
      lead_name,
      lead_id,
      partner_name,
      intent_topic,
      subject,
      email_body,
      affiliate_url,
      batch_mode = false,
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

    // ========== BLACKLIST CHECK ==========
    const { data: blacklisted } = await supabase
      .from("denylist")
      .select("id")
      .eq("type", "email")
      .eq("value", lead_email.toLowerCase())
      .eq("active", true)
      .maybeSingle();

    if (blacklisted) {
      console.log(`🚫 Email ${lead_email} is blacklisted, skipping`);
      return new Response(
        JSON.stringify({ ok: false, skipped: true, reason: "blacklisted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ========== HUMAN-LIKE DELAY (batch mode) ==========
    if (batch_mode) {
      const delaySec = randomDelay();
      console.log(`⏳ Human-like delay: waiting ${delaySec}s before sending to ${lead_email}`);
      await new Promise(resolve => setTimeout(resolve, delaySec * 1000));
    }

    // ========== LINK CLOAKING ==========
    const cloakedLink = `https://truthtoken.io/go/${partnerInfo.slug}/${lead_id || "direct"}?src=email`;
    const trackedLink = cloakedLink;

    // ========== UNSUBSCRIBE LINK ==========
    const unsubscribeLink = `${supabaseUrl}/functions/v1/email-unsubscribe?email=${encodeURIComponent(lead_email)}&token=${encodeURIComponent(btoa(lead_email))}`;

    // ========== AI PERSONALIZATION ==========
    const personalizedOpening = await generatePersonalizedOpening(
      lead_name || "there",
      intent_topic || partnerInfo.category,
      partner_name,
      partnerInfo.category,
      lovableApiKey,
    );

    // ========== BUILD EMAIL ==========
    const fromAddress = "outreach@truthtoken.io";
    const finalSubject = subject || `Quick insight for your ${partnerInfo.category} workflow`;
    const finalBody = email_body
      ? injectUnsubscribe(email_body, unsubscribeLink)
      : buildSmartEmail(lead_name || "there", partnerInfo.category, partner_name, trackedLink, unsubscribeLink, personalizedOpening);

    // ========== SEND VIA RESEND ==========
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
        headers: {
          "List-Unsubscribe": `<${unsubscribeLink}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      await supabase.from("outreach_jobs").insert({
        source: "automated-outreach",
        intent_topic: intent_topic || partnerInfo.category,
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

    console.log(`✅ Email sent to ${lead_email} for ${partner_name} (Resend: ${resendData.id})`);

    // Log success
    await supabase.from("outreach_jobs").insert({
      source: "automated-outreach",
      intent_topic: intent_topic || partnerInfo.category,
      channel: "email",
      destination: lead_email,
      status: "sent",
      confidence: 1,
      lead_payload: { lead_email, lead_name, lead_id, partner_name, personalized: !!personalizedOpening },
      provider_response: { resend_id: resendData.id, sent_at: new Date().toISOString(), cloaked_link: trackedLink },
    }).catch(() => {});

    // Telegram notification
    try {
      await supabase.functions.invoke("telegram-notify", {
        body: {
          message: [
            `📧 <b>Email Sent via Resend</b>`,
            ``,
            `<b>To:</b> ${lead_email}`,
            `<b>Partner:</b> ${partner_name}`,
            `<b>Category:</b> ${partnerInfo.category}`,
            `<b>Personalized:</b> ${personalizedOpening ? "✅ Yes" : "❌ Fallback"}`,
            `<b>Cloaked Link:</b> ${trackedLink}`,
            `<b>Resend ID:</b> <code>${resendData.id}</code>`,
          ].join("\n"),
          type: "email_sent",
        },
      });
    } catch (tgErr) {
      console.warn("Telegram notify failed:", tgErr);
    }

    return new Response(
      JSON.stringify({ ok: true, resend_id: resendData.id, partner: partner_name, to: lead_email, personalized: !!personalizedOpening }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("automated-outreach error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function buildSmartEmail(name: string, category: string, partner: string, link: string, unsubLink: string, personalizedOpening: string): string {
  const opening = personalizedOpening || `I noticed you're tackling <strong>${category.toLowerCase()}</strong> challenges — something I've been researching closely.`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e; line-height: 1.6;">
  <p>Hey ${name},</p>
  <p>${opening}</p>
  <p><strong>${partner}</strong> has been getting great results for teams in similar situations — particularly with automation and reducing manual overhead.</p>
  <p style="margin: 24px 0;">
    <a href="${link}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Check it out →</a>
  </p>
  <p style="font-size: 13px; color: #666;">No pressure — just thought it was worth sharing based on what I've seen work for others.</p>
  <p>Best,<br/>TruthToken Insights</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
  <p style="font-size: 11px; color: #999; text-align: center;">
    Don't want to hear from us? <a href="${unsubLink}" style="color: #999; text-decoration: underline;">Unsubscribe</a>
  </p>
</body>
</html>`;
}

function injectUnsubscribe(html: string, unsubLink: string): string {
  const footer = `<hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px;"/><p style="font-size:11px;color:#999;text-align:center;">Don't want to hear from us? <a href="${unsubLink}" style="color:#999;text-decoration:underline;">Unsubscribe</a></p>`;
  if (html.includes("</body>")) {
    return html.replace("</body>", `${footer}</body>`);
  }
  return html + footer;
}
