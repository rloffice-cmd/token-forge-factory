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

interface RunResult {
  success: boolean;
  jobId?: string;
  status?: string;
  score?: number;
  error?: string;
  retryAttempt?: number;
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

    // Create and run a new job with retry logic
    const result = await runWithRetry(supabase, DEFAULT_TASK_ID);

    // Send notification based on result
    if (result.success && result.score !== undefined && result.score >= 0.95) {
      await sendNotification(supabase, 'success', '🎉 ג\'וב הושלם בהצלחה!', 
        `ציון: ${(result.score * 100).toFixed(0)}%\nJob ID: ${result.jobId}`);
    } else if (!result.success && result.error?.includes('Kill Gate')) {
      await sendNotification(supabase, 'kill_gate', 'Kill Gate הופעל',
        result.error || 'Unknown error', { jobId: result.jobId, retries: result.retryAttempt });
    }

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

      // If passed, add to treasury
      if (allPassed) {
        await supabase
          .from('treasury_ledger')
          .insert({ job_id: job.id, amount: 55, asset: 'DTF-TOKEN' });
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
