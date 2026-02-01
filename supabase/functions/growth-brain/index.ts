/**
 * Growth Brain - AI-Powered Growth Intelligence Engine
 * 
 * המוח הצמיחתי - מנוע אינטליגנציה לצמיחה אוטונומית
 * 
 * CAPABILITIES:
 * 1. Daily growth analysis and recommendations
 * 2. Automated experiment creation based on insights
 * 3. Cross-system optimization coordination
 * 4. Predictive modeling for revenue forecasting
 * 5. Competitor intelligence and market analysis
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GrowthAnalysis {
  acquisition: {
    signals_per_day: number;
    lead_velocity: number;
    top_sources: string[];
    source_quality_trend: string;
  };
  activation: {
    checkout_rate: number;
    payment_rate: number;
    activation_bottleneck: string;
  };
  revenue: {
    total_revenue: number;
    average_deal_size: number;
    revenue_per_lead: number;
  };
  predictions: {
    next_week_revenue: number;
    next_month_revenue: number;
    confidence: number;
  };
  actions: Array<{
    priority: 'critical' | 'high' | 'medium' | 'low';
    action: string;
    expected_impact: string;
    auto_implementable: boolean;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('🧠 Growth Brain starting comprehensive analysis...');

  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ═══════════════════════════════════════════════════════════════
    // 1. GATHER ALL SYSTEM DATA
    // ═══════════════════════════════════════════════════════════════
    const [
      signalsWeek,
      signalsMonth,
      leadsWeek,
      opportunitiesWeek,
      paymentsAll,
      sources,
      experimentsActive,
      outreachPerformance,
      brainSettings,
    ] = await Promise.all([
      supabase.from('demand_signals').select('*').gte('created_at', oneWeekAgo.toISOString()),
      supabase.from('demand_signals').select('*').gte('created_at', oneMonthAgo.toISOString()),
      supabase.from('leads').select('*').gte('created_at', oneWeekAgo.toISOString()),
      supabase.from('opportunities').select('*').gte('created_at', oneWeekAgo.toISOString()),
      supabase.from('payments').select('*'),
      supabase.from('offer_sources').select('*').eq('is_active', true),
      supabase.from('campaign_experiments').select('*').eq('status', 'running'),
      supabase.from('message_performance').select('*').eq('is_active', true),
      supabase.from('brain_settings').select('*').limit(1).single(),
    ]);

    // ═══════════════════════════════════════════════════════════════
    // 2. CALCULATE METRICS
    // ═══════════════════════════════════════════════════════════════
    const signalsPerDay = (signalsWeek.data?.length || 0) / 7;
    const leadsPerDay = (leadsWeek.data?.length || 0) / 7;
    const confirmedPayments = paymentsAll.data?.filter((p: any) => p.status === 'confirmed') || [];
    const totalRevenue = confirmedPayments.reduce((sum: number, p: any) => sum + (p.amount_usd || 0), 0);
    
    // Source analysis
    const topSources = (sources.data || [])
      .sort((a: any, b: any) => (b.health_score || 0) - (a.health_score || 0))
      .slice(0, 5)
      .map((s: any) => s.name);

    // Funnel analysis
    const checkoutsCreated = await supabase
      .from('closing_attempts')
      .select('id')
      .not('checkout_url', 'is', null)
      .gte('created_at', oneWeekAgo.toISOString());
    
    const checkoutRate = (leadsWeek.data?.length || 0) > 0 
      ? ((checkoutsCreated.data?.length || 0) / (leadsWeek.data?.length || 0)) * 100 
      : 0;
    
    const paymentRate = (checkoutsCreated.data?.length || 0) > 0
      ? (confirmedPayments.length / (checkoutsCreated.data?.length || 1)) * 100
      : 0;

    // ═══════════════════════════════════════════════════════════════
    // 3. AI ANALYSIS AND RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════════════
    const aiAnalysis = await getAIGrowthAnalysis(LOVABLE_API_KEY, {
      signals_week: signalsWeek.data?.length || 0,
      signals_month: signalsMonth.data?.length || 0,
      leads_week: leadsWeek.data?.length || 0,
      opportunities_week: opportunitiesWeek.data?.length || 0,
      confirmed_payments: confirmedPayments.length,
      total_revenue: totalRevenue,
      active_sources: sources.data?.length || 0,
      active_experiments: experimentsActive.data?.length || 0,
      checkout_rate: checkoutRate,
      payment_rate: paymentRate,
      brain_settings: brainSettings.data,
    });

    // ═══════════════════════════════════════════════════════════════
    // 4. AUTO-CREATE EXPERIMENTS BASED ON INSIGHTS
    // ═══════════════════════════════════════════════════════════════
    if (aiAnalysis.suggested_experiments && aiAnalysis.suggested_experiments.length > 0) {
      for (const exp of aiAnalysis.suggested_experiments) {
        await supabase.from('campaign_experiments').insert({
          name: exp.name,
          experiment_type: exp.type,
          hypothesis: exp.hypothesis,
          control_variant: exp.control,
          test_variants: exp.variants,
          primary_metric: exp.primary_metric || 'conversion_rate',
          status: 'draft',
          auto_implement_winner: true,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 5. AUTO-IMPLEMENT SAFE RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════════════
    const implementedActions: string[] = [];

    for (const action of aiAnalysis.actions || []) {
      if (action.auto_implementable && action.priority === 'critical') {
        // Example: Increase outreach limit if it's too low
        if (action.action.includes('increase_outreach') && brainSettings.data) {
          const newLimit = Math.min((brainSettings.data.max_daily_outreach || 20) + 10, 50);
          await supabase
            .from('brain_settings')
            .update({ max_daily_outreach: newLimit })
            .eq('id', brainSettings.data.id);
          implementedActions.push(`Increased outreach limit to ${newLimit}`);
        }

        // Example: Enable fulfillment if disabled
        if (action.action.includes('enable_fulfillment') && brainSettings.data && !brainSettings.data.fulfillment_enabled) {
          await supabase
            .from('brain_settings')
            .update({ fulfillment_enabled: true })
            .eq('id', brainSettings.data.id);
          implementedActions.push('Enabled auto-fulfillment');
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // 6. STORE INSIGHTS FOR DASHBOARD
    // ═══════════════════════════════════════════════════════════════
    for (const insight of aiAnalysis.insights || []) {
      await supabase.from('marketing_insights').insert({
        insight_type: insight.type,
        category: insight.category,
        title: insight.title,
        description: insight.description,
        recommendation: insight.recommendation,
        priority: insight.priority,
        confidence: insight.confidence || 0.8,
        evidence: insight.evidence || {},
        generated_by: 'growth-brain',
        status: 'pending',
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // 7. UPDATE DAILY METRICS
    // ═══════════════════════════════════════════════════════════════
    const today = now.toISOString().split('T')[0];
    await supabase.from('brain_metrics_daily').upsert({
      day: today,
      signals_count: signalsWeek.data?.length || 0,
      opp_count: opportunitiesWeek.data?.length || 0,
      approved_count: opportunitiesWeek.data?.filter((o: any) => o.status === 'approved').length || 0,
      outreach_sent: (await supabase.from('outreach_jobs').select('id').eq('status', 'sent').gte('created_at', oneWeekAgo.toISOString())).data?.length || 0,
      checkouts_created: checkoutsCreated.data?.length || 0,
      paid_count: confirmedPayments.length,
      revenue_usd: totalRevenue,
      conversion_rate: paymentRate,
      notes: `Growth Brain analysis: ${aiAnalysis.summary || 'Completed'}`,
    }, { onConflict: 'day' });

    // ═══════════════════════════════════════════════════════════════
    // 8. SEND SUMMARY NOTIFICATION
    // ═══════════════════════════════════════════════════════════════
    const summaryMessage = `
🧠 *Growth Brain Daily Report*

📊 *מדדי שבוע אחרון:*
• סיגנלים: ${signalsWeek.data?.length || 0}
• לידים: ${leadsWeek.data?.length || 0}
• תשלומים: ${confirmedPayments.length}
• הכנסות: $${totalRevenue.toFixed(2)}

📈 *Funnel:*
• Lead→Checkout: ${checkoutRate.toFixed(1)}%
• Checkout→Payment: ${paymentRate.toFixed(1)}%

🎯 *פעולות שבוצעו:*
${implementedActions.length > 0 ? implementedActions.map(a => `• ${a}`).join('\n') : '• אין פעולות אוטומטיות'}

💡 *המלצות עיקריות:*
${(aiAnalysis.top_recommendations || []).slice(0, 3).map((r: string) => `• ${r}`).join('\n') || '• אין המלצות חדשות'}
`.trim();

    await supabase.functions.invoke('telegram-notify', {
      body: { message: summaryMessage, type: 'growth_brain_report' },
    }).catch(() => {/* Silent */});

    // ═══════════════════════════════════════════════════════════════
    // 9. RETURN ANALYSIS
    // ═══════════════════════════════════════════════════════════════
    const analysis: GrowthAnalysis = {
      acquisition: {
        signals_per_day: signalsPerDay,
        lead_velocity: leadsPerDay,
        top_sources: topSources,
        source_quality_trend: aiAnalysis.source_trend || 'stable',
      },
      activation: {
        checkout_rate: checkoutRate,
        payment_rate: paymentRate,
        activation_bottleneck: aiAnalysis.bottleneck || 'payment_conversion',
      },
      revenue: {
        total_revenue: totalRevenue,
        average_deal_size: confirmedPayments.length > 0 ? totalRevenue / confirmedPayments.length : 0,
        revenue_per_lead: (leadsWeek.data?.length || 0) > 0 ? totalRevenue / (leadsWeek.data?.length || 1) : 0,
      },
      predictions: {
        next_week_revenue: aiAnalysis.predictions?.next_week || 0,
        next_month_revenue: aiAnalysis.predictions?.next_month || 0,
        confidence: aiAnalysis.predictions?.confidence || 0.5,
      },
      actions: aiAnalysis.actions || [],
    };

    console.log('✅ Growth Brain analysis completed:', JSON.stringify(analysis, null, 2));

    return new Response(
      JSON.stringify({ success: true, analysis, implemented: implementedActions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Growth Brain error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getAIGrowthAnalysis(apiKey: string, data: any) {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `You are a world-class growth strategist for B2B SaaS startups.
Analyze the data and provide actionable recommendations.

Return JSON with:
- summary: One sentence summary in Hebrew
- bottleneck: Main conversion bottleneck
- source_trend: "improving" | "stable" | "declining"
- insights: Array of { type, category, title (Hebrew), description (Hebrew), recommendation (Hebrew), priority, confidence, evidence }
- actions: Array of { priority, action, expected_impact, auto_implementable }
- top_recommendations: Array of 3 Hebrew strings
- suggested_experiments: Array of experiment objects
- predictions: { next_week, next_month, confidence }

Focus on:
1. Why is payment conversion 0%? What's the REAL problem?
2. What can be automated to improve conversion?
3. What experiments should we run?`
          },
          {
            role: 'user',
            content: `Analyze this growth data:
${JSON.stringify(data, null, 2)}

Context:
- Product: Crypto security APIs for developers
- Pricing: $0.02-$499 range
- Status: 0 real sales (only test transactions)
- Target: DeFi developers, Web3 projects`
          }
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error('AI request failed:', response.status);
      return { actions: [], insights: [], top_recommendations: [] };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) return { actions: [], insights: [], top_recommendations: [] };

    return JSON.parse(content);
  } catch (error) {
    console.error('AI analysis error:', error);
    return { actions: [], insights: [], top_recommendations: [] };
  }
}
