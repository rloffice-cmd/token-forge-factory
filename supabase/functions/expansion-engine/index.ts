/**
 * Expansion Engine - Autonomous Service Discovery & Lead Scoring
 * 
 * Features:
 * 1. Market Analysis - Identifies new AI service opportunities
 * 2. Service Discovery - Adds new services to catalog
 * 3. Lead Scoring - Evaluates and ranks prospects
 * 4. Integration Discovery - Finds potential API connections
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

interface ExpansionResult {
  services_discovered: number;
  services_added: ServiceOpportunity[];
  leads_scored: number;
  high_priority_leads: LeadScore[];
  metrics_recorded: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action } = await req.json().catch(() => ({ action: "full_scan" }));
    
    console.log(`[Expansion Engine] Starting ${action}...`);
    
    let result: ExpansionResult = {
      services_discovered: 0,
      services_added: [],
      leads_scored: 0,
      high_priority_leads: [],
      metrics_recorded: 0,
    };

    switch (action) {
      case "discover_services":
        result = await discoverServices(supabase);
        break;
      case "score_leads":
        result = await scoreLeads(supabase);
        break;
      case "analyze_market":
        result = await analyzeMarket(supabase);
        break;
      case "full_scan":
      default:
        result = await fullExpansionScan(supabase);
    }

    // Record metrics
    await recordExpansionMetrics(supabase, result);

    console.log(`[Expansion Engine] Completed: ${JSON.stringify(result)}`);

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[Expansion Engine] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Full expansion scan - runs all discovery and scoring
 */
async function fullExpansionScan(supabase: any): Promise<ExpansionResult> {
  const [servicesResult, leadsResult, marketResult] = await Promise.all([
    discoverServices(supabase),
    scoreLeads(supabase),
    analyzeMarket(supabase),
  ]);

  return {
    services_discovered: servicesResult.services_discovered + marketResult.services_discovered,
    services_added: [...servicesResult.services_added, ...marketResult.services_added],
    leads_scored: leadsResult.leads_scored,
    high_priority_leads: leadsResult.high_priority_leads,
    metrics_recorded: servicesResult.metrics_recorded + leadsResult.metrics_recorded + marketResult.metrics_recorded,
  };
}

/**
 * Discover new service opportunities based on market signals
 */
async function discoverServices(supabase: any): Promise<ExpansionResult> {
  const result: ExpansionResult = {
    services_discovered: 0,
    services_added: [],
    leads_scored: 0,
    high_priority_leads: [],
    metrics_recorded: 0,
  };

  // Get existing services to avoid duplicates
  const { data: existingServices } = await supabase
    .from("service_catalog")
    .select("service_key") as { data: { service_key: string }[] | null };

  const existingKeys = new Set((existingServices || []).map((s: any) => s.service_key));

  // Analyze API request patterns for service opportunities
  const { data: requestPatterns } = await supabase
    .from("api_requests")
    .select("endpoint, chain, decision, flags")
    .order("created_at", { ascending: false })
    .limit(500);

  // Identify underserved areas based on request patterns
  const opportunities = analyzeRequestPatterns(requestPatterns || [], existingKeys);

  // Add promising opportunities to catalog
  for (const opportunity of opportunities) {
    if (opportunity.confidence >= 0.7) {
      const { error } = await supabase.from("service_catalog").insert({
        service_key: opportunity.service_key,
        name: opportunity.name,
        description: opportunity.description,
        category: opportunity.category,
        status: "planned",
        discovered_by: "expansion_engine",
        config: {
          confidence: opportunity.confidence,
          market_signals: opportunity.market_signals,
          estimated_demand: opportunity.estimated_demand,
        },
      });

      if (!error) {
        result.services_added.push(opportunity);
      }
    }
  }

  result.services_discovered = opportunities.length;
  return result;
}

/**
 * Analyze request patterns to find service opportunities
 */
function analyzeRequestPatterns(
  requests: any[],
  existingKeys: Set<string>
): ServiceOpportunity[] {
  const opportunities: ServiceOpportunity[] = [];
  
  // Analyze endpoint usage
  const endpointCounts = new Map<string, number>();
  const chainCounts = new Map<string, number>();
  const flagCounts = new Map<string, number>();

  for (const req of requests) {
    endpointCounts.set(req.endpoint, (endpointCounts.get(req.endpoint) || 0) + 1);
    chainCounts.set(req.chain, (chainCounts.get(req.chain) || 0) + 1);
    
    for (const flag of req.flags || []) {
      flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
    }
  }

  // Identify high-demand chains not fully served
  const totalRequests = requests.length;
  for (const [chain, count] of chainCounts.entries()) {
    const chainServiceKey = `chain-${chain}-deep`;
    if (!existingKeys.has(chainServiceKey) && count > totalRequests * 0.1) {
      opportunities.push({
        service_key: chainServiceKey,
        name: `${chain.toUpperCase()} Deep Analytics`,
        description: `Advanced analytics and risk scoring specifically optimized for ${chain} network`,
        category: "analytics",
        confidence: Math.min(0.5 + (count / totalRequests), 0.95),
        market_signals: [`High ${chain} request volume: ${count} requests`],
        estimated_demand: count > totalRequests * 0.3 ? "high" : "medium",
      });
    }
  }

  // Identify flag-based opportunities
  for (const [flag, count] of flagCounts.entries()) {
    const flagServiceKey = `flag-${flag.toLowerCase()}-detector`;
    if (!existingKeys.has(flagServiceKey) && count > 20) {
      opportunities.push({
        service_key: flagServiceKey,
        name: `${flag} Detection Service`,
        description: `Specialized detection and analysis for ${flag} patterns`,
        category: "ai",
        confidence: Math.min(0.4 + (count / 100), 0.85),
        market_signals: [`Frequent ${flag} flag occurrence: ${count} times`],
        estimated_demand: count > 50 ? "high" : "medium",
      });
    }
  }

  return opportunities;
}

/**
 * Score leads based on engagement and behavior signals
 */
async function scoreLeads(supabase: any): Promise<ExpansionResult> {
  const result: ExpansionResult = {
    services_discovered: 0,
    services_added: [],
    leads_scored: 0,
    high_priority_leads: [],
    metrics_recorded: 0,
  };

  // Get customers with their activity
  const { data: customers } = await supabase
    .from("users_customers")
    .select("id, email, created_at");

  if (!customers || customers.length === 0) {
    return result;
  }

  for (const customer of customers) {
    // Calculate engagement score
    const score = await calculateLeadScore(supabase, customer);
    
    result.leads_scored++;
    
    if (score.priority === "high" || score.priority === "critical") {
      result.high_priority_leads.push(score);
    }

    // Record lead score as improvement suggestion if action needed
    if (score.priority === "critical") {
      await supabase.from("improvement_suggestions").insert({
        source: "expansion_engine",
        category: "sales",
        title: `High-priority lead requires attention: ${customer.email}`,
        description: score.recommended_action,
        evidence: { score: score.score, signals: score.signals },
        priority: "high",
        confidence: score.score / 100,
      });
    }
  }

  return result;
}

/**
 * Calculate lead score for a customer
 */
async function calculateLeadScore(supabase: any, customer: any): Promise<LeadScore> {
  const signals: string[] = [];
  let score = 0;

  // Check API usage
  const { count: apiCount } = await supabase
    .from("api_requests")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", customer.id);

  if (apiCount && apiCount > 0) {
    score += Math.min(apiCount * 2, 30);
    signals.push(`API usage: ${apiCount} requests`);
  }

  // Check credit wallet
  const { data: wallet } = await supabase
    .from("credit_wallets")
    .select("credits_balance, total_credits_purchased")
    .eq("customer_id", customer.id)
    .maybeSingle();

  if (wallet) {
    if (wallet.total_credits_purchased > 0) {
      score += 25;
      signals.push(`Paying customer: ${wallet.total_credits_purchased} credits purchased`);
    }
    if (wallet.credits_balance < 100 && wallet.total_credits_purchased > 0) {
      score += 15;
      signals.push("Low balance - potential upsell opportunity");
    }
  }

  // Check payment history
  const { count: paymentCount } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("customer_id", customer.id)
    .eq("status", "confirmed");

  if (paymentCount && paymentCount > 1) {
    score += 20;
    signals.push(`Repeat customer: ${paymentCount} payments`);
  }

  // Check recency
  const daysSinceCreation = Math.floor(
    (Date.now() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceCreation < 7) {
    score += 10;
    signals.push("New customer (< 7 days)");
  }

  // Determine priority
  let priority: "low" | "medium" | "high" | "critical";
  let recommended_action: string;

  if (score >= 70) {
    priority = "critical";
    recommended_action = "Immediate outreach - high-value lead ready for premium tier";
  } else if (score >= 50) {
    priority = "high";
    recommended_action = "Send targeted offer or feature showcase";
  } else if (score >= 30) {
    priority = "medium";
    recommended_action = "Add to nurture campaign";
  } else {
    priority = "low";
    recommended_action = "Monitor for engagement signals";
  }

  return {
    lead_id: customer.id,
    score,
    signals,
    recommended_action,
    priority,
  };
}

/**
 * Analyze market for new opportunities
 */
async function analyzeMarket(supabase: any): Promise<ExpansionResult> {
  const result: ExpansionResult = {
    services_discovered: 0,
    services_added: [],
    leads_scored: 0,
    high_priority_leads: [],
    metrics_recorded: 0,
  };

  // Get failure patterns to identify gaps
  const { data: failurePatterns } = await supabase
    .from("failure_insights")
    .select("failure_type, failure_category, root_cause, pattern_signature")
    .order("created_at", { ascending: false })
    .limit(100);

  if (failurePatterns && failurePatterns.length > 0) {
    // Group by category
    const categoryGaps = new Map<string, number>();
    
    for (const pattern of failurePatterns) {
      if (pattern.failure_category) {
        categoryGaps.set(
          pattern.failure_category,
          (categoryGaps.get(pattern.failure_category) || 0) + 1
        );
      }
    }

    // Create improvement suggestions for persistent gaps
    for (const [category, count] of categoryGaps.entries()) {
      if (count >= 5) {
        await supabase.from("improvement_suggestions").insert({
          source: "expansion_engine",
          category: "product",
          title: `Address recurring ${category} failures`,
          description: `${count} failures in ${category} category suggest product gap or improvement opportunity`,
          evidence: { category, failure_count: count },
          priority: count >= 10 ? "high" : "medium",
          confidence: Math.min(0.5 + (count / 20), 0.9),
        });
      }
    }

    result.services_discovered = categoryGaps.size;
  }

  return result;
}

/**
 * Record expansion metrics
 */
async function recordExpansionMetrics(
  supabase: any,
  result: ExpansionResult
): Promise<void> {
  const metrics = [
    { metric_name: "expansion.services_discovered", metric_value: result.services_discovered, metric_type: "counter" },
    { metric_name: "expansion.services_added", metric_value: result.services_added.length, metric_type: "counter" },
    { metric_name: "expansion.leads_scored", metric_value: result.leads_scored, metric_type: "counter" },
    { metric_name: "expansion.high_priority_leads", metric_value: result.high_priority_leads.length, metric_type: "gauge" },
  ];

  for (const metric of metrics) {
    await supabase.from("system_metrics").insert(metric);
    result.metrics_recorded++;
  }
}
