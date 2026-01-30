/**
 * Failure Intelligence Worker
 * Analyzes failed jobs and generates structured failure insights
 */

import type { JudgeResult, SkepticTest, SkepticResult } from '@/types';

type FailureType = 'KILL_GATE' | 'FAILED' | 'PARSE_ERROR' | 'SANDBOX_ERROR';

export interface FailureInsight {
  job_id: string;
  task_id: string | null;
  failure_type: FailureType;
  failure_category: string | null;
  root_cause: string;
  confidence: number;
  pattern_signature: string;
  evidence: {
    failed_test_id: string | null;
    failure_category: string | null;
    input_sample: string | null;
    expected_output: string[] | null;
    actual_output: string[] | null;
    sandbox_error: string | null;
    code_snippet: string | null;
    judge_reason: string | null;
    score: number;
  };
}

/**
 * Generate a stable signature hash from failure components
 */
function stableSig(parts: string[]): string {
  let hash = 0;
  const s = parts.join('|').slice(0, 2000);
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Find the first failed test and its result
 */
function pickFailedTest(
  judge: JudgeResult, 
  tests: SkepticTest[], 
  results: SkepticResult[]
): { test: SkepticTest | null; res: SkepticResult | null } {
  const failed = judge.failed_tests?.[0];
  if (!failed) return { test: null, res: null };
  
  const test = tests.find(t => t.id === failed.test_id) || null;
  const res = results.find(r => r.test_id === failed.test_id) || null;
  return { test, res };
}

/**
 * Build a structured failure insight from job data
 */
export function buildFailureInsight(params: {
  job_id: string;
  task_id?: string | null;
  judge: JudgeResult;
  tests: SkepticTest[];
  results: SkepticResult[];
  generatorCode?: string;
}): FailureInsight | null {
  const { job_id, task_id, judge, tests, results, generatorCode } = params;
  
  // Determine failure type
  const failure_type: FailureType | null = judge.kill_gate_triggered 
    ? 'KILL_GATE' 
    : (!judge.passed ? 'FAILED' : null);
  
  if (!failure_type) return null;
  
  // Extract category from kill gate reason
  const categoryFromReason = judge.kill_gate_reason?.match(/Kill Gate\s([A-Z_]+)/)?.[1] ?? null;
  
  // Find the failed test details
  const picked = pickFailedTest(judge, tests, results);
  
  const inputSample = picked.test?.input ? picked.test.input.slice(0, 180) : null;
  const expected = picked.test?.expected_output ?? null;
  const actual = picked.res?.actual_output ?? null;
  const sandboxError = picked.res?.error ?? null;
  
  // Determine root cause
  let root_cause = 'Mismatch';
  if (sandboxError) {
    root_cause = `Sandbox error: ${sandboxError}`;
  } else if (categoryFromReason === 'AMBIGUITY') {
    root_cause = 'False positive: returned dates when expected []';
  } else if (categoryFromReason === 'INVALID_DATES') {
    root_cause = 'Invalid date slipped through validation';
  } else if (categoryFromReason === 'MALFORMED_ISO') {
    root_cause = 'Malformed ISO returned by extractor';
  } else if (judge.kill_gate_triggered) {
    root_cause = judge.kill_gate_reason || 'Kill gate triggered';
  }
  
  // Extract relevant code snippet
  let codeSnippet: string | null = null;
  if (generatorCode) {
    const idx = generatorCode.indexOf('def extract_iso_dates');
    if (idx >= 0) {
      codeSnippet = generatorCode.slice(idx, idx + 600);
    }
  }
  
  // Generate stable signature for deduplication
  const signature = stableSig([
    failure_type,
    categoryFromReason ?? 'NO_CAT',
    picked.test?.category ?? 'NO_TEST_CAT',
    (sandboxError ?? 'NO_ERR').slice(0, 80),
    JSON.stringify(expected ?? []).slice(0, 120),
    JSON.stringify(actual ?? []).slice(0, 120),
  ]);
  
  // Build evidence object
  const evidence = {
    failed_test_id: picked.test?.id ?? null,
    failure_category: categoryFromReason ?? picked.test?.category ?? null,
    input_sample: inputSample,
    expected_output: expected,
    actual_output: actual,
    sandbox_error: sandboxError,
    code_snippet: codeSnippet,
    judge_reason: judge.kill_gate_reason ?? null,
    score: judge.score,
  };
  
  return {
    job_id,
    task_id: task_id ?? null,
    failure_type,
    failure_category: categoryFromReason ?? picked.test?.category ?? null,
    root_cause,
    confidence: 0.8,
    pattern_signature: signature,
    evidence,
  };
}

/**
 * Classify a sandbox error into a category
 */
export function classifySandboxError(error: string): string {
  if (error.includes('SyntaxError')) return 'SYNTAX_ERROR';
  if (error.includes('NameError')) return 'NAME_ERROR';
  if (error.includes('TypeError')) return 'TYPE_ERROR';
  if (error.includes('IndexError')) return 'INDEX_ERROR';
  if (error.includes('KeyError')) return 'KEY_ERROR';
  if (error.includes('timeout') || error.includes('Timeout')) return 'TIMEOUT';
  if (error.includes('Memory')) return 'MEMORY_ERROR';
  return 'UNKNOWN';
}
