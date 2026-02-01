/**
 * Landing Page A/B Testing Engine
 * מערכת A/B Testing אוטומטית לדפי נחיתה
 * 
 * מטרות:
 * 1. ניהול ניסויים ווריאציות
 * 2. מעקב אחר ביצועים
 * 3. קביעת מנצחים סטטיסטית
 * 4. יישום אוטומטי
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ABTestRequest {
  mode: 'create' | 'record' | 'analyze' | 'decide';
  experiment_id?: string;
  element_type?: string;
  variants?: Array<{
    id: string;
    text: string;
    hypothesis: string;
  }>;
  event_type?: 'view' | 'click' | 'conversion';
  variant_id?: string;
  value?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: ABTestRequest = await req.json();
    const { mode, experiment_id, element_type, variants, event_type, variant_id, value } = body;

    console.log(`🧪 A/B Testing Engine: ${mode} mode`);

    if (mode === 'create') {
      // Create new experiment
      if (!element_type || !variants || variants.length < 2) {
        throw new Error('element_type and at least 2 variants required');
      }

      const expId = crypto.randomUUID();
      
      // Create experiment
      const { error: expError } = await supabase.from('campaign_experiments').insert({
        id: expId,
        name: `${element_type}_experiment_${Date.now()}`,
        experiment_type: element_type,
        hypothesis: variants[0]?.hypothesis || 'Testing conversion improvement',
        control_variant: { id: 'control', text: variants[0].text },
        test_variants: variants.slice(1),
        primary_metric: 'conversion_rate',
        secondary_metrics: ['click_rate', 'time_on_page'],
        status: 'running',
        started_at: new Date().toISOString(),
        minimum_sample_size: 100,
        traffic_split: Object.fromEntries(
          variants.map((v, i) => [v.id, 1 / variants.length])
        ),
      });

      if (expError) throw expError;

      return new Response(
        JSON.stringify({ 
          success: true, 
          experiment_id: expId,
          variants_count: variants.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'record') {
      // Record an event for a variant
      if (!experiment_id || !variant_id || !event_type) {
        throw new Error('experiment_id, variant_id, and event_type required');
      }

      // Get current experiment data
      const { data: exp } = await supabase
        .from('campaign_experiments')
        .select('results')
        .eq('id', experiment_id)
        .single();

      const currentResults = exp?.results || {};
      const variantResults = currentResults[variant_id] || { views: 0, clicks: 0, conversions: 0, revenue: 0 };

      // Update counts
      if (event_type === 'view') variantResults.views++;
      if (event_type === 'click') variantResults.clicks++;
      if (event_type === 'conversion') {
        variantResults.conversions++;
        variantResults.revenue += value || 0;
      }

      currentResults[variant_id] = variantResults;

      await supabase
        .from('campaign_experiments')
        .update({ results: currentResults })
        .eq('id', experiment_id);

      return new Response(
        JSON.stringify({ success: true, recorded: event_type }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'analyze') {
      // Analyze experiment results
      if (!experiment_id) {
        throw new Error('experiment_id required');
      }

      const { data: exp } = await supabase
        .from('campaign_experiments')
        .select('*')
        .eq('id', experiment_id)
        .single();

      if (!exp) throw new Error('Experiment not found');

      const results = exp.results || {};
      const analysis = analyzeResults(results, exp.minimum_sample_size);

      // Update with analysis
      await supabase
        .from('campaign_experiments')
        .update({
          statistical_significance: analysis.significance,
          winner_variant: analysis.winner,
        })
        .eq('id', experiment_id);

      return new Response(
        JSON.stringify({ success: true, analysis }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'decide') {
      // Auto-decide winners for mature experiments
      const { data: experiments } = await supabase
        .from('campaign_experiments')
        .select('*')
        .eq('status', 'running');

      const decisions = [];

      for (const exp of experiments || []) {
        const results = exp.results || {};
        const analysis = analyzeResults(results, exp.minimum_sample_size);

        if (analysis.ready_for_decision) {
          if (analysis.winner && analysis.significance >= 0.95) {
            // We have a winner
            await supabase
              .from('campaign_experiments')
              .update({
                status: 'completed',
                winner_variant: analysis.winner,
                statistical_significance: analysis.significance,
                ended_at: new Date().toISOString(),
              })
              .eq('id', exp.id);

            decisions.push({
              experiment_id: exp.id,
              decision: 'winner_found',
              winner: analysis.winner,
              improvement: analysis.improvement_percent,
            });

            // Notify about the win
            await supabase.functions.invoke('telegram-notify', {
              body: {
                message: `🏆 *ניסוי A/B הסתיים!*\n\nמנצח: ${analysis.winner}\nשיפור: ${analysis.improvement_percent}%\nמובהקות: ${(analysis.significance * 100).toFixed(0)}%`,
                type: 'ab_test_winner',
              },
            }).catch(() => {});

          } else if ((analysis.total_samples || 0) > exp.minimum_sample_size * 3) {
            // Too much data, no clear winner - stop and use control
            await supabase
              .from('campaign_experiments')
              .update({
                status: 'completed',
                winner_variant: 'control',
                statistical_significance: analysis.significance,
                ended_at: new Date().toISOString(),
              })
              .eq('id', exp.id);

            decisions.push({
              experiment_id: exp.id,
              decision: 'no_winner',
              reason: 'No significant difference detected',
            });
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, decisions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid mode');

  } catch (error) {
    console.error('A/B Testing error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function analyzeResults(results: Record<string, any>, minSamples: number) {
  const variants = Object.keys(results);
  if (variants.length < 2) {
    return { ready_for_decision: false, reason: 'Not enough variants' };
  }

  // Calculate conversion rates
  const conversionRates: Record<string, number> = {};
  let totalSamples = 0;

  for (const variant of variants) {
    const data = results[variant];
    const views = data.views || 1;
    const conversions = data.conversions || 0;
    conversionRates[variant] = conversions / views;
    totalSamples += views;
  }

  // Check if we have enough data
  const minVariantViews = Math.min(...variants.map(v => results[v]?.views || 0));
  if (minVariantViews < minSamples) {
    return { 
      ready_for_decision: false, 
      reason: 'Not enough samples',
      current_samples: minVariantViews,
      needed: minSamples,
      total_samples: totalSamples,
    };
  }

  // Find best performer
  const sortedVariants = variants.sort((a, b) => conversionRates[b] - conversionRates[a]);
  const winner = sortedVariants[0];
  const runnerUp = sortedVariants[1];

  const winnerRate = conversionRates[winner];
  const runnerUpRate = conversionRates[runnerUp];

  // Calculate z-score for significance (simplified)
  const pooledRate = (results[winner].conversions + results[runnerUp].conversions) / 
                     (results[winner].views + results[runnerUp].views);
  const se = Math.sqrt(pooledRate * (1 - pooledRate) * 
             (1/results[winner].views + 1/results[runnerUp].views));
  const zScore = se > 0 ? (winnerRate - runnerUpRate) / se : 0;
  
  // Convert z-score to p-value (simplified)
  const significance = 1 - 0.5 * Math.exp(-0.5 * zScore * zScore);

  const improvement = runnerUpRate > 0 
    ? ((winnerRate - runnerUpRate) / runnerUpRate * 100) 
    : 0;

  return {
    ready_for_decision: true,
    winner: significance >= 0.95 ? winner : null,
    winner_rate: (winnerRate * 100).toFixed(2),
    runner_up: runnerUp,
    runner_up_rate: (runnerUpRate * 100).toFixed(2),
    improvement_percent: improvement.toFixed(1),
    significance: Math.min(significance, 0.999),
    z_score: zScore.toFixed(2),
    total_samples: totalSamples,
    conversion_rates: conversionRates,
  };
}
