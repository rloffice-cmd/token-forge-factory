/**
 * Factory Pipeline Orchestrator - REAL VERSION
 * Coordinates all workers: Generator → Skeptic → Sandbox → Judge → Treasury
 * Uses real Supabase database and Piston API for sandbox execution
 */

import type { 
  Job, 
  JobStatus, 
  Task, 
  SkepticTest, 
  SkepticResult, 
  JudgeResult,
  TreasuryEntry,
  ProofPack,
  AuditLog 
} from '@/types';
import { generateSolution, validateGeneratedCode } from './generator';
import { generateSkepticTests, exportSkepticJson } from './skeptic';
import { judgeResults, exportJudgeJson } from './judge';
import * as db from '@/lib/database';
import { supabase } from '@/integrations/supabase/client';

export interface PipelineResult {
  job: Job;
  solution?: string;
  skepticTests?: SkepticTest[];
  sandboxResults?: SkepticResult[];
  judgeResult?: JudgeResult;
  treasuryEntry?: TreasuryEntry | null;
  proofPack?: ProofPack;
  auditLogs: AuditLog[];
  error?: string;
}

interface PipelineCallbacks {
  onStatusChange?: (jobId: string, status: JobStatus) => void;
  onLog?: (log: AuditLog) => void;
  onNotification?: (title: string, message: string) => void;
}

/**
 * Run the complete factory pipeline for a job
 */
export async function runPipeline(
  job: Job,
  task: Task,
  callbacks?: PipelineCallbacks
): Promise<PipelineResult> {
  const auditLogs: AuditLog[] = [];
  const startTime = Date.now();
  
  const log = async (action: string, metadata: Record<string, unknown> = {}) => {
    const entry: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      job_id: job.id,
      action,
      metadata: { ...metadata, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    };
    auditLogs.push(entry);
    callbacks?.onLog?.(entry);
    
    // Save to database
    try {
      await db.createAuditLog(job.id, action, entry.metadata);
    } catch (err) {
      console.error('Failed to save audit log:', err);
    }
  };
  
  const updateStatus = async (status: JobStatus, score?: number) => {
    job.status = status;
    job.updated_at = new Date().toISOString();
    if (score !== undefined) {
      job.score = score;
    }
    callbacks?.onStatusChange?.(job.id, status);
    
    // Update in database
    try {
      await db.updateJobStatus(job.id, status, score);
    } catch (err) {
      console.error('Failed to update job status:', err);
    }
    
    await log(`status_changed`, { newStatus: status, score });
  };
  
  try {
    // ==========================================
    // Step 1: Generate Solution
    // ==========================================
    await log('pipeline_started', { task_id: task.id });
    await updateStatus('GENERATED');
    
    const generatorOutput = generateSolution(task);
    
    if (!generatorOutput.success) {
      throw new Error(`Generator failed: ${generatorOutput.error}`);
    }
    
    const validation = validateGeneratedCode(generatorOutput.code, task);
    if (!validation.valid) {
      throw new Error(`Code validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Save artifact
    await db.createArtifact(job.id, 'GEN_CODE', generatorOutput.code);
    await log('code_generated', { codeLength: generatorOutput.code.length });
    
    // ==========================================
    // Step 2: Build Skeptic Tests
    // ==========================================
    await updateStatus('TESTS_BUILT');
    
    const skepticTests = generateSkepticTests({
      minYear: parseInt(task.policy_json.date_range.min.split('-')[0]),
      maxYear: parseInt(task.policy_json.date_range.max.split('-')[0]),
    });
    
    // Save artifact
    await db.createArtifact(job.id, 'SKEPTIC_JSON', exportSkepticJson(skepticTests));
    await log('tests_generated', { testCount: skepticTests.length });
    
    // ==========================================
    // Step 3: Run Sandbox (REAL via Piston API)
    // ==========================================
    await updateStatus('SANDBOX_RUNNING');
    
    // Prepare tests for sandbox
    const testsForSandbox = skepticTests.map(t => ({
      id: t.id,
      input: t.input,
      expected_output: t.expected_output,
    }));
    
    // Call sandbox edge function
    const sandboxResults = await executeSandbox(generatorOutput.code, testsForSandbox);
    
    // Save artifact
    await db.createArtifact(job.id, 'PYTEST_REPORT', JSON.stringify(sandboxResults, null, 2));
    
    await log('sandbox_completed', { 
      passedCount: sandboxResults.filter(r => r.passed).length,
      totalCount: sandboxResults.length,
      totalRuntime: sandboxResults.reduce((sum, r) => sum + r.runtime_ms, 0),
    });
    
    // ==========================================
    // Step 4: Judge Results
    // ==========================================
    await updateStatus('JUDGED');
    
    const judgeResult = judgeResults(skepticTests, sandboxResults, job.id);
    
    // Save artifact
    await db.createArtifact(job.id, 'JUDGE_JSON', exportJudgeJson(judgeResult));
    
    await log('judge_completed', {
      score: judgeResult.score,
      passed: judgeResult.passed,
      killGate: judgeResult.kill_gate_triggered,
    });
    
    // Check Kill Gate
    if (judgeResult.kill_gate_triggered) {
      await updateStatus('DROPPED', 0);
      await log('job_dropped', { reason: judgeResult.kill_gate_reason });
      
      return {
        job,
        solution: generatorOutput.code,
        skepticTests,
        sandboxResults,
        judgeResult,
        treasuryEntry: null,
        auditLogs,
      };
    }
    
    // Check pass threshold
    if (!judgeResult.passed) {
      await updateStatus('FAILED', judgeResult.score);
      await log('job_failed', { score: judgeResult.score, threshold: 0.95 });
      
      return {
        job,
        solution: generatorOutput.code,
        skepticTests,
        sandboxResults,
        judgeResult,
        treasuryEntry: null,
        auditLogs,
      };
    }
    
    // ==========================================
    // Step 5: Build Proof Pack
    // ==========================================
    await updateStatus('READY_TO_SUBMIT', judgeResult.score);
    
    const proofPack: ProofPack = {
      solution_py: generatorOutput.code,
      skeptic_json: skepticTests,
      pytest_report: sandboxResults,
      judge_json: judgeResult,
      metadata: {
        job_id: job.id,
        task_id: task.id,
        timestamp: new Date().toISOString(),
        version: '0.1.0',
        checksum: generateChecksum(generatorOutput.code + exportSkepticJson(skepticTests)),
      },
    };
    
    // Save artifact
    await db.createArtifact(job.id, 'PROOF_PACK', JSON.stringify(proofPack, null, 2));
    await log('proof_pack_created', { checksum: proofPack.metadata.checksum });
    
    // ==========================================
    // Step 6: Submit (MOCK for now)
    // ==========================================
    await updateStatus('SUBMITTED', judgeResult.score);
    await log('submission_mock', { status: 'ACCEPTED' });
    
    // ==========================================
    // Step 7: Reward
    // ==========================================
    await updateStatus('REWARDED', judgeResult.score);
    
    // Calculate reward based on score
    const rewardAmount = calculateReward(judgeResult.score);
    const treasuryEntry = await db.createTreasuryEntry(job.id, rewardAmount);
    
    await log('reward_issued', { amount: treasuryEntry.amount, asset: treasuryEntry.asset });
    
    callbacks?.onNotification?.(
      '🎉 תגמול התקבל!',
      `קיבלת ${treasuryEntry.amount.toFixed(2)} ${treasuryEntry.asset} עבור ${job.id}`
    );
    
    // ==========================================
    // Step 8: Update Treasury
    // ==========================================
    await updateStatus('TREASURY_UPDATED', judgeResult.score);
    await log('treasury_updated', { entryId: treasuryEntry.id });
    
    // ==========================================
    // Step 9: Settle
    // ==========================================
    await updateStatus('SETTLED', judgeResult.score);
    
    const totalTime = Date.now() - startTime;
    await log('pipeline_completed', { totalTimeMs: totalTime });
    
    return {
      job,
      solution: generatorOutput.code,
      skepticTests,
      sandboxResults,
      judgeResult,
      treasuryEntry,
      proofPack,
      auditLogs,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await log('pipeline_error', { error: errorMessage });
    await updateStatus('FAILED');
    
    return {
      job,
      auditLogs,
      error: errorMessage,
    };
  }
}

/**
 * Execute code in sandbox via Edge Function
 */
async function executeSandbox(
  solutionCode: string,
  tests: Array<{ id: string; input: string; expected_output: string[] }>
): Promise<SkepticResult[]> {
  try {
    const { data, error } = await supabase.functions.invoke('sandbox-runner', {
      body: {
        solution_code: solutionCode,
        skeptic_tests: tests,
        timeout: 10000,
      },
    });
    
    if (error) {
      console.error('Sandbox function error:', error);
      // Return failed results for all tests
      return tests.map(t => ({
        test_id: t.id,
        passed: false,
        actual_output: [],
        runtime_ms: 0,
        error: `Sandbox error: ${error.message}`,
      }));
    }
    
    if (!data.success || !data.results) {
      console.error('Sandbox execution failed:', data);
      return tests.map(t => ({
        test_id: t.id,
        passed: false,
        actual_output: [],
        runtime_ms: 0,
        error: data.parse_error || data.stderr || 'Execution failed',
      }));
    }
    
    return data.results;
  } catch (err) {
    console.error('Failed to call sandbox:', err);
    return tests.map(t => ({
      test_id: t.id,
      passed: false,
      actual_output: [],
      runtime_ms: 0,
      error: `Network error: ${err instanceof Error ? err.message : 'Unknown'}`,
    }));
  }
}

/**
 * Calculate reward based on score
 */
function calculateReward(score: number): number {
  if (score < 0.95) return 0;
  
  const baseReward = 50;
  const bonusMultiplier = 1 + (score - 0.95) * 2;
  
  return Math.round(baseReward * bonusMultiplier * 100) / 100;
}

/**
 * Generate a simple checksum
 */
function generateChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Create a new job instance
 */
export function createJob(taskId: string): Job {
  return {
    id: `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    task_id: taskId,
    status: 'CREATED',
    score: null,
    iteration: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}
