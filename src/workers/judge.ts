/**
 * Judge Worker v1.0
 * Evaluates test results with Kill Gates and scoring logic
 * 
 * POLICY: ZERO TOLERANCE (MVP)
 * ============================
 * Kill Gate failure = IMMEDIATE DROP (no retry)
 * Rationale: Generator is template-based, fix_notes won't help
 * Future: LLM integration will enable retry loops
 * 
 * FIXED WEIGHTS per spec:
 * - CONTEXT_NOISE = 60%
 * - MULTI_DATES = 40%
 * - Kill Gates (AMBIGUITY, INVALID_DATES, MALFORMED_ISO) = אפס סובלנות
 * - Score >= 0.95 → PASS
 */

import type { SkepticTest, SkepticResult, JudgeResult, SkepticCategory } from '@/types';

// Kill gate categories - ZERO TOLERANCE
const KILL_GATE_CATEGORIES: SkepticCategory[] = [
  'AMBIGUITY',
  'INVALID_DATES', 
  'MALFORMED_ISO',
];

// Weighted score categories (after kill gates pass)
const WEIGHTED_CATEGORIES = {
  CONTEXT_NOISE: 0.60,  // 60%
  MULTI_DATES: 0.40,    // 40%
};

// Pass threshold
const PASS_THRESHOLD = 0.95;

// MVP Policy: No retries on Kill Gate failure
const MAX_ITERATIONS = 1;

/**
 * Judge test results with Kill Gate logic
 * 
 * Kill Gates (אפס סובלנות):
 * - AMBIGUITY: Any date returned when [] expected = KILL
 * - INVALID_DATES: Any date returned when [] expected = KILL  
 * - MALFORMED_ISO: Any date returned when [] expected = KILL
 * 
 * Scoring (if kill gates pass):
 * - CONTEXT_NOISE = 60%
 * - MULTI_DATES = 40%
 * - Score >= 0.95 → PASS
 */
export function judgeResults(
  tests: SkepticTest[],
  results: SkepticResult[],
  jobId: string
): JudgeResult {
  // Map results by test ID for quick lookup
  const resultMap = new Map(results.map(r => [r.test_id, r]));
  
  // Initialize category tracking
  const categoryResults: Record<SkepticCategory, { passed: number; total: number }> = {
    AMBIGUITY: { passed: 0, total: 0 },
    INVALID_DATES: { passed: 0, total: 0 },
    MALFORMED_ISO: { passed: 0, total: 0 },
    BOUNDARY: { passed: 0, total: 0 },
    CONTEXT_NOISE: { passed: 0, total: 0 },
    MULTI_DATES: { passed: 0, total: 0 },
    PERFORMANCE_GUARD: { passed: 0, total: 0 },
  };
  
  const failedTests: SkepticResult[] = [];
  let killGateTriggered = false;
  let killGateReason: string | undefined;
  
  // Process each test
  for (const test of tests) {
    const result = resultMap.get(test.id);
    categoryResults[test.category].total++;
    
    if (!result) {
      // Test wasn't run - count as failed
      failedTests.push({
        test_id: test.id,
        passed: false,
        actual_output: [],
        runtime_ms: 0,
        error: 'Test not executed',
      });
      continue;
    }
    
    if (result.passed) {
      categoryResults[test.category].passed++;
    } else {
      failedTests.push(result);
      
      // Check Kill Gates - אפס סובלנות
      if (KILL_GATE_CATEGORIES.includes(test.category)) {
        // For kill gate categories: if expected [] but got dates = KILL
        const expectedEmpty = test.expected_output.length === 0;
        const gotDates = result.actual_output.length > 0;
        
        if (expectedEmpty && gotDates) {
          killGateTriggered = true;
          killGateReason = `Kill Gate ${test.category}: False Positive detected. ` +
            `Test "${test.id}" returned dates when none were expected. ` +
            `Input: "${test.input.slice(0, 50)}${test.input.length > 50 ? '...' : ''}" => ` +
            `Got: ${JSON.stringify(result.actual_output)}`;
        }
      }
    }
  }
  
  // Calculate category scores
  const categoryScores: Record<SkepticCategory, number> = {
    AMBIGUITY: 0,
    INVALID_DATES: 0,
    MALFORMED_ISO: 0,
    BOUNDARY: 0,
    CONTEXT_NOISE: 0,
    MULTI_DATES: 0,
    PERFORMANCE_GUARD: 0,
  };
  
  for (const cat of Object.keys(categoryResults) as SkepticCategory[]) {
    const { passed, total } = categoryResults[cat];
    categoryScores[cat] = total > 0 ? passed / total : 1;
  }
  
  // If Kill Gate triggered, score = 0, immediate DROPPED
  if (killGateTriggered) {
    return {
      job_id: jobId,
      passed: false,
      score: 0,
      kill_gate_triggered: true,
      kill_gate_reason: killGateReason,
      category_scores: categoryScores,
      total_tests: tests.length,
      passed_tests: results.filter(r => r.passed).length,
      failed_tests: failedTests,
    };
  }
  
  // Check that ALL kill gate categories are 100%
  for (const cat of KILL_GATE_CATEGORIES) {
    if (categoryScores[cat] < 1) {
      return {
        job_id: jobId,
        passed: false,
        score: 0,
        kill_gate_triggered: true,
        kill_gate_reason: `Kill Gate ${cat}: Failed tests in zero-tolerance category`,
        category_scores: categoryScores,
        total_tests: tests.length,
        passed_tests: results.filter(r => r.passed).length,
        failed_tests: failedTests,
      };
    }
  }
  
  // Calculate weighted score for CONTEXT_NOISE (60%) and MULTI_DATES (40%)
  const weightedScore = 
    categoryScores.CONTEXT_NOISE * WEIGHTED_CATEGORIES.CONTEXT_NOISE +
    categoryScores.MULTI_DATES * WEIGHTED_CATEGORIES.MULTI_DATES;
  
  // Round to 2 decimal places
  const finalScore = Math.round(weightedScore * 100) / 100;
  const passed = finalScore >= PASS_THRESHOLD;
  
  return {
    job_id: jobId,
    passed,
    score: finalScore,
    kill_gate_triggered: false,
    category_scores: categoryScores,
    total_tests: tests.length,
    passed_tests: results.filter(r => r.passed).length,
    failed_tests: failedTests,
  };
}

/**
 * Generate a summary of judge results
 */
export function generateJudgeSummary(result: JudgeResult): string {
  const lines: string[] = [];
  
  lines.push(`=== Judge Report ===`);
  lines.push(`Job ID: ${result.job_id}`);
  lines.push(`Status: ${result.passed ? 'PASSED ✓' : 'FAILED ✗'}`);
  lines.push(`Score: ${(result.score * 100).toFixed(1)}%`);
  lines.push(`Tests: ${result.passed_tests}/${result.total_tests} passed`);
  
  if (result.kill_gate_triggered) {
    lines.push('');
    lines.push('⚠️ KILL GATE TRIGGERED');
    lines.push(`Reason: ${result.kill_gate_reason}`);
  }
  
  lines.push('');
  lines.push('Category Scores:');
  lines.push('--- Kill Gates (אפס סובלנות) ---');
  for (const cat of KILL_GATE_CATEGORIES) {
    const score = result.category_scores[cat];
    const bar = '█'.repeat(Math.round(score * 10)) + '░'.repeat(10 - Math.round(score * 10));
    lines.push(`  ${cat}: ${bar} ${(score * 100).toFixed(0)}%`);
  }
  
  lines.push('--- Weighted Score ---');
  lines.push(`  CONTEXT_NOISE (60%): ${(result.category_scores.CONTEXT_NOISE * 100).toFixed(0)}%`);
  lines.push(`  MULTI_DATES (40%): ${(result.category_scores.MULTI_DATES * 100).toFixed(0)}%`);
  
  if (result.failed_tests.length > 0) {
    lines.push('');
    lines.push('Failed Tests:');
    for (const failed of result.failed_tests.slice(0, 5)) {
      lines.push(`  - ${failed.test_id}: ${failed.error || 'Mismatch'}`);
    }
    if (result.failed_tests.length > 5) {
      lines.push(`  ... and ${result.failed_tests.length - 5} more`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Export judge result as JSON
 */
export function exportJudgeJson(result: JudgeResult): string {
  return JSON.stringify(result, null, 2);
}
