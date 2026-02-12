/**
 * Expansion Engine v2 — Autonomous Service Discovery, Lead Scoring & Partner Suggestions
 * 
 * NEW: "suggest_partners" action scans affiliate_programs for high-performance categories
 * and suggests new partners based on keyword matching against demand signals.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ServiceOpportunity {
  service_key: string;
  name: string;
  description: string;
  category: "ai" | "data" | "integration" | "analytics";
  confidence: number;
  market_signals: string[];
  estimated_demand: "low" | "medium" | "high";
}

interface LeadScore {
  lead_id: string;
  score: number;
  signals: string[];
  recommended_action: string;
  priority: "low" | "medium" | "high" | "critical";
}

interface PartnerSuggestion {
  suggested_name: string;
  category: string;
  reason: string;
  matched_keywords: string[];
  confidence: number;
}

interface ExpansionResult {
  services_discovered: number;
  services_added: ServiceOpportunity[];
  leads_scored: number;
  high_priority_leads: LeadScore[];
  metrics_recorded: number;
  partner_suggestions: PartnerSuggestion[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const { action } = await req.json().catch(() => ({ action: "full_scan" }));
    console.log(`[Expansion Engine] Starting ${action}...`);

    let result: ExpansionResult = {
      services_discovered: 0, services_added: [], leads_scored: 0,
      high_priority_leads: [], metrics_recorded: 0, partner_suggestions: [],
    };

    switch (action) {
      case "discover_services": result = await discoverServices(supabase); break;
      case "score_leads": result = await scoreLeads(supabase); break;
      case "analyze_market": result = await analyzeMarket(supabase); break;
      case "suggest_partners": result = await suggestPartners(supabase); break;
      case "full_scan":
      default:
        const [svc, leads, market, partners] = await Promise.all([
          discoverServices(supabase), scoreLeads(supabase),
          analyzeMarket(supabase), suggestPartners(supabase),
        ]);
        result = {
          services_discovered: svc.services_discovered + market.services_discovered,
          services_added: [...svc.services_added, ...market.services_added],
          leads_scored: leads.leads_scored,
          high_priority_leads: leads.high_priority_leads,
          metrics_recorded: svc.metrics_recorded + leads.metrics_recorded + market.metrics_recorded,
          partner_suggestions: partners.partner_suggestions,
        };
    }

    await recordExpansionMetrics(supabase, result);
    console.log(`[Expansion Engine] Completed: ${result.services_discovered} services, ${result.leads_scored} leads, ${result.partner_suggestions.length} partner suggestions`);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[Expansion Engine] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * NEW: Suggest new partners based on high-performance affiliate categories
 * and demand signal keyword matching
 */
async function suggestPartners(supabase: any): Promise<ExpansionResult> {
  const result: ExpansionResult = {
    services_discovered: 0, services_added: [], leads_scored: 0,
    high_priority_leads: [], metrics_recorded: 0, partner_suggestions: [],
  };

  // Get high-performing affiliate programs
  const { data: programs } = await supabase
    .from("affiliate_programs")
    .select("name, category, commission_value, is_active")
    .eq("is_active", true)
    .order("commission_value", { ascending: false });

  // Get active m2m partners to avoid suggesting duplicates
  const { data: existingPartners } = await supabase
    .from("m2m_partners")
    .select("name")
    .eq("is_active", true);

  const existingNames = new Set((existingPartners || []).map((p: any) => p.name.toLowerCase()));

  // Get recent demand signals to identify keyword gaps
  const { data: signals } = await supabase
    .from("demand_signals")
    .select("query_text, category, relevance_score")
    .gte("relevance_score", 70)
    .order("created_at", { ascending: false })
    .limit(200);

  // Extract keyword themes from demand signals
  const keywordThemes = extractKeywordThemes(signals || []);

  // Map high-performance categories to potential partners
  const CATEGORY_PARTNER_MAP: Record<string, PartnerSuggestion[]> = {
    "cloud": [
      { suggested_name: "AWS", category: "Cloud Infrastructure", reason: "High demand for cloud services detected", matched_keywords: ["aws", "cloud", "server", "hosting"], confidence: 0.85 },
      { suggested_name: "Hetzner", category: "Cloud Infrastructure", reason: "Cost-effective hosting demand", matched_keywords: ["vps", "server", "hosting", "cheap"], confidence: 0.75 },
    ],
    "security": [
      { suggested_name: "NordLayer", category: "Network Security", reason: "Enterprise security demand", matched_keywords: ["vpn", "security", "network", "firewall"], confidence: 0.80 },
      { suggested_name: "1Password", category: "Password Management", reason: "Security tool demand", matched_keywords: ["password", "credential", "vault", "security"], confidence: 0.78 },
    ],
    "email": [
      { suggested_name: "Mailgun", category: "Email Infrastructure", reason: "Email delivery demand", matched_keywords: ["email", "smtp", "deliverability", "transactional"], confidence: 0.82 },
      { suggested_name: "ConvertKit", category: "Email Marketing", reason: "Creator email marketing demand", matched_keywords: ["newsletter", "email", "marketing", "automation"], confidence: 0.76 },
    ],
    "analytics": [
      { suggested_name: "Mixpanel", category: "Product Analytics", reason: "Analytics demand from signals", matched_keywords: ["analytics", "tracking", "metrics", "data"], confidence: 0.79 },
      { suggested_name: "PostHog", category: "Product Analytics", reason: "Open-source analytics demand", matched_keywords: ["analytics", "feature flags", "ab test"], confidence: 0.77 },
    ],
    "crm": [
      { suggested_name: "Pipedrive", category: "Sales CRM", reason: "Sales pipeline demand", matched_keywords: ["crm", "sales", "pipeline", "deals"], confidence: 0.81 },
    ],
  };

  // Match keyword themes against potential partners
  for (const [_category, suggestions] of Object.entries(CATEGORY_PARTNER_MAP)) {
    for (const suggestion of suggestions) {
      if (existingNames.has(suggestion.suggested_name.toLowerCase())) continue;

      const matchedCount = suggestion.matched_keywords.filter(kw =>
        keywordThemes.some(theme => theme.includes(kw) || kw.includes(theme))
      ).length;

      if (matchedCount >= 1) {
        result.partner_suggestions.push({
          ...suggestion,
          confidence: suggestion.confidence * (0.5 + matchedCount * 0.25),
        });
      }
    }
  }

  // Sort by confidence
  result.partner_suggestions.sort((a, b) => b.confidence - a.confidence);

  // Log suggestions
  for (const suggestion of result.partner_suggestions.slice(0, 5)) {
    await supabase.from("improvement_suggestions").insert({
      source: "expansion_engine",
      category: "partner",
      title: `Suggested partner: ${suggestion.suggested_name} (${suggestion.category})`,
      description: suggestion.reason,
      evidence: { matched_keywords: suggestion.matched_keywords, confidence: suggestion.confidence },
      priority: suggestion.confidence > 0.8 ? "high" : "medium",
      confidence: suggestion.confidence,
    });
  }

  return result;
}

function extractKeywordThemes(signals: any[]): string[] {
  const wordCounts = new Map<string, number>();
  for (const signal of signals) {
    const words = (signal.query_text || "").toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 3) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
  }
  return Array.from(wordCounts.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word]) => word);
}

async function discoverServices(supabase: any): Promise<ExpansionResult> {
  const result: ExpansionResult = {
    services_discovered: 0, services_added: [], leads_scored: 0,
    high_priority_leads: [], metrics_recorded: 0, partner_suggestions: [],
  };

  const { data: existingServices } = await supabase.from("service_catalog").select("service_key");
  const existingKeys = new Set((existingServices || []).map((s: any) => s.service_key));

  const { data: requestPatterns } = await supabase
    .from("api_requests").select("endpoint, chain, decision, flags")
    .order("created_at", { ascending: false }).limit(500);

  const opportunities = analyzeRequestPatterns(requestPatterns || [], existingKeys);

  for (const opportunity of opportunities) {
    if (opportunity.confidence >= 0.7) {
      const { error } = await supabase.from("service_catalog").insert({
        service_key: opportunity.service_key, name: opportunity.name,
        description: opportunity.description, category: opportunity.category,
        status: "planned", discovered_by: "expansion_engine",
        config: { confidence: opportunity.confidence, market_signals: opportunity.market_signals, estimated_demand: opportunity.estimated_demand },
      });
      if (!error) result.services_added.push(opportunity);
    }
  }
  result.services_discovered = opportunities.length;
  return result;
}

function analyzeRequestPatterns(requests: any[], existingKeys: Set<string>): ServiceOpportunity[] {
  const opportunities: ServiceOpportunity[] = [];
  const chainCounts = new Map<string, number>();
  const flagCounts = new Map<string, number>();

  for (const req of requests) {
    chainCounts.set(req.chain, (chainCounts.get(req.chain) || 0) + 1);
    for (const flag of req.flags || []) {
      flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
    }
  }

  const totalRequests = requests.length;
  for (const [chain, count] of chainCounts.entries()) {
    const key = `chain-${chain}-deep`;
    if (!existingKeys.has(key) && count > totalRequests * 0.1) {
      opportunities.push({
        service_key: key, name: `${chain.toUpperCase()} Deep Analytics`,
        description: `Advanced analytics for ${chain} network`,
        category: "analytics", confidence: Math.min(0.5 + (count / totalRequests), 0.95),
        market_signals: [`High ${chain} volume: ${count} requests`],
        estimated_demand: count > totalRequests * 0.3 ? "high" : "medium",
      });
    }
  }

  for (const [flag, count] of flagCounts.entries()) {
    const key = `flag-${flag.toLowerCase()}-detector`;
    if (!existingKeys.has(key) && count > 20) {
      opportunities.push({
        service_key: key, name: `${flag} Detection Service`,
        description: `Specialized detection for ${flag} patterns`,
        category: "ai", confidence: Math.min(0.4 + (count / 100), 0.85),
        market_signals: [`Frequent ${flag}: ${count} times`],
        estimated_demand: count > 50 ? "high" : "medium",
      });
    }
  }
  return opportunities;
}

async function scoreLeads(supabase: any): Promise<ExpansionResult> {
  const result: ExpansionResult = {
    services_discovered: 0, services_added: [], leads_scored: 0,
    high_priority_leads: [], metrics_recorded: 0, partner_suggestions: [],
  };

  const { data: customers } = await supabase.from("users_customers").select("id, email, created_at");
  if (!customers?.length) return result;

  for (const customer of customers) {
    const score = await calculateLeadScore(supabase, customer);
    result.leads_scored++;
    if (score.priority === "high" || score.priority === "critical") result.high_priority_leads.push(score);
    if (score.priority === "critical") {
      await supabase.from("improvement_suggestions").insert({
        source: "expansion_engine", category: "sales",
        title: `High-priority lead: ${customer.email}`,
        description: score.recommended_action,
        evidence: { score: score.score, signals: score.signals },
        priority: "high", confidence: score.score / 100,
      });
    }
  }
  return result;
}

async function calculateLeadScore(supabase: any, customer: any): Promise<LeadScore> {
  const signals: string[] = [];
  let score = 0;

  const { count: apiCount } = await supabase.from("api_requests").select("*", { count: "exact", head: true }).eq("customer_id", customer.id);
  if (apiCount && apiCount > 0) { score += Math.min(apiCount * 2, 30); signals.push(`API usage: ${apiCount}`); }

  const { data: wallet } = await supabase.from("credit_wallets").select("credits_balance, total_credits_purchased").eq("customer_id", customer.id).maybeSingle();
  if (wallet) {
    if (wallet.total_credits_purchased > 0) { score += 25; signals.push(`Paying: ${wallet.total_credits_purchased} credits`); }
    if (wallet.credits_balance < 100 && wallet.total_credits_purchased > 0) { score += 15; signals.push("Low balance - upsell"); }
  }

  const { count: paymentCount } = await supabase.from("payments").select("*", { count: "exact", head: true }).eq("customer_id", customer.id).eq("status", "confirmed");
  if (paymentCount && paymentCount > 1) { score += 20; signals.push(`Repeat: ${paymentCount} payments`); }

  const daysSince = Math.floor((Date.now() - new Date(customer.created_at).getTime()) / (86400000));
  if (daysSince < 7) { score += 10; signals.push("New (< 7d)"); }

  let priority: "low" | "medium" | "high" | "critical";
  let recommended_action: string;
  if (score >= 70) { priority = "critical"; recommended_action = "Immediate outreach - premium tier"; }
  else if (score >= 50) { priority = "high"; recommended_action = "Send targeted offer"; }
  else if (score >= 30) { priority = "medium"; recommended_action = "Nurture campaign"; }
  else { priority = "low"; recommended_action = "Monitor"; }

  return { lead_id: customer.id, score, signals, recommended_action, priority };
}

async function analyzeMarket(supabase: any): Promise<ExpansionResult> {
  const result: ExpansionResult = {
    services_discovered: 0, services_added: [], leads_scored: 0,
    high_priority_leads: [], metrics_recorded: 0, partner_suggestions: [],
  };

  const { data: failurePatterns } = await supabase.from("failure_insights")
    .select("failure_type, failure_category, root_cause, pattern_signature")
    .order("created_at", { ascending: false }).limit(100);

  if (failurePatterns?.length) {
    const categoryGaps = new Map<string, number>();
    for (const p of failurePatterns) {
      if (p.failure_category) categoryGaps.set(p.failure_category, (categoryGaps.get(p.failure_category) || 0) + 1);
    }
    for (const [category, count] of categoryGaps.entries()) {
      if (count >= 5) {
        await supabase.from("improvement_suggestions").insert({
          source: "expansion_engine", category: "product",
          title: `Recurring ${category} failures`, description: `${count} failures suggest gap`,
          evidence: { category, failure_count: count },
          priority: count >= 10 ? "high" : "medium", confidence: Math.min(0.5 + (count / 20), 0.9),
        });
      }
    }
    result.services_discovered = categoryGaps.size;
  }
  return result;
}

async function recordExpansionMetrics(supabase: any, result: ExpansionResult): Promise<void> {
  const metrics = [
    { metric_name: "expansion.services_discovered", metric_value: result.services_discovered, metric_type: "counter" },
    { metric_name: "expansion.services_added", metric_value: result.services_added.length, metric_type: "counter" },
    { metric_name: "expansion.leads_scored", metric_value: result.leads_scored, metric_type: "counter" },
    { metric_name: "expansion.high_priority_leads", metric_value: result.high_priority_leads.length, metric_type: "gauge" },
    { metric_name: "expansion.partner_suggestions", metric_value: result.partner_suggestions.length, metric_type: "counter" },
  ];
  for (const metric of metrics) {
    await supabase.from("system_metrics").insert(metric);
    result.metrics_recorded++;
  }
}
