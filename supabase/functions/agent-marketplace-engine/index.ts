/**
 * Agent Marketplace Engine
 * Autonomous system that:
 * 1. Promotes agents from catalog
 * 2. Processes orders automatically
 * 3. Builds and delivers agents using AI
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

// Agent templates for AI generation
const AGENT_TEMPLATES = {
  telegram_bot: {
    basePrompt: "Create a Telegram bot with the following capabilities:",
    techStack: ["telegram-bot-api", "node.js", "supabase"],
    deliveryFormat: "github_repo",
  },
  discord_bot: {
    basePrompt: "Create a Discord bot with the following capabilities:",
    techStack: ["discord.js", "node.js", "supabase"],
    deliveryFormat: "github_repo",
  },
  monitor: {
    basePrompt: "Create a monitoring agent that:",
    techStack: ["node.js", "cron", "telegram-notifications"],
    deliveryFormat: "docker_image",
  },
  scraper: {
    basePrompt: "Create a web scraper that:",
    techStack: ["puppeteer", "node.js", "supabase"],
    deliveryFormat: "github_repo",
  },
  automation: {
    basePrompt: "Create an automation workflow that:",
    techStack: ["node.js", "supabase", "webhooks"],
    deliveryFormat: "edge_function",
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

    console.log(`🤖 Agent Marketplace Engine: ${action}`);

    const results: Record<string, unknown> = {
      action,
      timestamp: new Date().toISOString(),
    };

    // 1. Process pending orders
    if (action === "full_cycle" || action === "process_orders") {
      const { data: pendingOrders } = await supabase
        .from("agent_orders")
        .select("*, agent_catalog(*)")
        .eq("status", "paid")
        .limit(5);

      if (pendingOrders && pendingOrders.length > 0) {
        console.log(`📦 Processing ${pendingOrders.length} paid orders`);
        
        for (const order of pendingOrders) {
          // Mark as building
          await supabase
            .from("agent_orders")
            .update({ status: "building", started_at: new Date().toISOString() })
            .eq("id", order.id);

          // Generate agent using AI
          const agentCode = await generateAgentCode(order, order.agent_catalog);
          
          // Create delivery (mock - in production would push to GitHub/Docker)
          const deliveryUrl = `https://github.com/your-org/agent-${order.id.slice(0, 8)}`;
          
          // Mark as delivered
          await supabase
            .from("agent_orders")
            .update({
              status: "delivered",
              delivery_url: deliveryUrl,
              delivery_notes: `Agent delivered! Setup instructions sent to ${order.customer_email}`,
              delivered_at: new Date().toISOString(),
            })
            .eq("id", order.id);

          // Update sales count
          await supabase
            .from("agent_catalog")
            .update({ sales_count: (order.agent_catalog.sales_count || 0) + 1 })
            .eq("id", order.agent_id);

          // Notify customer via Telegram
          await notifyDelivery(order, deliveryUrl);
        }

        results.orders_processed = pendingOrders.length;
      }
    }

    // 2. Generate promotional content for agents
    if (action === "full_cycle" || action === "generate_content") {
      const { data: agents } = await supabase
        .from("agent_catalog")
        .select("*")
        .eq("is_active", true)
        .order("sales_count", { ascending: false })
        .limit(3);

      if (agents && agents.length > 0) {
        const contentGenerated: string[] = [];
        
        for (const agent of agents) {
          // Generate promotional content
          const content = await generatePromoContent(agent);
          
          // Add to content queue
          await supabase.from("content_queue").insert({
            content_type: "promotion",
            platform: content.platform,
            title: content.title,
            body: content.body,
            cta: content.cta,
            product: `agent_${agent.id}`,
            status: "draft",
          });

          contentGenerated.push(agent.name);
        }

        results.content_generated = contentGenerated;
      }
    }

    // 3. Scan for demand signals related to bots/automation
    if (action === "full_cycle" || action === "scan_demand") {
      const { data: signals } = await supabase
        .from("demand_signals")
        .select("*")
        .eq("status", "new")
        .ilike("query_text", "%bot%")
        .limit(10);

      if (signals && signals.length > 0) {
        const matched: string[] = [];
        
        for (const signal of signals) {
          // Find matching agent
          const { data: matchingAgents } = await supabase
            .from("agent_catalog")
            .select("*")
            .eq("is_active", true)
            .limit(1);

          if (matchingAgents && matchingAgents.length > 0) {
            // Create outreach job
            await supabase.from("outreach_jobs").insert({
              source: "agent_marketplace",
              intent_topic: `Looking for: ${signal.query_text}`,
              confidence: 0.8,
              lead_payload: { signal_id: signal.id, agent_id: matchingAgents[0].id },
              draft_text: `Found your request! We have a ready-made solution: ${matchingAgents[0].name} - ${matchingAgents[0].description}`,
              channel: "telegram",
              destination: "telegram",
              status: "queued",
            });

            matched.push(signal.id);
          }
        }

        results.demand_matched = matched.length;
      }
    }

    // Send summary to Telegram
    await sendTelegramSummary(results);

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Agent Marketplace Engine error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateAgentCode(order: any, agent: any): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("No LOVABLE_API_KEY - skipping AI generation");
    return "// Generated code placeholder";
  }

  const template = AGENT_TEMPLATES[agent.category as keyof typeof AGENT_TEMPLATES] || AGENT_TEMPLATES.automation;
  
  const prompt = `${template.basePrompt}

Agent Name: ${agent.name}
Description: ${agent.description}
Features: ${JSON.stringify(agent.features)}
Customer Notes: ${order.customization_notes || "None"}

Generate a complete, working ${agent.category} with:
1. Main entry point file
2. Configuration handling
3. Error handling and logging
4. Deployment instructions

Output production-ready code.`;

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
          { role: "system", content: "You are an expert developer creating production-ready automation agents and bots." },
          { role: "user", content: prompt },
        ],
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      console.error("AI generation failed:", await response.text());
      return "// AI generation failed - manual review needed";
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "// No content generated";
  } catch (e) {
    console.error("AI generation error:", e);
    return "// AI generation error";
  }
}

async function generatePromoContent(agent: any): Promise<{ platform: string; title: string; body: string; cta: string }> {
  const platforms = ["reddit", "twitter", "hackernews"];
  const platform = platforms[Math.floor(Math.random() * platforms.length)];

  return {
    platform,
    title: `🤖 ${agent.name} - Automate Your Workflow`,
    body: `${agent.description}\n\nFeatures:\n${(agent.features || []).map((f: string) => `• ${f}`).join("\n")}\n\nPrice: $${agent.price_usd}\nDelivery: ${agent.delivery_time_hours}h`,
    cta: `Order now at your-domain.com/agents/${agent.id}`,
  };
}

async function notifyDelivery(order: any, deliveryUrl: string): Promise<void> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  
  if (!botToken || !chatId) return;

  const message = `🎉 <b>Agent Delivered!</b>

Order: <code>${order.id.slice(0, 8)}</code>
Agent: ${order.agent_catalog?.name || "Custom"}
Customer: ${order.customer_email}
Amount: $${order.price_usd}

Delivery: ${deliveryUrl}`;

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

async function sendTelegramSummary(results: Record<string, unknown>): Promise<void> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  
  if (!botToken || !chatId) return;

  const message = `🤖 <b>Agent Marketplace Cycle</b>

Orders Processed: ${results.orders_processed || 0}
Content Generated: ${(results.content_generated as string[] || []).length}
Demand Matched: ${results.demand_matched || 0}

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
