/**
 * Landing Page Optimizer - AI-Powered Copy Generation & Testing
 * 
 * מנוע אופטימיזציה לדפי נחיתה עם יצירת תוכן AI
 * 
 * FEATURES:
 * 1. Generate copy variations using AI
 * 2. Store variations for A/B testing
 * 3. Track performance and select winners
 * 4. Auto-generate improvement recommendations
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Elements that can be A/B tested
const TESTABLE_ELEMENTS = {
  hero_headline: {
    current: 'גלה בעיות לפני שהן עולות לך כסף',
    description: 'Main hero headline',
    importance: 10,
  },
  hero_subheadline: {
    current: 'API-ים חכמים שמזהים ארנקים מסוכנים, Webhooks תקולים, ופערים בתשלומים',
    description: 'Hero subheadline',
    importance: 8,
  },
  cta_primary: {
    current: 'התחל עכשיו',
    description: 'Primary CTA button',
    importance: 10,
  },
  cta_secondary: {
    current: 'נסה עכשיו',
    description: 'Secondary CTA buttons',
    importance: 7,
  },
  value_prop_wallet: {
    current: 'זהה ארנקים מסוכנים לפני שהם פוגעים בך',
    description: 'Wallet product value prop',
    importance: 6,
  },
  value_prop_webhook: {
    current: 'האם ה-Webhook שלך באמת עובד? בדוק עכשיו',
    description: 'Webhook product value prop',
    importance: 6,
  },
  value_prop_payment: {
    current: 'מצא כסף שהלך לאיבוד בין מה שציפית למה שקיבלת',
    description: 'Payment product value prop',
    importance: 6,
  },
  guardian_headline: {
    current: 'מוצא בעיות חוזרות? Guardian מתקן אותן.',
    description: 'Guardian upsell headline',
    importance: 8,
  },
  trust_signal_1: {
    current: 'תשלום מאובטח בקריפטו',
    description: 'Trust signal 1',
    importance: 5,
  },
  trust_signal_2: {
    current: 'בלי מנויים - שלם לפי שימוש',
    description: 'Trust signal 2',
    importance: 5,
  },
};

interface OptimizeRequest {
  mode: 'generate' | 'get_active' | 'record_view' | 'record_conversion' | 'get_winners';
  element?: string;
  variant_id?: string;
  experiment_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body: OptimizeRequest = await req.json();
    const { mode, element, variant_id, experiment_id } = body;

    console.log(`🎨 Landing Optimizer: ${mode}`);

    if (mode === 'generate') {
      // Generate variations for all elements or specific one
      const elements = element ? { [element]: TESTABLE_ELEMENTS[element as keyof typeof TESTABLE_ELEMENTS] } : TESTABLE_ELEMENTS;
      const allVariations: Record<string, any[]> = {};

      for (const [key, config] of Object.entries(elements)) {
        if (!config) continue;

        const variations = await generateVariations(key, config.current, config.description, LOVABLE_API_KEY);
        allVariations[key] = variations;

        // Store experiment
        await supabase.from('campaign_experiments').insert({
          name: `${key}_optimization_${Date.now()}`,
          experiment_type: key,
          hypothesis: `Testing variations of ${config.description} to improve conversion`,
          control_variant: { text: config.current, key: 'control' },
          test_variants: variations.map((v, i) => ({ ...v, key: `variant_${i + 1}` })),
          primary_metric: 'conversion_rate',
          secondary_metrics: ['click_rate', 'time_on_page'],
          status: 'running',
          started_at: new Date().toISOString(),
          traffic_split: { control: 50, test: 50 },
          minimum_sample_size: 100,
        });
      }

      return new Response(
        JSON.stringify({ success: true, variations: allVariations }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'get_active') {
      // Get active experiments and their variants
      const { data: experiments } = await supabase
        .from('campaign_experiments')
        .select('*')
        .eq('status', 'running');

      // For each visitor, assign a variant
      const assignments: Record<string, any> = {};
      
      for (const exp of experiments || []) {
        // Simple random assignment (50/50)
        const isControl = Math.random() < 0.5;
        assignments[exp.experiment_type] = isControl 
          ? { ...exp.control_variant, experiment_id: exp.id }
          : { ...(exp.test_variants?.[Math.floor(Math.random() * exp.test_variants.length)] || exp.control_variant), experiment_id: exp.id };
      }

      return new Response(
        JSON.stringify({ success: true, assignments }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'record_view' && experiment_id && variant_id) {
      // Record a view for this variant
      const { data: exp } = await supabase
        .from('campaign_experiments')
        .select('results')
        .eq('id', experiment_id)
        .single();

      const results = exp?.results || {};
      results[variant_id] = results[variant_id] || { views: 0, conversions: 0 };
      results[variant_id].views += 1;

      await supabase
        .from('campaign_experiments')
        .update({ results })
        .eq('id', experiment_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'record_conversion' && experiment_id && variant_id) {
      // Record a conversion for this variant
      const { data: exp } = await supabase
        .from('campaign_experiments')
        .select('results, control_variant, test_variants, minimum_sample_size')
        .eq('id', experiment_id)
        .single();

      const results = exp?.results || {};
      results[variant_id] = results[variant_id] || { views: 0, conversions: 0 };
      results[variant_id].conversions += 1;

      // Calculate conversion rates
      const rates: Record<string, number> = {};
      let totalViews = 0;
      for (const [key, data] of Object.entries(results)) {
        const d = data as { views: number; conversions: number };
        rates[key] = d.views > 0 ? (d.conversions / d.views) * 100 : 0;
        totalViews += d.views;
      }

      // Check for statistical significance if we have enough data
      if (totalViews >= (exp?.minimum_sample_size || 100)) {
        const winner = Object.entries(rates).sort((a, b) => b[1] - a[1])[0];
        
        if (winner && rates[winner[0]] > 0) {
          await supabase
            .from('campaign_experiments')
            .update({
              results,
              winner_variant: winner[0],
              statistical_significance: calculateSignificance(results),
            })
            .eq('id', experiment_id);
        }
      } else {
        await supabase
          .from('campaign_experiments')
          .update({ results })
          .eq('id', experiment_id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (mode === 'get_winners') {
      // Get all winning variants to implement
      const { data: winners } = await supabase
        .from('campaign_experiments')
        .select('*')
        .not('winner_variant', 'is', null)
        .gte('statistical_significance', 0.95);

      const winningVariants: Record<string, any> = {};
      
      for (const exp of winners || []) {
        const variant = exp.winner_variant === 'control' 
          ? exp.control_variant 
          : exp.test_variants?.find((v: any) => v.key === exp.winner_variant);
        
        if (variant) {
          winningVariants[exp.experiment_type] = {
            text: variant.text,
            improvement: calculateImprovement(exp.results, exp.winner_variant),
            experiment_id: exp.id,
          };
        }
      }

      return new Response(
        JSON.stringify({ success: true, winners: winningVariants }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid mode');

  } catch (error) {
    console.error('Landing Optimizer error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateVariations(
  elementKey: string,
  currentText: string,
  description: string,
  apiKey: string
): Promise<any[]> {
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
            content: `You are an expert copywriter for B2B SaaS landing pages.
Generate 3 compelling variations for A/B testing.

Each variation should:
1. Test a different psychological angle (urgency, fear, social proof, curiosity, authority)
2. Be in Hebrew (natural, not translated)
3. Be concise and powerful
4. Include emojis where appropriate for visual appeal

Return JSON: { "variations": [{ "text": "...", "angle": "...", "hypothesis": "..." }] }`
          },
          {
            role: 'user',
            content: `Create 3 variations for: ${description}

Current text: "${currentText}"

Context: Crypto security API for developers
Products: Wallet Risk ($0.02), Webhook Health ($0.25), Payment Drift ($2), Guardian ($499/mo)
Goal: Get developers to try the API`
          }
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) return [];

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.variations || [];
  } catch (error) {
    console.error('Variation generation error:', error);
    return [];
  }
}

function calculateSignificance(results: Record<string, { views: number; conversions: number }>): number {
  const variants = Object.values(results);
  if (variants.length < 2) return 0;

  // Simple z-test approximation
  const sorted = variants.sort((a, b) => (b.conversions / b.views) - (a.conversions / a.views));
  const winner = sorted[0];
  const runnerUp = sorted[1];

  if (winner.views === 0 || runnerUp.views === 0) return 0;

  const p1 = winner.conversions / winner.views;
  const p2 = runnerUp.conversions / runnerUp.views;
  const p = (winner.conversions + runnerUp.conversions) / (winner.views + runnerUp.views);
  
  const se = Math.sqrt(p * (1 - p) * (1 / winner.views + 1 / runnerUp.views));
  if (se === 0) return 0;

  const z = (p1 - p2) / se;
  
  // Convert z-score to confidence (approximation)
  const significance = 1 - 0.5 * Math.exp(-0.5 * z * z);
  return Math.min(significance, 0.99);
}

function calculateImprovement(
  results: Record<string, { views: number; conversions: number }>,
  winnerKey: string
): string {
  const control = results.control;
  const winner = results[winnerKey];

  if (!control || !winner || control.views === 0 || winner.views === 0) return '0%';

  const controlRate = control.conversions / control.views;
  const winnerRate = winner.conversions / winner.views;

  if (controlRate === 0) return winnerRate > 0 ? '+∞%' : '0%';

  const improvement = ((winnerRate - controlRate) / controlRate) * 100;
  return `${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`;
}
