/**
 * Affiliate Automation Engine
 * Autonomous system that:
 * 1. Discovers affiliate opportunities
 * 2. Generates content with affiliate links
 * 3. Tracks conversions and earnings
 * 4. Optimizes based on performance
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

// High-value affiliate programs to promote
const AFFILIATE_PROGRAMS_SEED = [
  {
    name: "Vercel",
    category: "cloud",
    base_url: "https://vercel.com",
    commission_type: "percentage",
    commission_value: 15, // 15% recurring
    cookie_days: 90,
    keywords: ["deployment", "hosting", "nextjs", "frontend", "serverless"],
  },
  {
    name: "Railway",
    category: "cloud",
    base_url: "https://railway.app",
    commission_type: "percentage",
    commission_value: 25,
    cookie_days: 60,
    keywords: ["backend", "database", "deployment", "docker", "postgres"],
  },
  {
    name: "Supabase",
    category: "api",
    base_url: "https://supabase.com",
    commission_type: "percentage",
    commission_value: 10,
    cookie_days: 30,
    keywords: ["database", "auth", "backend", "postgresql", "realtime"],
  },
  {
    name: "OpenAI API",
    category: "api",
    base_url: "https://platform.openai.com",
    commission_type: "fixed",
    commission_value: 5, // $5 per signup
    cookie_days: 30,
    keywords: ["ai", "gpt", "chatgpt", "machine learning", "nlp"],
  },
  {
    name: "DigitalOcean",
    category: "cloud",
    base_url: "https://www.digitalocean.com",
    commission_type: "fixed",
    commission_value: 100, // $100 per customer
    cookie_days: 90,
    keywords: ["vps", "cloud", "hosting", "kubernetes", "droplet"],
  },
  {
    name: "Cloudflare",
    category: "dev_tools",
    base_url: "https://www.cloudflare.com",
    commission_type: "percentage",
    commission_value: 15,
    cookie_days: 45,
    keywords: ["cdn", "security", "dns", "ddos", "workers"],
  },
  {
    name: "MongoDB Atlas",
    category: "api",
    base_url: "https://www.mongodb.com/atlas",
    commission_type: "percentage",
    commission_value: 10,
    cookie_days: 30,
    keywords: ["database", "nosql", "mongodb", "atlas", "cloud database"],
  },
  {
    name: "Stripe",
    category: "api",
    base_url: "https://stripe.com",
    commission_type: "fixed",
    commission_value: 50,
    cookie_days: 60,
    keywords: ["payments", "billing", "subscription", "checkout", "fintech"],
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminToken = mustEnv("ADMIN_API_TOKEN");
    const authHeader = req.headers.get("authorization") || "";
    
    if (!authHeader.includes(adminToken)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      mustEnv("SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action || "full_cycle";

    console.log(`💰 Affiliate Automation Engine: ${action}`);

    const results: Record<string, unknown> = {
      action,
      timestamp: new Date().toISOString(),
    };

    // 1. Seed affiliate programs if empty
    if (action === "full_cycle" || action === "seed_programs") {
      const { count } = await supabase
        .from("affiliate_programs")
        .select("*", { count: "exact", head: true });

      if (count === 0) {
        console.log("📥 Seeding affiliate programs...");
        
        for (const program of AFFILIATE_PROGRAMS_SEED) {
          await supabase.from("affiliate_programs").insert({
            name: program.name,
            category: program.category,
            base_url: program.base_url,
            commission_type: program.commission_type,
            commission_value: program.commission_value,
            cookie_days: program.cookie_days,
            notes: `Keywords: ${program.keywords.join(", ")}`,
          });
        }

        results.programs_seeded = AFFILIATE_PROGRAMS_SEED.length;
      }
    }

    // 2. Scan demand signals for affiliate opportunities
    if (action === "full_cycle" || action === "match_signals") {
      const { data: programs } = await supabase
        .from("affiliate_programs")
        .select("*")
        .eq("is_active", true);

      const { data: signals } = await supabase
        .from("demand_signals")
        .select("*")
        .eq("status", "new")
        .limit(50);

      if (programs && signals) {
        const matches: { signal_id: string; program_name: string }[] = [];

        for (const signal of signals) {
          const queryLower = signal.query_text.toLowerCase();
          
          for (const program of programs) {
            const keywords = (program.notes || "").toLowerCase().split(",").map((k: string) => k.trim());
            const hasMatch = keywords.some((kw: string) => queryLower.includes(kw));

            if (hasMatch) {
              // Generate affiliate content for this match
              const content = await generateAffiliateContent(program, signal);
              
              await supabase.from("affiliate_content").insert({
                program_id: program.id,
                headline: content.headline,
                body: content.body,
                cta_text: content.cta,
                affiliate_link: program.base_url + (program.affiliate_link_template || ""),
                platform: content.platform,
                target_keywords: keywords,
                status: "queued",
              });

              matches.push({ signal_id: signal.id, program_name: program.name });
              break; // One program per signal
            }
          }
        }

        results.affiliate_matches = matches.length;
      }
    }

    // 3. Publish queued affiliate content
    if (action === "full_cycle" || action === "publish_content") {
      const { data: queuedContent } = await supabase
        .from("affiliate_content")
        .select("*, affiliate_programs(*)")
        .eq("status", "queued")
        .limit(10);

      if (queuedContent && queuedContent.length > 0) {
        const published: string[] = [];

        for (const content of queuedContent) {
          // Add to outreach queue for distribution
          await supabase.from("outreach_jobs").insert({
            source: "affiliate_engine",
            intent_topic: content.headline,
            confidence: 0.9,
            lead_payload: { 
              affiliate_content_id: content.id,
              program_id: content.program_id,
            },
            draft_text: `${content.body}\n\n${content.cta_text}: ${content.affiliate_link}`,
            channel: "telegram",
            destination: "telegram",
            status: "queued",
          });

          // Also add to content queue for broader distribution
          await supabase.from("content_queue").insert({
            content_type: "affiliate",
            platform: content.platform,
            title: content.headline,
            body: `${content.body}\n\n${content.cta_text}: ${content.affiliate_link}`,
            cta: content.affiliate_link,
            product: `affiliate_${content.affiliate_programs.name}`,
            status: "ready",
          });

          // Mark as published
          await supabase
            .from("affiliate_content")
            .update({ status: "published", published_at: new Date().toISOString() })
            .eq("id", content.id);

          published.push(content.affiliate_programs.name);
        }

        results.content_published = published;
      }
    }

    // 4. Calculate earnings summary
    if (action === "full_cycle" || action === "calculate_earnings") {
      const { data: earnings } = await supabase
        .from("affiliate_earnings")
        .select("amount_usd, status")
        .gte("earned_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (earnings) {
        const pending = earnings.filter(e => e.status === "pending").reduce((s, e) => s + e.amount_usd, 0);
        const approved = earnings.filter(e => e.status === "approved").reduce((s, e) => s + e.amount_usd, 0);
        const paid = earnings.filter(e => e.status === "paid").reduce((s, e) => s + e.amount_usd, 0);

        results.earnings_30d = { pending, approved, paid, total: pending + approved + paid };
      }

      // Count clicks
      const { count: clickCount } = await supabase
        .from("affiliate_clicks")
        .select("*", { count: "exact", head: true })
        .gte("clicked_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      results.clicks_30d = clickCount || 0;
    }

    // 5. Optimize based on performance
    if (action === "full_cycle" || action === "optimize") {
      // Find top performing programs
      const { data: topContent } = await supabase
        .from("affiliate_content")
        .select("*, affiliate_programs(*)")
        .gt("earnings_usd", 0)
        .order("earnings_usd", { ascending: false })
        .limit(5);

      if (topContent && topContent.length > 0) {
        results.top_performers = topContent.map(c => ({
          program: c.affiliate_programs.name,
          earnings: c.earnings_usd,
          clicks: c.clicks,
        }));

        // Double down on top performers - generate more content
        for (const content of topContent.slice(0, 2)) {
          const newContent = await generateAffiliateContent(
            content.affiliate_programs,
            { query_text: "variation content" }
          );

          await supabase.from("affiliate_content").insert({
            program_id: content.program_id,
            headline: newContent.headline,
            body: newContent.body,
            cta_text: newContent.cta,
            affiliate_link: content.affiliate_link,
            platform: newContent.platform,
            target_keywords: content.target_keywords,
            status: "queued",
          });
        }
      }
    }

    // Send daily summary
    await sendTelegramSummary(results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Affiliate Automation Engine error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateAffiliateContent(program: any, signal: any): Promise<{
  headline: string;
  body: string;
  cta: string;
  platform: string;
}> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  const platforms = ["reddit", "twitter", "hackernews", "telegram"];
  const platform = platforms[Math.floor(Math.random() * platforms.length)];

  if (!LOVABLE_API_KEY) {
    // Fallback without AI
    return {
      headline: `🚀 ${program.name} - The Best ${program.category} Solution`,
      body: `Looking for a reliable ${program.category} service? ${program.name} is trusted by thousands of developers.\n\n✅ Easy setup\n✅ Great documentation\n✅ Excellent support`,
      cta: `Try ${program.name} free →`,
      platform,
    };
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert affiliate marketer. Create compelling, authentic content that provides value while naturally recommending products. Never be spammy. Focus on solving real problems.`,
          },
          {
            role: "user",
            content: `Create affiliate content for ${program.name} (${program.category}).

Context from user signal: "${signal.query_text}"

Requirements:
- Platform: ${platform}
- Tone: Helpful, technical, authentic
- Focus: Solving the user's problem
- Subtle CTA at the end

Return JSON: { "headline": "...", "body": "...", "cta": "..." }`,
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    try {
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
      return { ...parsed, platform };
    } catch {
      return {
        headline: `🚀 ${program.name} - Recommended`,
        body: content.slice(0, 500),
        cta: `Try ${program.name} →`,
        platform,
      };
    }
  } catch (e) {
    console.error("AI content generation error:", e);
    return {
      headline: `🚀 ${program.name} - The Best ${program.category} Solution`,
      body: `${program.name} is a top choice for ${program.category}. Highly recommended!`,
      cta: `Check out ${program.name} →`,
      platform,
    };
  }
}

async function sendTelegramSummary(results: Record<string, unknown>): Promise<void> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  
  if (!botToken || !chatId) return;

  const earnings = results.earnings_30d as { total: number } | undefined;
  
  const message = `💰 <b>Affiliate Engine Report</b>

Matches Found: ${results.affiliate_matches || 0}
Content Published: ${(results.content_published as string[] || []).length}
Clicks (30d): ${results.clicks_30d || 0}
Earnings (30d): $${earnings?.total?.toFixed(2) || "0.00"}

Top Performers:
${(results.top_performers as any[] || []).map((p, i) => `${i + 1}. ${p.program}: $${p.earnings}`).join("\n") || "No data yet"}

Time: ${new Date().toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem" })}`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    }),
  }).catch(console.error);
}
