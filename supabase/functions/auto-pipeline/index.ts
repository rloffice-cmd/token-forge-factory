/**
 * Auto Pipeline Edge Function
 * Runs the factory pipeline automatically on a schedule
 * Includes self-healing: retry logic + LLM-based fixing
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Config
const DEFAULT_TASK_ID = 'a0000000-0000-0000-0000-000000000001';
const MAX_RETRIES = 3;
const STUCK_THRESHOLD_MINUTES = 10;
const PAYOUT_THRESHOLD_DTF = 1000;
const PAYOUT_NETWORK = 'ETH';

interface RunResult {
  success: boolean;
  jobId?: string;
  status?: string;
  score?: number;
  error?: string;
  retryAttempt?: number;
}

interface FailureInsight {
  job_id: string;
  task_id: string | null;
  failure_type: string;
  failure_category: string | null;
  root_cause: string;
  confidence: number;
  pattern_signature: string;
  evidence: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🚀 Auto Pipeline starting...');

    // Check for stuck jobs first
    await checkAndAlertStuckJobs(supabase);

    // Check if there's already a running job
    const { data: runningJobs } = await supabase
      .from('jobs')
      .select('id, status, created_at')
      .in('status', ['CREATED', 'GENERATED', 'TESTS_BUILT', 'SANDBOX_RUNNING', 'JUDGED'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (runningJobs && runningJobs.length > 0) {
      console.log('Job already running, skipping:', runningJobs[0].id);
      return new Response(
        JSON.stringify({ success: true, message: 'Job already running', jobId: runningJobs[0].id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use AI Job Processor instead of manual pipeline
    const { data: aiResult, error: aiError } = await supabase.functions.invoke('ai-job-processor', {
      body: {},
    });

    if (aiError) {
      console.error('AI Job Processor error:', aiError);
      throw new Error(`AI Processor failed: ${aiError.message}`);
    }

    const result: RunResult = {
      success: aiResult?.processed > 0 && aiResult?.results?.some((r: { success: boolean }) => r.success),
      jobId: aiResult?.results?.[0]?.job_id,
      status: aiResult?.results?.[0]?.success ? 'SETTLED' : 'FAILED',
      score: aiResult?.results?.[0]?.confidence || 0,
      retryAttempt: 1,
    };

    // NOTIFICATION POLICY: Only send alerts for REAL issues
    // ❌ NO notifications for: regular job success, regular job failure
    // ✅ YES notifications for: stuck jobs, system errors, Kill Gate after all retries
    // Regular job results are logged to audit_logs only
    
    if (!result.success && result.retryAttempt === MAX_RETRIES && result.error?.includes('Kill Gate')) {
      // Only notify on Kill Gate after ALL retries exhausted
      await sendNotification(supabase, 'kill_gate', '⚠️ Kill Gate - כל הניסיונות נכשלו',
        result.error || 'Unknown error', { jobId: result.jobId, retries: result.retryAttempt });
    }
    // Note: Success notifications removed - real money alerts come from coinbase-webhook only

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Auto Pipeline error:', error);
    
    // Send error notification
    await sendNotification(
      supabase, 
      'error', 
      'שגיאת מערכת',
      error instanceof Error ? error.message : 'Unknown error'
    );

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function runWithRetry(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  taskId: string
): Promise<RunResult> {
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`Attempt ${attempt}/${MAX_RETRIES}`);

    try {
      // Create job
      const { data: job, error: createError } = await supabase
        .from('jobs')
        .insert({ task_id: taskId, status: 'CREATED', iteration: attempt })
        .select()
        .single();

      if (createError) throw new Error(`Failed to create job: ${createError.message}`);

      // Call sandbox-runner to execute
      const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!task) throw new Error('Task not found');

      // Generate solution code (simplified - in production this would call the generator)
      const solutionCode = generateSolutionCode(task.policy_json);
      
      // Generate tests
      const skepticTests = generateSkepticTests();

      // Run sandbox
      const sandboxResponse = await supabase.functions.invoke('sandbox-runner', {
        body: {
          solution_code: solutionCode,
          skeptic_tests: skepticTests,
          timeout: 15000,
        },
      });

      if (sandboxResponse.error) {
        lastError = `Sandbox error: ${sandboxResponse.error.message}`;
        console.log(`Attempt ${attempt} failed:`, lastError);
        
        // Wait before retry (exponential backoff)
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
        continue;
      }

      const results = sandboxResponse.data?.results || [];
      const allPassed = results.every((r: { passed: boolean }) => r.passed);
      const score = allPassed ? 1 : 0;

      // Update job status
      const finalStatus = allPassed ? 'SETTLED' : 'DROPPED';
      await supabase
        .from('jobs')
        .update({ status: finalStatus, score })
        .eq('id', job.id);

      // If passed, log to audit but DO NOT add to treasury_ledger
      // Treasury ledger is ONLY for REAL payments from Coinbase Commerce webhook
      if (allPassed) {
        // OLD CODE REMOVED: This was adding fake DTF tokens to ledger
        // await supabase
        //   .from('treasury_ledger')
        //   .insert({ job_id: job.id, amount: 55, asset: 'DTF-TOKEN' });
        
        // Only audit log the job completion
        await supabase.from('audit_logs').insert({
          job_id: job.id,
          action: 'JOB_PASSED_NO_LEDGER',
          metadata: { 
            note: 'Job passed but no ledger entry - ledger only for real payments',
            score: 1,
          },
        });
        
        // Check cashout threshold (based on real payments only)
        await checkCashoutThreshold(supabase);
      } else {
        // Save failure insight for failed/dropped jobs
        const failedTest = results.find((r: { passed: boolean }) => !r.passed);
        const failureInsight = buildFailureInsight({
          job_id: job.id,
          task_id: taskId,
          failure_type: 'KILL_GATE',
          failure_category: 'TEST_FAILURE',
          sandbox_error: failedTest?.error,
          expected: failedTest?.expected_output,
          actual: failedTest?.actual_output,
          test_id: failedTest?.test_id,
          score: 0,
        });
        
        if (failureInsight) {
          await supabase
            .from('failure_insights')
            .insert(failureInsight);
        }
      }

      // Create audit log
      await supabase
        .from('audit_logs')
        .insert({
          job_id: job.id,
          action: allPassed ? 'pipeline_completed' : 'pipeline_failed',
          metadata: { 
            attempt, 
            score, 
            passed: results.filter((r: { passed: boolean }) => r.passed).length,
            total: results.length,
          },
        });

      return {
        success: allPassed,
        jobId: job.id,
        status: finalStatus,
        score,
        retryAttempt: attempt,
        error: allPassed ? undefined : 'Tests failed',
      };

    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Attempt ${attempt} error:`, lastError);
      
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 2000 * attempt));
      }
    }
  }

  // All retries exhausted - try LLM fix (future implementation)
  console.log('All retries exhausted, would trigger LLM fix here');
  
  return {
    success: false,
    error: `Failed after ${MAX_RETRIES} attempts: ${lastError}`,
    retryAttempt: MAX_RETRIES,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkAndAlertStuckJobs(supabase: any) {
  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000);
  
  const { data: stuckJobs } = await supabase
    .from('jobs')
    .select('id, status, created_at')
    .in('status', ['CREATED', 'GENERATED', 'TESTS_BUILT', 'SANDBOX_RUNNING'])
    .lt('created_at', stuckThreshold.toISOString());

  if (stuckJobs && stuckJobs.length > 0) {
    console.log('Found stuck jobs:', stuckJobs.length);
    
    for (const job of stuckJobs) {
      // Mark as failed
      await supabase
        .from('jobs')
        .update({ status: 'FAILED', score: 0 })
        .eq('id', job.id);

      // Create audit log
      await supabase
        .from('audit_logs')
        .insert({
          job_id: job.id,
          action: 'job_stuck_timeout',
          metadata: { 
            stuckSince: job.created_at, 
            originalStatus: job.status,
            thresholdMinutes: STUCK_THRESHOLD_MINUTES,
          },
        });
    }

    // Send notification
    await sendNotification(
      supabase,
      'stuck',
      'מערכת תקועה!',
      `נמצאו ${stuckJobs.length} ג'ובים תקועים יותר מ-${STUCK_THRESHOLD_MINUTES} דקות`,
      { stuckJobs: stuckJobs.map((j: { id: string; status: string }) => ({ id: j.id, status: j.status })) }
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendNotification(
  supabase: any,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
) {
  try {
    await supabase.functions.invoke('telegram-notify', {
      body: { type, title, message, data },
    });
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}

// Simplified solution generator (in production, use the full generator)
function generateSolutionCode(policy: Record<string, unknown>): string {
  const minYear = (policy.date_range as { min: string })?.min?.split('-')[0] || '1900';
  const maxYear = (policy.date_range as { max: string })?.max?.split('-')[0] || '2100';
  
  return `import re
from datetime import datetime
from typing import List

def extract_iso_dates(text: str) -> List[str]:
    if text is None or text == "":
        return []
    pattern = r'\\b(\\d{4})-(\\d{2})-(\\d{2})\\b'
    matches = re.findall(pattern, text)
    seen = set()
    result = []
    for year, month, day in matches:
        date_str = f"{year}-{month}-{day}"
        if date_str in seen:
            continue
        year_int = int(year)
        if year_int < ${minYear} or year_int > ${maxYear}:
            continue
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            continue
        seen.add(date_str)
        result.append(date_str)
    return result`;
}

// Simplified test generator
function generateSkepticTests(): Array<{ id: string; input: string; expected_output: string[] }> {
  return [
    { id: 'test-001', input: '01/02/2024', expected_output: [] },
    { id: 'test-002', input: '2024-02-30', expected_output: [] },
    { id: 'test-003', input: '2024-1-15', expected_output: [] },
    { id: 'test-004', input: 'Meeting on 2024-05-01', expected_output: ['2024-05-01'] },
    { id: 'test-005', input: 'From 2024-01-01 to 2024-12-31', expected_output: ['2024-01-01', '2024-12-31'] },
  ];
}

// Check cashout threshold and send alert
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkCashoutThreshold(supabase: any): Promise<void> {
  try {
    const { data } = await supabase
      .from('treasury_ledger')
      .select('amount');
    
    const total = (data || []).reduce((sum: number, r: { amount: number }) => sum + Number(r.amount), 0);
    
    if (total >= PAYOUT_THRESHOLD_DTF) {
      const message = [
        `💰 <b>Cashout Alert</b>`,
        ``,
        `סך הכל: <b>${total.toFixed(2)} DTF</b>`,
        `סף: <b>${PAYOUT_THRESHOLD_DTF.toFixed(2)} DTF</b>`,
        `רשת: <b>${PAYOUT_NETWORK}</b>`,
        ``,
        `🔒 כרגע: <b>מימוש ידני</b> (בטוח).`,
      ].join('\n');
      
      await supabase.functions.invoke('telegram-notify', {
        body: { message, type: 'cashout' },
      });
      
      console.log('Cashout alert sent, total:', total);
    }
  } catch (err) {
    console.error('Cashout check failed:', err);
  }
}

// Build failure insight from test results
function buildFailureInsight(params: {
  job_id: string;
  task_id: string;
  failure_type: string;
  failure_category: string;
  sandbox_error?: string;
  expected?: string[];
  actual?: string[];
  test_id?: string;
  score: number;
}): FailureInsight | null {
  const signature = stableHash([
    params.failure_type,
    params.failure_category,
    (params.sandbox_error || '').slice(0, 80),
    JSON.stringify(params.expected || []).slice(0, 120),
    JSON.stringify(params.actual || []).slice(0, 120),
  ]);
  
  return {
    job_id: params.job_id,
    task_id: params.task_id,
    failure_type: params.failure_type,
    failure_category: params.failure_category,
    root_cause: params.sandbox_error || 'Test mismatch',
    confidence: 0.8,
    pattern_signature: signature,
    evidence: {
      failed_test_id: params.test_id,
      expected_output: params.expected,
      actual_output: params.actual,
      sandbox_error: params.sandbox_error,
      score: params.score,
    },
  };
}

// Generate stable hash for pattern signature
function stableHash(parts: string[]): string {
  let hash = 0;
  const s = parts.join('|').slice(0, 2000);
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
