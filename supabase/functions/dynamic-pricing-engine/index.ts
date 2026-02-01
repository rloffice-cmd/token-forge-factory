/**
 * Dynamic Pricing Engine
 * AI-powered pricing optimization for all products and services
 * Analyzes conversion rates, demand signals, and market conditions
 * to automatically adjust prices for maximum revenue/volume
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

interface PricingRule {
  product_type: string;
  min_price_usd: number;
  max_price_usd: number;
  max_change_percent: number;
  optimization_goal: string;
}

interface Product {
  id: string;
  name: string;
  price_usd: number;
  type: string;
  metrics: {
    views?: number;
    conversions?: number;
    revenue?: number;
    conversionRate?: number;
  };
}

interface PriceRecommendation {
  product_id: string;
  product_name: string;
  product_type: string;
  current_price: number;
  recommended_price: number;
  change_percent: number;
  reason: string;
  confidence: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      mustEnv("SUPABASE_URL"),
      mustEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    const body = await req.json().catch(() => ({}));
    const action = body.action || "optimize";
    const dryRun = body.dry_run ?? true; // Default to dry run for safety

    console.log(`💰 Dynamic Pricing Engine: ${action} (dry_run: ${dryRun})`);

    const results: Record<string, unknown> = {
      action,
      dry_run: dryRun,
      timestamp: new Date().toISOString(),
    };

    // Fetch pricing rules
    const { data: rules } = await supabase
      .from("pricing_rules")
      .select("*")
      .eq("is_active", true);

    const rulesMap: Record<string, PricingRule> = {};
    (rules || []).forEach((r: PricingRule) => {
      rulesMap[r.product_type] = r;
    });

    // Gather all products with their metrics
    const products: Product[] = [];

    // 1. Credit Packs
    const { data: creditPacks } = await supabase
      .from("credit_packs")
      .select("*")
      .eq("is_active", true);

    for (const pack of creditPacks || []) {
      // Get conversion metrics for this pack
      const { count: views } = await supabase
        .from("closing_attempts")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const { data: payments } = await supabase
        .from("payments")
        .select("amount_usd")
        .eq("status", "confirmed")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const conversions = payments?.length || 0;
      const revenue = payments?.reduce((sum, p) => sum + (p.amount_usd || 0), 0) || 0;

      products.push({
        id: pack.id,
        name: pack.name,
        price_usd: pack.price_usd,
        type: "credit_pack",
        metrics: {
          views: views || 0,
          conversions,
          revenue,
          conversionRate: views ? (conversions / views) * 100 : 0,
        },
      });
    }

    // 2. Agent Catalog
    const { data: agents } = await supabase
      .from("agent_catalog")
      .select("*")
      .eq("is_active", true);

    for (const agent of agents || []) {
      const { data: orders } = await supabase
        .from("agent_orders")
        .select("*")
        .eq("agent_id", agent.id)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const paidOrders = orders?.filter(o => o.status === "paid" || o.status === "delivered") || [];

      products.push({
        id: agent.id,
        name: agent.name,
        price_usd: agent.price_usd,
        type: "agent",
        metrics: {
          views: orders?.length || 0,
          conversions: paidOrders.length,
          revenue: paidOrders.reduce((sum, o) => sum + (o.price_usd || 0), 0),
          conversionRate: orders?.length ? (paidOrders.length / orders.length) * 100 : 0,
        },
      });
    }

    // 3. Digital Products
    const { data: digitalProducts } = await supabase
      .from("digital_products")
      .select("*")
      .eq("is_active", true);

    for (const product of digitalProducts || []) {
      const { data: purchases } = await supabase
        .from("digital_purchases")
        .select("*")
        .eq("product_id", product.id)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      products.push({
        id: product.id,
        name: product.name,
        price_usd: product.price_usd,
        type: "digital_product",
        metrics: {
          views: product.sales_count || 0,
          conversions: purchases?.length || 0,
          revenue: (purchases?.length || 0) * product.price_usd,
          conversionRate: product.sales_count ? ((purchases?.length || 0) / product.sales_count) * 100 : 0,
        },
      });
    }

    // Get market signals
    const { data: demandSignals } = await supabase
      .from("demand_signals")
      .select("*")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const { data: recentLeads } = await supabase
      .from("leads")
      .select("intent_score, relevance_score")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const avgIntent = recentLeads?.length 
      ? recentLeads.reduce((sum, l) => sum + (l.intent_score || 0), 0) / recentLeads.length 
      : 50;

    const demandLevel = demandSignals?.length || 0;

    // Generate AI pricing recommendations
    const recommendations = await generatePricingRecommendations(
      products,
      rulesMap,
      { avgIntent, demandLevel, totalLeads: recentLeads?.length || 0 }
    );

    results.recommendations = recommendations;
    results.products_analyzed = products.length;

    // Apply recommendations if not dry run
    if (!dryRun && recommendations.length > 0) {
      const applied: string[] = [];

      for (const rec of recommendations) {
        // Validate against rules
        const rule = rulesMap[rec.product_type];
        if (!rule) continue;

        // Ensure within bounds
        const finalPrice = Math.max(
          rule.min_price_usd,
          Math.min(rule.max_price_usd, rec.recommended_price)
        );

        // Apply price change based on product type
        let updated = false;

        if (rec.product_type === "credit_pack") {
          const { error } = await supabase
            .from("credit_packs")
            .update({ price_usd: finalPrice })
            .eq("id", rec.product_id);
          updated = !error;
        } else if (rec.product_type === "agent") {
          const { error } = await supabase
            .from("agent_catalog")
            .update({ price_usd: finalPrice, updated_at: new Date().toISOString() })
            .eq("id", rec.product_id);
          updated = !error;
        } else if (rec.product_type === "digital_product") {
          const { error } = await supabase
            .from("digital_products")
            .update({ price_usd: finalPrice })
            .eq("id", rec.product_id);
          updated = !error;
        }

        if (updated) {
          // Log the change
          await supabase.from("pricing_history").insert({
            product_type: rec.product_type,
            product_id: rec.product_id,
            product_name: rec.product_name,
            old_price_usd: rec.current_price,
            new_price_usd: finalPrice,
            change_percent: rec.change_percent,
            reason: rec.reason,
            ai_confidence: rec.confidence,
            metrics_snapshot: products.find(p => p.id === rec.product_id)?.metrics || {},
          });

          applied.push(`${rec.product_name}: $${rec.current_price} → $${finalPrice}`);
        }
      }

      results.applied = applied;
      results.changes_made = applied.length;

      // Send Telegram notification if changes were made
      if (applied.length > 0) {
        await sendPricingNotification(applied);
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Dynamic Pricing Engine error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generatePricingRecommendations(
  products: Product[],
  rules: Record<string, PricingRule>,
  marketSignals: { avgIntent: number; demandLevel: number; totalLeads: number }
): Promise<PriceRecommendation[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.warn("No LOVABLE_API_KEY - using rule-based pricing");
    return generateRuleBasedRecommendations(products, rules, marketSignals);
  }

  const prompt = `You are an expert pricing strategist for a B2B SaaS/API business.

CURRENT PRODUCTS:
${JSON.stringify(products, null, 2)}

PRICING RULES:
${JSON.stringify(rules, null, 2)}

MARKET SIGNALS:
- Average Lead Intent Score: ${marketSignals.avgIntent.toFixed(1)}%
- Demand Signals (7 days): ${marketSignals.demandLevel}
- Total Leads (7 days): ${marketSignals.totalLeads}

OPTIMIZATION GOALS:
- credit_pack: Maximize revenue (balance price vs volume)
- agent: Maximize revenue (premium positioning)
- digital_product: Maximize volume (accessibility)
- micro_sensor: Maximize volume (low friction)

CONSTRAINTS:
- Max price change: as defined in rules
- Stay within min/max bounds
- Consider conversion rates and market demand
- If conversion rate is low (<2%) and demand is high, consider lowering price
- If conversion rate is good (>5%) and demand is high, consider raising price
- If no data, make conservative recommendations

Respond with a JSON array of price recommendations. Only include products that SHOULD change.
Each recommendation:
{
  "product_id": "uuid",
  "product_name": "name",
  "product_type": "type",
  "current_price": number,
  "recommended_price": number (rounded to .99 or .00),
  "change_percent": number,
  "reason": "brief explanation",
  "confidence": number (0-1)
}

If no changes are needed, return empty array [].
ONLY return valid JSON, no other text.`;

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
          { role: "system", content: "You are a pricing optimization AI. Respond only with valid JSON." },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("AI pricing failed:", await response.text());
      return generateRuleBasedRecommendations(products, rules, marketSignals);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn("No valid JSON in AI response");
      return generateRuleBasedRecommendations(products, rules, marketSignals);
    }

    const recommendations = JSON.parse(jsonMatch[0]) as PriceRecommendation[];
    
    // Validate recommendations
    return recommendations.filter(rec => {
      const rule = rules[rec.product_type];
      if (!rule) return false;
      if (Math.abs(rec.change_percent) > rule.max_change_percent) return false;
      if (rec.recommended_price < rule.min_price_usd || rec.recommended_price > rule.max_price_usd) return false;
      return true;
    });
  } catch (e) {
    console.error("AI pricing error:", e);
    return generateRuleBasedRecommendations(products, rules, marketSignals);
  }
}

function generateRuleBasedRecommendations(
  products: Product[],
  rules: Record<string, PricingRule>,
  marketSignals: { avgIntent: number; demandLevel: number; totalLeads: number }
): PriceRecommendation[] {
  const recommendations: PriceRecommendation[] = [];

  for (const product of products) {
    const rule = rules[product.type];
    if (!rule) continue;

    const { conversionRate = 0, views = 0 } = product.metrics;
    
    // Skip if not enough data
    if (views < 10) continue;

    let newPrice = product.price_usd;
    let reason = "";
    let confidence = 0.5;

    // Low conversion + high demand = lower price
    if (conversionRate < 2 && marketSignals.demandLevel > 50) {
      const decrease = Math.min(rule.max_change_percent, 10) / 100;
      newPrice = product.price_usd * (1 - decrease);
      reason = `Low conversion (${conversionRate.toFixed(1)}%) with high demand - testing lower price`;
      confidence = 0.6;
    }
    // High conversion + high intent = raise price
    else if (conversionRate > 5 && marketSignals.avgIntent > 60) {
      const increase = Math.min(rule.max_change_percent, 10) / 100;
      newPrice = product.price_usd * (1 + increase);
      reason = `Strong conversion (${conversionRate.toFixed(1)}%) with high intent - testing premium`;
      confidence = 0.7;
    }
    // Very high conversion = definitely raise
    else if (conversionRate > 10) {
      const increase = Math.min(rule.max_change_percent, 15) / 100;
      newPrice = product.price_usd * (1 + increase);
      reason = `Exceptional conversion (${conversionRate.toFixed(1)}%) - price is too low`;
      confidence = 0.8;
    }

    // Round to nice price
    newPrice = Math.round(newPrice) - 0.01;
    if (newPrice < 10) newPrice = Math.round(newPrice * 100) / 100;

    // Clamp to bounds
    newPrice = Math.max(rule.min_price_usd, Math.min(rule.max_price_usd, newPrice));

    // Only recommend if meaningful change
    const changePercent = ((newPrice - product.price_usd) / product.price_usd) * 100;
    if (Math.abs(changePercent) >= 3) {
      recommendations.push({
        product_id: product.id,
        product_name: product.name,
        product_type: product.type,
        current_price: product.price_usd,
        recommended_price: newPrice,
        change_percent: Math.round(changePercent * 10) / 10,
        reason,
        confidence,
      });
    }
  }

  return recommendations;
}

async function sendPricingNotification(changes: string[]): Promise<void> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  
  if (!botToken || !chatId) return;

  const message = `💰 <b>עדכון מחירים אוטומטי</b>

${changes.map(c => `• ${c}`).join("\n")}

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
