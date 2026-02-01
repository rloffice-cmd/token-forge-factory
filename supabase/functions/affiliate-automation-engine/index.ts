/**
 * Affiliate Automation Engine v2
 * Autonomous system that:
 * 1. Discovers affiliate opportunities from demand signals
 * 2. Generates AI content with affiliate links
 * 3. Distributes across multiple channels
 * 4. Tracks conversions and optimizes
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

// Content templates for different platforms
const CONTENT_TEMPLATES = {
  reddit: {
    formats: [
      "I've been using {product} for {use_case} and it's been a game changer. {benefit}. Link in bio.",
      "PSA: If you're struggling with {problem}, check out {product}. {feature} makes it worth it.",
      "After trying 5+ alternatives, {product} is the only one that {solved_problem}. Highly recommend.",
    ],
  },
  twitter: {
    formats: [
      "🚀 {product} just saved me {time_saved} on {task}. If you're building {project_type}, this is a must.\n\n{link}",
      "Hot take: {product} > {competitor} for {use_case}. Here's why:\n\n✅ {benefit1}\n✅ {benefit2}\n✅ {benefit3}\n\n{link}",
      "The best ${price} I've spent this month: {product}\n\n{one_liner}\n\n{link}",
    ],
  },
  hackernews: {
    formats: [
      "Show HN: I built {project} using {product} and it handles {scale} with zero issues",
      "Ask HN: Anyone else using {product} for {use_case}? Curious about your experience",
    ],
  },
  telegram: {
    formats: [
      "💡 <b>Pro Tip:</b> {product} for {use_case}\n\n{description}\n\n👉 {link}",
      "🔥 <b>Tool of the Day:</b> {product}\n\n{feature1}\n{feature2}\n{feature3}\n\n{link}",
    ],
  },
};

// Product-specific selling points
const PRODUCT_CONTEXT: Record<string, {
  use_cases: string[];
  benefits: string[];
  problems_solved: string[];
  competitors: string[];
}> = {
  "Vercel": {
    use_cases: ["frontend deployment", "Next.js hosting", "serverless functions"],
    benefits: ["zero-config deploys", "instant rollbacks", "edge network"],
    problems_solved: ["slow deploys", "complex CI/CD", "poor performance"],
    competitors: ["Netlify", "AWS Amplify", "Railway"],
  },
  "DigitalOcean": {
    use_cases: ["VPS hosting", "Kubernetes", "managed databases"],
    benefits: ["predictable pricing", "great docs", "simple interface"],
    problems_solved: ["AWS complexity", "unexpected bills", "poor support"],
    competitors: ["AWS", "Linode", "Vultr"],
  },
  "Supabase": {
    use_cases: ["backend-as-a-service", "auth", "realtime databases"],
    benefits: ["Firebase alternative", "PostgreSQL power", "generous free tier"],
    problems_solved: ["vendor lock-in", "complex backend setup", "scaling auth"],
    competitors: ["Firebase", "AWS Amplify", "PlanetScale"],
  },
  "Railway": {
    use_cases: ["backend deployment", "database hosting", "Docker apps"],
    benefits: ["one-click deploys", "auto-scaling", "integrated postgres"],
    problems_solved: ["DevOps overhead", "complex infra", "cold starts"],
    competitors: ["Heroku", "Render", "Fly.io"],
  },
  "Cloudflare": {
    use_cases: ["CDN", "DDoS protection", "edge computing"],
    benefits: ["global network", "free SSL", "Workers platform"],
    problems_solved: ["slow load times", "security threats", "expensive bandwidth"],
    competitors: ["Fastly", "AWS CloudFront", "Akamai"],
  },
  "Stripe": {
    use_cases: ["payment processing", "subscriptions", "invoicing"],
    benefits: ["developer-friendly API", "global payments", "fraud protection"],
    problems_solved: ["payment complexity", "compliance headaches", "chargeback management"],
    competitors: ["PayPal", "Square", "Braintree"],
  },
  "MongoDB Atlas": {
    use_cases: ["document database", "cloud database", "analytics"],
    benefits: ["flexible schema", "global clusters", "serverless options"],
    problems_solved: ["schema migrations", "scaling issues", "complex queries"],
    competitors: ["PostgreSQL", "DynamoDB", "CouchDB"],
  },
  "OpenAI API": {
    use_cases: ["AI integration", "chatbots", "content generation"],
    benefits: ["state-of-the-art models", "simple API", "fine-tuning"],
    problems_solved: ["building ML from scratch", "training costs", "model deployment"],
    competitors: ["Anthropic", "Google AI", "Cohere"],
  },
  "AWS": {
    use_cases: ["cloud infrastructure", "enterprise hosting", "serverless"],
    benefits: ["comprehensive services", "global reach", "enterprise-grade"],
    problems_solved: ["scalability limits", "on-prem costs", "global deployment"],
    competitors: ["Azure", "GCP", "DigitalOcean"],
  },
  "GitHub": {
    use_cases: ["version control", "CI/CD", "collaboration"],
    benefits: ["industry standard", "GitHub Actions", "Copilot integration"],
    problems_solved: ["code collaboration", "deployment automation", "code review"],
    competitors: ["GitLab", "Bitbucket", "Azure DevOps"],
  },
  "Notion": {
    use_cases: ["documentation", "project management", "knowledge base"],
    benefits: ["all-in-one workspace", "beautiful UI", "powerful databases"],
    problems_solved: ["scattered docs", "tool fatigue", "team alignment"],
    competitors: ["Confluence", "Coda", "Obsidian"],
  },
  "Linear": {
    use_cases: ["issue tracking", "project management", "sprint planning"],
    benefits: ["blazing fast UI", "keyboard-first", "GitHub integration"],
    problems_solved: ["slow Jira", "context switching", "overcomplicated PM"],
    competitors: ["Jira", "Asana", "Monday"],
  },
  "Render": {
    use_cases: ["web hosting", "background workers", "static sites"],
    benefits: ["Heroku alternative", "auto deploys", "private networking"],
    problems_solved: ["Heroku pricing", "complex setup", "poor DX"],
    competitors: ["Heroku", "Railway", "Fly.io"],
  },
  "PlanetScale": {
    use_cases: ["MySQL hosting", "database branching", "serverless DB"],
    benefits: ["Vitess-powered", "branch workflow", "zero-downtime schema"],
    problems_solved: ["schema migrations", "database scaling", "connection limits"],
    competitors: ["AWS RDS", "Supabase", "CockroachDB"],
  },
  "Resend": {
    use_cases: ["transactional email", "email API", "developer email"],
    benefits: ["React email", "simple API", "great deliverability"],
    problems_solved: ["email deliverability", "complex SMTP", "template management"],
    competitors: ["SendGrid", "Mailgun", "Postmark"],
  },
  "Figma": {
    use_cases: ["UI design", "prototyping", "design systems"],
    benefits: ["real-time collaboration", "browser-based", "dev mode"],
    problems_solved: ["design handoff", "version control", "team collaboration"],
    competitors: ["Sketch", "Adobe XD", "Framer"],
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Allow both authenticated and scheduled calls
    const adminToken = Deno.env.get("ADMIN_API_TOKEN");
    const authHeader = req.headers.get("authorization") || "";
    const isScheduled = authHeader.includes("Bearer ey"); // Supabase anon key for cron
    const isAdmin = adminToken && authHeader.includes(adminToken);
    
    // Accept cron jobs or admin calls
    if (!isScheduled && !isAdmin) {
      console.log("⚠️ Unauthorized call attempt");
    }

    const supabase = createClient(
      mustEnv("SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action || "full_cycle";

    console.log(`💰 Affiliate Automation Engine v2: ${action}`);

    const results: Record<string, unknown> = {
      action,
      timestamp: new Date().toISOString(),
    };

    // Get configured programs (with affiliate_id)
    const { data: programs } = await supabase
      .from("affiliate_programs")
      .select("*")
      .eq("is_active", true)
      .not("affiliate_id", "is", null);

    if (!programs || programs.length === 0) {
      console.log("⚠️ No configured affiliate programs found");
      results.warning = "No affiliate programs configured with affiliate_id";
      
      return new Response(
        JSON.stringify({ success: true, ...results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    results.configured_programs = programs.length;

    // 1. Scan for opportunities
    if (action === "full_cycle" || action === "scan") {
      const { data: signals } = await supabase
        .from("demand_signals")
        .select("*")
        .eq("status", "new")
        .order("relevance_score", { ascending: false })
        .limit(30);

      const { data: leads } = await supabase
        .from("leads")
        .select("*")
        .in("status", ["new", "contacted"])
        .order("intent_score", { ascending: false })
        .limit(30);

      const opportunities: { type: string; program: string; context: string }[] = [];

      // Match signals to programs
      for (const signal of signals || []) {
        const queryLower = (signal.query_text || "").toLowerCase();
        
        for (const program of programs) {
          const notes = (program.notes || "").toLowerCase();
          const keywords = notes.split("keywords:")[1]?.split("|")[0]?.split(",").map((k: string) => k.trim()) || [];
          
          if (keywords.some((kw: string) => queryLower.includes(kw))) {
            opportunities.push({
              type: "signal",
              program: program.name,
              context: signal.query_text.slice(0, 100),
            });
            break;
          }
        }
      }

      // Match leads to programs
      for (const lead of leads || []) {
        const contentLower = ((lead.content || "") + " " + (lead.title || "")).toLowerCase();
        
        for (const program of programs) {
          const notes = (program.notes || "").toLowerCase();
          const keywords = notes.split("keywords:")[1]?.split("|")[0]?.split(",").map((k: string) => k.trim()) || [];
          
          if (keywords.some((kw: string) => contentLower.includes(kw))) {
            opportunities.push({
              type: "lead",
              program: program.name,
              context: (lead.title || lead.content || "").slice(0, 100),
            });
            break;
          }
        }
      }

      results.opportunities_found = opportunities.length;
    }

    // 2. Generate content for each program
    if (action === "full_cycle" || action === "generate") {
      const contentGenerated: string[] = [];
      
      for (const program of programs.slice(0, 5)) { // Max 5 per cycle
        const context = PRODUCT_CONTEXT[program.name];
        if (!context) continue;

        // Check if we already have recent content for this program
        const { count: recentContent } = await supabase
          .from("affiliate_content")
          .select("*", { count: "exact", head: true })
          .eq("program_id", program.id)
          .eq("status", "queued")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if ((recentContent || 0) >= 3) {
          console.log(`Skipping ${program.name} - already has queued content`);
          continue;
        }

        // Generate content for random platform
        const platforms = Object.keys(CONTENT_TEMPLATES) as (keyof typeof CONTENT_TEMPLATES)[];
        const platform = platforms[Math.floor(Math.random() * platforms.length)];
        const templates = CONTENT_TEMPLATES[platform].formats;
        const template = templates[Math.floor(Math.random() * templates.length)];

        // Build the affiliate link
        let affiliateLink = program.affiliate_link_template || program.base_url;
        affiliateLink = affiliateLink.replace("{affiliate_id}", program.affiliate_id || "");

        // Generate content using AI or template
        const content = await generateContent(program, context, platform, affiliateLink);

        if (content) {
          await supabase.from("affiliate_content").insert({
            program_id: program.id,
            headline: content.headline,
            body: content.body,
            cta_text: content.cta,
            affiliate_link: affiliateLink,
            platform,
            target_keywords: context.use_cases,
            status: "queued",
          });

          contentGenerated.push(`${program.name} (${platform})`);
        }
      }

      results.content_generated = contentGenerated;
    }

    // 3. Publish queued content
    if (action === "full_cycle" || action === "publish") {
      const { data: queuedContent } = await supabase
        .from("affiliate_content")
        .select("*, affiliate_programs(*)")
        .eq("status", "queued")
        .limit(10);

      const published: string[] = [];

      for (const content of queuedContent || []) {
        // Add to outreach queue
        await supabase.from("outreach_jobs").insert({
          source: "affiliate_engine",
          intent_topic: content.headline,
          confidence: 0.95,
          lead_payload: { 
            affiliate_content_id: content.id,
            program_id: content.program_id,
            platform: content.platform,
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
          .update({ 
            status: "published", 
            published_at: new Date().toISOString() 
          })
          .eq("id", content.id);

        published.push(content.affiliate_programs.name);
      }

      results.content_published = published;
    }

    // 4. Track performance and optimize
    if (action === "full_cycle" || action === "optimize") {
      // Get top performers
      const { data: topPerformers } = await supabase
        .from("affiliate_content")
        .select("*, affiliate_programs(*)")
        .gt("clicks", 0)
        .order("clicks", { ascending: false })
        .limit(5);

      if (topPerformers && topPerformers.length > 0) {
        results.top_performers = topPerformers.map(c => ({
          program: c.affiliate_programs.name,
          clicks: c.clicks,
          conversions: c.conversions,
          earnings: c.earnings_usd,
        }));

        // Double down on top performers - generate more variations
        const topProgram = topPerformers[0];
        if (topProgram.clicks >= 5) {
          console.log(`🔥 Generating more content for top performer: ${topProgram.affiliate_programs.name}`);
          
          const context = PRODUCT_CONTEXT[topProgram.affiliate_programs.name];
          if (context) {
            for (const platform of ["reddit", "twitter", "telegram"]) {
              const content = await generateContent(
                topProgram.affiliate_programs, 
                context, 
                platform as keyof typeof CONTENT_TEMPLATES,
                topProgram.affiliate_link
              );

              if (content) {
                await supabase.from("affiliate_content").insert({
                  program_id: topProgram.program_id,
                  headline: content.headline,
                  body: content.body,
                  cta_text: content.cta,
                  affiliate_link: topProgram.affiliate_link,
                  platform,
                  target_keywords: context.use_cases,
                  status: "queued",
                });
              }
            }
          }
        }
      }

      // Calculate earnings
      const { data: earnings } = await supabase
        .from("affiliate_earnings")
        .select("amount_usd, status")
        .gte("earned_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (earnings) {
        results.earnings_30d = {
          pending: earnings.filter(e => e.status === "pending").reduce((s, e) => s + e.amount_usd, 0),
          approved: earnings.filter(e => e.status === "approved").reduce((s, e) => s + e.amount_usd, 0),
          paid: earnings.filter(e => e.status === "paid").reduce((s, e) => s + e.amount_usd, 0),
        };
      }
    }

    // Send Telegram summary
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

async function generateContent(
  program: { name: string; base_url: string },
  context: { use_cases: string[]; benefits: string[]; problems_solved: string[]; competitors: string[] },
  platform: keyof typeof CONTENT_TEMPLATES,
  affiliateLink: string
): Promise<{ headline: string; body: string; cta: string } | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  const useCase = context.use_cases[Math.floor(Math.random() * context.use_cases.length)];
  const benefit = context.benefits[Math.floor(Math.random() * context.benefits.length)];
  const problem = context.problems_solved[Math.floor(Math.random() * context.problems_solved.length)];

  if (!LOVABLE_API_KEY) {
    // Fallback without AI - use templates
    const templates = CONTENT_TEMPLATES[platform].formats;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    const body = template
      .replace(/{product}/g, program.name)
      .replace(/{use_case}/g, useCase)
      .replace(/{benefit}/g, benefit)
      .replace(/{problem}/g, problem)
      .replace(/{link}/g, affiliateLink)
      .replace(/{feature}/g, benefit)
      .replace(/{solved_problem}/g, problem);

    return {
      headline: `🚀 ${program.name} for ${useCase}`,
      body,
      cta: `Try ${program.name} →`,
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
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert affiliate marketer who creates authentic, valuable content. 
Never be spammy. Focus on genuine value and solving problems.
Platform: ${platform}
Style: ${platform === "twitter" ? "concise with emojis" : platform === "reddit" ? "conversational and detailed" : platform === "hackernews" ? "technical and substantive" : "clear with formatting"}`,
          },
          {
            role: "user",
            content: `Create affiliate content for ${program.name}.

Product: ${program.name}
Use cases: ${context.use_cases.join(", ")}
Benefits: ${context.benefits.join(", ")}
Problems it solves: ${context.problems_solved.join(", ")}
Competitors it beats: ${context.competitors.join(", ")}

Create a ${platform} post that:
1. Provides genuine value or insight
2. Naturally mentions ${program.name}
3. Has a subtle CTA at the end
4. Feels authentic, not promotional

Return JSON only: { "headline": "...", "body": "...", "cta": "..." }`,
          },
        ],
        max_tokens: 400,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI response: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      headline: `🚀 ${program.name} for ${useCase}`,
      body: content.slice(0, 280),
      cta: `Check it out →`,
    };
  } catch (e) {
    console.error("AI generation error:", e);
    
    // Fallback to template
    return {
      headline: `💡 ${program.name} - ${benefit}`,
      body: `If you're looking for ${useCase}, ${program.name} is worth checking out. ${benefit} and it solves ${problem}.`,
      cta: `Learn more →`,
    };
  }
}

async function sendTelegramSummary(results: Record<string, unknown>): Promise<void> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  
  if (!botToken || !chatId) return;

  const earnings = results.earnings_30d as { pending?: number; approved?: number; paid?: number } | undefined;
  const generated = (results.content_generated as string[] || []).length;
  const published = (results.content_published as string[] || []).length;
  
  if (generated === 0 && published === 0) return; // Skip if nothing happened

  const message = `💰 <b>Affiliate Engine Report</b>

📝 Content Generated: ${generated}
📤 Content Published: ${published}
🎯 Programs Active: ${results.configured_programs || 0}

💵 Earnings (30d):
├ Pending: $${earnings?.pending?.toFixed(2) || "0.00"}
├ Approved: $${earnings?.approved?.toFixed(2) || "0.00"}
└ Paid: $${earnings?.paid?.toFixed(2) || "0.00"}

⏰ ${new Date().toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem" })}`;

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
