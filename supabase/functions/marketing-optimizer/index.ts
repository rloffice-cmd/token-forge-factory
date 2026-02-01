/**
 * AI Marketing Optimizer - Autonomous Improvement Engine
 * מנוע AI לשיפור מתמיד של דפי נחיתה, תוכן ושיווק
 * 
 * מטרות:
 * 1. ניתוח ביצועי דפי נחיתה (bounce rate, conversion, time on page)
 * 2. יצירת וריאציות A/B לטקסטים, CTA, ותמונות
 * 3. למידה מתוצאות והמלצות לשיפור
 * 4. אופטימיזציה אוטומטית של Content Engine
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Landing page elements that can be optimized
const OPTIMIZABLE_ELEMENTS = {
  headline: {
    description: 'כותרת ראשית',
    importance: 'critical',
    variations: 3,
  },
  subheadline: {
    description: 'תת-כותרת',
    importance: 'high',
    variations: 3,
  },
  cta_button: {
    description: 'כפתור הנעה לפעולה',
    importance: 'critical',
    variations: 5,
  },
  value_proposition: {
    description: 'הצעת ערך',
    importance: 'high',
    variations: 3,
  },
  social_proof: {
    description: 'הוכחה חברתית',
    importance: 'medium',
    variations: 3,
  },
  pricing_frame: {
    description: 'מסגור מחיר',
    importance: 'high',
    variations: 4,
  },
};

// Performance metrics to track
const METRICS = {
  bounce_rate: { target: 30, unit: '%', direction: 'lower' },
  conversion_rate: { target: 5, unit: '%', direction: 'higher' },
  time_on_page: { target: 120, unit: 'seconds', direction: 'higher' },
  scroll_depth: { target: 75, unit: '%', direction: 'higher' },
  cta_clicks: { target: 10, unit: '%', direction: 'higher' },
};

interface OptimizationRequest {
  mode: 'analyze' | 'generate' | 'implement' | 'report';
  element?: keyof typeof OPTIMIZABLE_ELEMENTS;
  current_text?: string;
  performance_data?: Record<string, number>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: OptimizationRequest = await req.json();
    const { mode = 'analyze', element, current_text, performance_data } = body;

    console.log(`🎯 Marketing Optimizer running in ${mode} mode...`);

    if (mode === 'analyze') {
      // Analyze current marketing performance
      const analysis = await analyzePerformance(supabase, lovableApiKey);
      
      return new Response(
        JSON.stringify({ success: true, analysis }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'generate') {
      // Generate variations for an element
      if (!element || !current_text) {
        throw new Error('Element and current_text required for generate mode');
      }

      const variations = await generateVariations(element, current_text, lovableApiKey);
      
      // Save variations for A/B testing
      await supabase.from('marketing_experiments').insert({
        element_type: element,
        original_text: current_text,
        variations: variations,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ success: true, variations }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'implement') {
      // Implement winning variations automatically
      const implementations = await implementWinners(supabase, lovableApiKey);
      
      return new Response(
        JSON.stringify({ success: true, implementations }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'report') {
      // Generate comprehensive optimization report
      const report = await generateReport(supabase, lovableApiKey);
      
      // Notify via Telegram
      await supabase.functions.invoke('telegram-notify', {
        body: {
          message: `📊 *דו"ח אופטימיזציה שיווקית*\n\n${report.summary}`,
          type: 'marketing_report',
        },
      }).catch(() => {/* Silent */});

      return new Response(
        JSON.stringify({ success: true, report }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid mode');

  } catch (error) {
    console.error('Marketing Optimizer error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function analyzePerformance(supabase: any, apiKey: string) {
  // Get recent payments and conversion data
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  // Get closing attempts for funnel analysis
  const { data: closingAttempts } = await supabase
    .from('closing_attempts')
    .select('*')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  // Get outreach data
  const { data: outreach } = await supabase
    .from('outreach_queue')
    .select('*')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  // Calculate metrics
  const totalOutreach = outreach?.length || 0;
  const checkoutsCreated = closingAttempts?.filter((a: any) => a.checkout_url)?.length || 0;
  const confirmedPayments = payments?.filter((p: any) => p.status === 'confirmed')?.length || 0;

  const metrics = {
    outreach_to_checkout: totalOutreach > 0 ? (checkoutsCreated / totalOutreach * 100).toFixed(1) : '0',
    checkout_to_payment: checkoutsCreated > 0 ? (confirmedPayments / checkoutsCreated * 100).toFixed(1) : '0',
    total_conversions: confirmedPayments,
    revenue: payments?.reduce((sum: number, p: any) => sum + (p.amount_usd || 0), 0) || 0,
  };

  // Get AI analysis
  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert marketing analyst specializing in B2B SaaS conversion optimization.
Analyze the performance data and provide actionable insights.
Focus on:
1. Funnel bottlenecks
2. Quick wins for improvement
3. A/B test recommendations
4. Copy optimization suggestions

Return JSON with: insights, bottlenecks, recommendations, priority_actions`
        },
        {
          role: 'user',
          content: `Analyze this marketing funnel:
- Total outreach messages: ${totalOutreach}
- Checkouts created: ${checkoutsCreated}
- Confirmed payments: ${confirmedPayments}
- Total revenue: $${metrics.revenue}
- Outreach to checkout rate: ${metrics.outreach_to_checkout}%
- Checkout to payment rate: ${metrics.checkout_to_payment}%

Context: This is a crypto/blockchain security API product. Target audience is DeFi developers and Web3 projects.
Products: Wallet Risk API ($0.02/call), Webhook Health ($0.25/call), Payment Drift ($2/call), Guardian ($499/mo).

Important: We've had NO real sales yet - only test transactions.`
        }
      ],
      response_format: { type: 'json_object' },
    }),
  });

  let aiAnalysis = {};
  if (aiResponse.ok) {
    const data = await aiResponse.json();
    aiAnalysis = JSON.parse(data.choices?.[0]?.message?.content || '{}');
  }

  return {
    metrics,
    ai_analysis: aiAnalysis,
    period: '7_days',
    generated_at: new Date().toISOString(),
  };
}

async function generateVariations(
  element: keyof typeof OPTIMIZABLE_ELEMENTS, 
  currentText: string, 
  apiKey: string
) {
  const elementConfig = OPTIMIZABLE_ELEMENTS[element];
  
  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert copywriter specializing in high-converting B2B SaaS landing pages.
Your task: Create ${elementConfig.variations} variations of a ${elementConfig.description}.

Rules:
1. Each variation should test a different psychological angle (urgency, fear, curiosity, authority, etc.)
2. Keep the core value proposition but vary the framing
3. Hebrew is the primary language - make sure it sounds natural
4. Include at least one variation that's radically different

Return JSON array with objects: { text, angle, hypothesis }`
        },
        {
          role: 'user',
          content: `Create ${elementConfig.variations} variations of this ${element}:

Current: "${currentText}"

Context: Crypto security API for developers. Products detect risky wallets, broken webhooks, and payment discrepancies.
Goal: Get developers to try the API (pay-per-call starting at $0.02)`
        }
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!aiResponse.ok) {
    throw new Error('AI generation failed');
  }

  const data = await aiResponse.json();
  const variations = JSON.parse(data.choices?.[0]?.message?.content || '{"variations":[]}');
  
  return variations.variations || variations;
}

async function implementWinners(supabase: any, apiKey: string) {
  // Get experiments with enough data
  const { data: experiments } = await supabase
    .from('campaign_experiments')
    .select('*')
    .eq('status', 'running')
    .gte('minimum_sample_size', 100);

  const implementations = [];

  for (const exp of experiments || []) {
    // Check if we have a statistically significant winner
    if (exp.statistical_significance >= 0.95 && exp.winner_variant) {
      // Mark as implemented
      await supabase
        .from('campaign_experiments')
        .update({
          status: 'implemented',
          implemented_at: new Date().toISOString(),
        })
        .eq('id', exp.id);

      // Log the learning
      await supabase.from('learning_events').insert({
        entity_type: 'landing_page',
        entity_id: exp.id,
        event_type: 'optimization_implemented',
        change_description: `Implemented winning variant: ${exp.winner_variant}`,
        expected_impact: exp.results,
        trigger_reason: 'auto_optimization',
      });

      implementations.push({
        experiment_id: exp.id,
        element: exp.experiment_type,
        winner: exp.winner_variant,
        improvement: exp.results?.improvement_percent || 'unknown',
      });
    }
  }

  return implementations;
}

async function generateReport(supabase: any, apiKey: string) {
  // Get performance analysis
  const analysis = await analyzePerformance(supabase, apiKey);

  // Get recent experiments
  const { data: experiments } = await supabase
    .from('campaign_experiments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  // Get content performance
  const { data: content } = await supabase
    .from('content_queue')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(20);

  // Generate AI summary
  const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-flash-preview',
      messages: [
        {
          role: 'system',
          content: `Generate a concise marketing optimization report in Hebrew.
Include: key findings, wins, areas for improvement, and priority actions.
Format for Telegram (use *bold* and bullet points).
Maximum 500 characters.`
        },
        {
          role: 'user',
          content: JSON.stringify({
            metrics: analysis.metrics,
            experiments_count: experiments?.length || 0,
            content_published: content?.length || 0,
            insights: analysis.ai_analysis,
          })
        }
      ],
    }),
  });

  let summary = 'אין מספיק נתונים לדו"ח';
  if (aiResponse.ok) {
    const data = await aiResponse.json();
    summary = data.choices?.[0]?.message?.content || summary;
  }

  return {
    summary,
    metrics: analysis.metrics,
    experiments: experiments?.length || 0,
    content_items: content?.length || 0,
    ai_analysis: analysis.ai_analysis,
    generated_at: new Date().toISOString(),
  };
}
