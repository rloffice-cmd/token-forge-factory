/**
 * Skeptic Worker v1.1
 * Generates LEAN deterministic test cases for extract_iso_dates function
 * Optimized: Only 10 critical tests to stay within Piston API limits
 * No LLM - purely rule-based generation
 */

import type { SkepticTest, SkepticCategory } from '@/types';

interface TestGeneratorConfig {
  minYear: number;
  maxYear: number;
}

/**
 * Generate a MINIMAL skeptic test suite (5 tests max)
 * Critical Kill Gates + key samples only
 * Piston public API is extremely limited - ultra lean!
 */
export function generateSkepticTests(config: TestGeneratorConfig = { minYear: 1900, maxYear: 2100 }): SkepticTest[] {
  const tests: SkepticTest[] = [];
  let testId = 0;
  
  const addTest = (
    category: SkepticCategory,
    input: string,
    expectedOutput: string[],
    description: string,
    isKillGate: boolean = false
  ) => {
    tests.push({
      id: `test-${String(++testId).padStart(3, '0')}`,
      category,
      input,
      expected_output: expectedOutput,
      is_kill_gate: isKillGate,
      description,
    });
  };
  
  // ==========================================
  // CRITICAL KILL GATES (3 tests) - Zero Tolerance
  // ==========================================
  
  addTest('AMBIGUITY', '01/02/2024', [], 
    'פורמט עמום DD/MM או MM/DD - חייב להחזיר ריק', true);
  
  addTest('INVALID_DATES', '2024-02-30', [], 
    'פברואר 30 - לא קיים', true);
  
  addTest('MALFORMED_ISO', '2024-1-15', [], 
    'חודש חד-ספרתי - צריך להיות 01', true);
  
  // ==========================================
  // CONTEXT_NOISE (1 test) - 60% weight
  // ==========================================
  
  addTest('CONTEXT_NOISE', 'Meeting on 2024-05-01', ['2024-05-01'], 
    'תאריך בטקסט פשוט', false);
  
  // ==========================================
  // MULTI_DATES (1 test) - 40% weight
  // ==========================================
  
  addTest('MULTI_DATES', 'From 2024-01-01 to 2024-12-31', ['2024-01-01', '2024-12-31'], 
    'שני תאריכים - טווח', false);
  
  return tests;
}

/**
 * Export test suite as JSON
 */
export function exportSkepticJson(tests: SkepticTest[]): string {
  return JSON.stringify(tests, null, 2);
}

/**
 * Get tests by category
 */
export function getTestsByCategory(tests: SkepticTest[], category: SkepticCategory): SkepticTest[] {
  return tests.filter(t => t.category === category);
}

/**
 * Get all kill gate tests
 */
export function getKillGateTests(tests: SkepticTest[]): SkepticTest[] {
  return tests.filter(t => t.is_kill_gate);
}

/**
 * Count tests by category
 */
export function countByCategory(tests: SkepticTest[]): Record<SkepticCategory, number> {
  const counts: Record<SkepticCategory, number> = {
    AMBIGUITY: 0,
    INVALID_DATES: 0,
    MALFORMED_ISO: 0,
    BOUNDARY: 0,
    CONTEXT_NOISE: 0,
    MULTI_DATES: 0,
    PERFORMANCE_GUARD: 0,
  };
  
  for (const test of tests) {
    counts[test.category]++;
  }
  
  return counts;
}

/**
 * Get test suite statistics
 */
export function getTestStats(tests: SkepticTest[]): {
  total: number;
  killGates: number;
  byCategory: Record<SkepticCategory, number>;
} {
  return {
    total: tests.length,
    killGates: tests.filter(t => t.is_kill_gate).length,
    byCategory: countByCategory(tests),
  };
}
