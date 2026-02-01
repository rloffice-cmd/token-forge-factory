/**
 * Self-Improvement Engine
 * 
 * מנוע שיפור עצמי - מנתח כשלונות ומציע שיפורים
 * 
 * RULES:
 * 1. אין Hallucination - רק עובדות מה-DB
 * 2. לוג מפורט לכל פעולה
 * 3. שמירת הצעות לטבלת improvement_suggestions
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('🧠 Self-Improvement Engine starting...');

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Analyze recent failures from failure_insights
    const { data: recentFailures, error: failuresError } = await supabase
      .from('failure_insights')
      .select('*')
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false });

    if (failuresError) {
      console.error('Error fetching failures:', failuresError);
    }

    console.log(`📊 Found ${recentFailures?.length || 0} failures in last 24h`);

    // 2. Analyze job success rate
    const { data: recentJobs } = await supabase
      .from('jobs')
      .select('status')
      .gte('created_at', oneDayAgo.toISOString());

    const totalJobs = recentJobs?.length || 0;
    const settledJobs = recentJobs?.filter(j => j.status === 'SETTLED').length || 0;
    const failedJobs = recentJobs?.filter(j => j.status === 'FAILED').length || 0;
    const successRate = totalJobs > 0 ? (settledJobs / totalJobs) * 100 : 0;

    console.log(`📈 Job stats (24h): ${totalJobs} total, ${settledJobs} settled, ${failedJobs} failed (${successRate.toFixed(1)}% success)`);

    // 3. Analyze error patterns from audit_logs
    const { data: errorLogs } = await supabase
      .from('audit_logs')
      .select('action, metadata')
      .eq('action', 'pipeline_error')
      .gte('created_at', oneDayAgo.toISOString());

    console.log(`⚠️ Found ${errorLogs?.length || 0} pipeline errors in last 24h`);

    // 4. Check API performance
    const { data: apiRequests } = await supabase
      .from('api_requests')
      .select('response_time_ms, decision')
      .gte('created_at', oneDayAgo.toISOString());

    const avgResponseTime = apiRequests?.length 
      ? apiRequests.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / apiRequests.length
      : 0;

    console.log(`⚡ API avg response time: ${avgResponseTime.toFixed(0)}ms (${apiRequests?.length || 0} requests)`);

    // 5. Generate improvement suggestions based on analysis
    const suggestions: Array<{
      title: string;
      description: string;
      category: string;
      priority: string;
      source: string;
      evidence: Record<string, unknown>;
      confidence: number;
    }> = [];

    // Check for high failure rate
    if (totalJobs > 5 && successRate < 70) {
      suggestions.push({
        title: 'שיעור הצלחה נמוך',
        description: `שיעור ההצלחה ב-24 שעות האחרונות עומד על ${successRate.toFixed(1)}% בלבד. יש לבדוק את הסיבות לכשלונות ולשפר את האמינות.`,
        category: 'reliability',
        priority: 'high',
        source: 'self-improvement',
        evidence: { totalJobs, settledJobs, failedJobs, successRate },
        confidence: 0.9,
      });
    }

    // Check for slow API responses
    if (avgResponseTime > 2000 && apiRequests && apiRequests.length > 10) {
      suggestions.push({
        title: 'זמני תגובה איטיים',
        description: `זמן תגובה ממוצע של ${avgResponseTime.toFixed(0)}ms גבוה מהנורמה. יש לבדוק צווארי בקבוק.`,
        category: 'performance',
        priority: 'medium',
        source: 'self-improvement',
        evidence: { avgResponseTime, requestCount: apiRequests.length },
        confidence: 0.85,
      });
    }

    // Check for recurring error patterns
    if (errorLogs && errorLogs.length > 5) {
      const errorTypes = errorLogs.reduce((acc: Record<string, number>, log) => {
        const type = (log.metadata as { error_type?: string })?.error_type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      const topErrors = Object.entries(errorTypes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3);

      if (topErrors.length > 0) {
        suggestions.push({
          title: 'דפוסי שגיאות חוזרים',
          description: `זוהו ${errorLogs.length} שגיאות ב-24 שעות האחרונות. הסוגים הנפוצים: ${topErrors.map(([t, c]) => `${t}(${c})`).join(', ')}`,
          category: 'reliability',
          priority: 'medium',
          source: 'self-improvement',
          evidence: { errorCount: errorLogs.length, errorTypes },
          confidence: 0.8,
        });
      }
    }

    // 6. Save suggestions to database
    if (suggestions.length > 0) {
      const { error: insertError } = await supabase
        .from('improvement_suggestions')
        .insert(suggestions);

      if (insertError) {
        console.error('Error saving suggestions:', insertError);
      } else {
        console.log(`💡 Saved ${suggestions.length} improvement suggestions`);
      }
    }

    // 7. Record metrics
    const metrics = [
      { metric_name: 'job_success_rate_24h', metric_value: successRate, metric_type: 'gauge' },
      { metric_name: 'avg_response_time_ms', metric_value: avgResponseTime, metric_type: 'gauge' },
      { metric_name: 'failure_count_24h', metric_value: recentFailures?.length || 0, metric_type: 'counter' },
      { metric_name: 'error_count_24h', metric_value: errorLogs?.length || 0, metric_type: 'counter' },
    ];

    const { error: metricsError } = await supabase
      .from('system_metrics')
      .insert(metrics);

    if (metricsError) {
      console.error('Error saving metrics:', metricsError);
    } else {
      console.log('📊 Saved system metrics');
    }

    // 8. Prepare summary
    const summary = {
      success: true,
      timestamp: now.toISOString(),
      analysis: {
        jobs: { total: totalJobs, settled: settledJobs, failed: failedJobs, successRate: successRate.toFixed(1) + '%' },
        failures: recentFailures?.length || 0,
        errors: errorLogs?.length || 0,
        avgResponseTimeMs: Math.round(avgResponseTime),
        apiRequests: apiRequests?.length || 0,
      },
      suggestions: suggestions.length,
      suggestionsDetails: suggestions.map(s => ({ title: s.title, priority: s.priority })),
    };

    console.log('✅ Self-Improvement Engine completed:', JSON.stringify(summary, null, 2));

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Self-Improvement Engine error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
