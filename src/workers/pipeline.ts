/**
 * Factory Pipeline Orchestrator
 * Coordinates all workers: Generator → Skeptic → Sandbox → Judge → Treasury
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
import { createTreasuryEntry, generateRewardNotification } from './treasury';

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
  
  const log = (action: string, metadata: Record<string, unknown> = {}) => {
    const entry: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      job_id: job.id,
      action,
      metadata: { ...metadata, timestamp: new Date().toISOString() },
      created_at: new Date().toISOString(),
    };
    auditLogs.push(entry);
    callbacks?.onLog?.(entry);
  };
  
  const updateStatus = (status: JobStatus) => {
    job.status = status;
    job.updated_at = new Date().toISOString();
    callbacks?.onStatusChange?.(job.id, status);
    log(`status_changed`, { newStatus: status });
  };
  
  try {
    // ==========================================
    // Step 1: Generate Solution
    // ==========================================
    log('pipeline_started', { task_id: task.id });
    updateStatus('GENERATED');
    
    const generatorOutput = generateSolution(task);
    
    if (!generatorOutput.success) {
      throw new Error(`Generator failed: ${generatorOutput.error}`);
    }
    
    const validation = validateGeneratedCode(generatorOutput.code, task);
    if (!validation.valid) {
      throw new Error(`Code validation failed: ${validation.errors.join(', ')}`);
    }
    
    log('code_generated', { codeLength: generatorOutput.code.length });
    
    // ==========================================
    // Step 2: Build Skeptic Tests
    // ==========================================
    updateStatus('TESTS_BUILT');
    
    const skepticTests = generateSkepticTests({
      minYear: parseInt(task.policy_json.date_range.min.split('-')[0]),
      maxYear: parseInt(task.policy_json.date_range.max.split('-')[0]),
    });
    
    log('tests_generated', { testCount: skepticTests.length });
    
    // ==========================================
    // Step 3: Run Sandbox (MOCK)
    // ==========================================
    updateStatus('SANDBOX_RUNNING');
    
    // In MVP, we simulate sandbox execution
    // In production, this would call Piston API
    const sandboxResults = await simulateSandboxRun(skepticTests);
    
    log('sandbox_completed', { 
      passedCount: sandboxResults.filter(r => r.passed).length,
      totalCount: sandboxResults.length,
      totalRuntime: sandboxResults.reduce((sum, r) => sum + r.runtime_ms, 0),
    });
    
    // ==========================================
    // Step 4: Judge Results
    // ==========================================
    updateStatus('JUDGED');
    
    const judgeResult = judgeResults(skepticTests, sandboxResults, job.id);
    job.score = judgeResult.score;
    
    log('judge_completed', {
      score: judgeResult.score,
      passed: judgeResult.passed,
      killGate: judgeResult.kill_gate_triggered,
    });
    
    // Check Kill Gate
    if (judgeResult.kill_gate_triggered) {
      updateStatus('DROPPED');
      log('job_dropped', { reason: judgeResult.kill_gate_reason });
      
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
      updateStatus('FAILED');
      log('job_failed', { score: judgeResult.score, threshold: 0.95 });
      
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
    updateStatus('READY_TO_SUBMIT');
    
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
    
    log('proof_pack_created', { checksum: proofPack.metadata.checksum });
    
    // ==========================================
    // Step 6: Submit (MOCK)
    // ==========================================
    updateStatus('SUBMITTED');
    log('submission_mock', { status: 'ACCEPTED' });
    
    // ==========================================
    // Step 7: Reward (MOCK)
    // ==========================================
    updateStatus('REWARDED');
    
    const treasuryEntry = createTreasuryEntry(job.id, judgeResult.score);
    
    if (treasuryEntry) {
      log('reward_issued', { amount: treasuryEntry.amount, asset: treasuryEntry.asset });
      
      const notification = generateRewardNotification(treasuryEntry);
      callbacks?.onNotification?.(notification.title, notification.message);
    }
    
    // ==========================================
    // Step 8: Update Treasury
    // ==========================================
    updateStatus('TREASURY_UPDATED');
    log('treasury_updated', { entryId: treasuryEntry?.id });
    
    // ==========================================
    // Step 9: Settle
    // ==========================================
    updateStatus('SETTLED');
    
    const totalTime = Date.now() - startTime;
    log('pipeline_completed', { totalTimeMs: totalTime });
    
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
    log('pipeline_error', { error: errorMessage });
    updateStatus('FAILED');
    
    return {
      job,
      auditLogs,
      error: errorMessage,
    };
  }
}

/**
 * Simulate sandbox execution (MOCK)
 * In production, this would call Piston API
 */
async function simulateSandboxRun(tests: SkepticTest[]): Promise<SkepticResult[]> {
  // Simulate async execution
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // For MVP, simulate mostly passing results
  // Real implementation would execute Python code
  return tests.map(test => ({
    test_id: test.id,
    passed: true, // Simulated pass
    actual_output: test.expected_output,
    runtime_ms: Math.random() * 50 + 5,
  }));
}

/**
 * Generate a simple checksum (for demo purposes)
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
