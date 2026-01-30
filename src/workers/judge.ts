/**
 * Judge Worker
 * Evaluates test results with Kill Gates and scoring logic
 */

import type { SkepticTest, SkepticResult, JudgeResult, SkepticCategory } from '@/types';

interface JudgeConfig {
  passThreshold: number;  // Default: 0.95
  categoryWeights: {
    CONTEXT_NOISE: number;  // Default: 0.6
    MULTI_DATES: number;    // Default: 0.4
  };
}

const DEFAULT_CONFIG: JudgeConfig = {
  passThreshold: 0.95,
  categoryWeights: {
    CONTEXT_NOISE: 0.6,
    MULTI_DATES: 0.4,
  },
};

/**
 * Judge test results with Kill Gate logic
 */
export function judgeResults(
  tests: SkepticTest[],
  results: SkepticResult[],
  jobId: string,
  config: JudgeConfig = DEFAULT_CONFIG
): JudgeResult {
  // Map results by test ID for quick lookup
  const resultMap = new Map(results.map(r => [r.test_id, r]));
  
  // Initialize category scores
  const categoryScores: Record<SkepticCategory, number> = {
    AMBIGUITY: 0,
    INVALID_DATES: 0,
    MALFORMED_ISO: 0,
    BOUNDARY: 0,
    CONTEXT_NOISE: 0,
    MULTI_DATES: 0,
    PERFORMANCE_GUARD: 0,
  };
  
  const categoryCounts: Record<SkepticCategory, { passed: number; total: number }> = {
    AMBIGUITY: { passed: 0, total: 0 },
    INVALID_DATES: { passed: 0, total: 0 },
    MALFORMED_ISO: { passed: 0, total: 0 },
    BOUNDARY: { passed: 0, total: 0 },
    CONTEXT_NOISE: { passed: 0, total: 0 },
    MULTI_DATES: { passed: 0, total: 0 },
    PERFORMANCE_GUARD: { passed: 0, total: 0 },
  };
  
  let killGateTriggered = false;
  let killGateReason: string | undefined;
  const failedTests: SkepticResult[] = [];
  let passedCount = 0;
  
  // Process each test
  for (const test of tests) {
    const result = resultMap.get(test.id);
    
    if (!result) {
      // Test wasn't run - count as failed
      categoryCounts[test.category].total++;
      failedTests.push({
        test_id: test.id,
        passed: false,
        actual_output: [],
        runtime_ms: 0,
        error: 'Test not executed',
      });
      continue;
    }
    
    categoryCounts[test.category].total++;
    
    if (result.passed) {
      categoryCounts[test.category].passed++;
      passedCount++;
    } else {
      failedTests.push(result);
      
      // Check Kill Gates
      if (test.is_kill_gate) {
        // For kill gate tests (AMBIGUITY, INVALID_DATES, MALFORMED_ISO):
        // If ANY date was returned when [] was expected = KILL
        const expectedEmpty = test.expected_output.length === 0;
        const gotDates = result.actual_output.length > 0;
        
        if (expectedEmpty && gotDates) {
          killGateTriggered = true;
          killGateReason = `Kill Gate ${test.category}: False Positive detected. ` +
            `Test "${test.id}" returned dates when none were expected. ` +
            `Input: "${test.input.slice(0, 50)}..." => Got: ${JSON.stringify(result.actual_output)}`;
        }
      }
    }
  }
  
  // If Kill Gate triggered, score = 0, immediate DROPPED
  if (killGateTriggered) {
    // Set all category scores to 0
    for (const cat of Object.keys(categoryScores) as SkepticCategory[]) {
      categoryScores[cat] = 0;
    }
    
    return {
      job_id: jobId,
      passed: false,
      score: 0,
      kill_gate_triggered: true,
      kill_gate_reason: killGateReason,
      category_scores: categoryScores,
      total_tests: tests.length,
      passed_tests: passedCount,
      failed_tests: failedTests,
    };
  }
  
  // Calculate category scores
  for (const cat of Object.keys(categoryCounts) as SkepticCategory[]) {
    const { passed, total } = categoryCounts[cat];
    categoryScores[cat] = total > 0 ? passed / total : 1;
  }
  
  // Calculate weighted score for non-kill-gate categories
  // Kill gate categories must be 100% or we wouldn't get here
  const killGateScore = (
    categoryScores.AMBIGUITY + 
    categoryScores.INVALID_DATES + 
    categoryScores.MALFORMED_ISO
  ) / 3;
  
  // Weighted score for CONTEXT_NOISE and MULTI_DATES
  const weightedScore = 
    categoryScores.CONTEXT_NOISE * config.categoryWeights.CONTEXT_NOISE +
    categoryScores.MULTI_DATES * config.categoryWeights.MULTI_DATES;
  
  // BOUNDARY and PERFORMANCE_GUARD contribute equally to remaining weight
  const otherScore = (categoryScores.BOUNDARY + categoryScores.PERFORMANCE_GUARD) / 2;
  
  // Final score: Kill gates must be 100%, then weighted average of others
  // If kill gates passed, they contribute full weight
  const finalScore = killGateScore === 1 
    ? 0.3 * killGateScore + 0.5 * weightedScore + 0.2 * otherScore
    : killGateScore * 0.3; // Penalize if not perfect
  
  const passed = finalScore >= config.passThreshold;
  
  return {
    job_id: jobId,
    passed,
    score: Math.round(finalScore * 100) / 100,
    kill_gate_triggered: false,
    category_scores: categoryScores,
    total_tests: tests.length,
    passed_tests: passedCount,
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
  for (const [category, score] of Object.entries(result.category_scores)) {
    const bar = '█'.repeat(Math.round(score * 10)) + '░'.repeat(10 - Math.round(score * 10));
    lines.push(`  ${category}: ${bar} ${(score * 100).toFixed(0)}%`);
  }
  
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
