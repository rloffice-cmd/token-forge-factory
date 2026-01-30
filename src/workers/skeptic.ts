/**
 * Skeptic Worker v1.0
 * Generates LEAN deterministic test cases for extract_iso_dates function
 * Optimized: Only 3 hardest cases per category to prevent Piston SIGKILL
 * No LLM - purely rule-based generation
 */

import type { SkepticTest, SkepticCategory } from '@/types';

interface TestGeneratorConfig {
  minYear: number;
  maxYear: number;
}

/**
 * Generate a LEAN skeptic test suite (~18-20 tests)
 * Only the 3 hardest/most representative cases per category
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
  // AMBIGUITY - Kill Gate (3 hardest cases)
  // Any date extracted = False Positive = FAIL
  // ==========================================
  
  addTest('AMBIGUITY', '01/02/2024', [], 
    'פורמט עמום DD/MM או MM/DD - חייב להחזיר ריק', true);
  
  addTest('AMBIGUITY', '2024/03/15', [], 
    'סלאשים במקום מקפים - לא ISO', true);
  
  addTest('AMBIGUITY', '20240315', [], 
    'בלי מפרידים - לא ISO-8601 מלא', true);
  
  // ==========================================
  // INVALID_DATES - Kill Gate (3 hardest cases)
  // Dates that look like ISO but don't exist
  // ==========================================
  
  addTest('INVALID_DATES', '2024-02-30', [], 
    'פברואר 30 - לא קיים', true);
  
  addTest('INVALID_DATES', '2023-02-29', [], 
    '29 בפברואר בשנה לא מעוברת', true);
  
  addTest('INVALID_DATES', '2024-13-01', [], 
    'חודש 13 - לא קיים', true);
  
  // ==========================================
  // MALFORMED_ISO - Kill Gate (3 hardest cases)
  // Wrong digit counts
  // ==========================================
  
  addTest('MALFORMED_ISO', '2024-1-15', [], 
    'חודש חד-ספרתי - צריך להיות 01', true);
  
  addTest('MALFORMED_ISO', '24-01-15', [], 
    'שנה דו-ספרתית - צריך 4 ספרות', true);
  
  addTest('MALFORMED_ISO', '2024-001-15', [], 
    'חודש עם 3 ספרות', true);
  
  // ==========================================
  // BOUNDARY - Edge cases at limits (3 cases)
  // ==========================================
  
  addTest('BOUNDARY', `${config.minYear}-01-01`, [`${config.minYear}-01-01`], 
    'גבול תחתון - תאריך מינימלי חוקי', false);
  
  addTest('BOUNDARY', `${config.maxYear}-12-31`, [`${config.maxYear}-12-31`], 
    'גבול עליון - תאריך מקסימלי חוקי', false);
  
  addTest('BOUNDARY', '2024-02-29', ['2024-02-29'], 
    'שנה מעוברת - 29 בפברואר חוקי', false);
  
  // ==========================================
  // CONTEXT_NOISE - Dates in noisy text (3 hardest cases)
  // Weight: 60% of non-kill-gate score
  // ==========================================
  
  addTest('CONTEXT_NOISE', 'Room A-2024-B has meeting 2024-05-01', ['2024-05-01'], 
    'הבדלה בין קוד חדר לתאריך', false);
  
  addTest('CONTEXT_NOISE', 'Call 1-800-2024-01-15 or see date 2024-06-30', ['2024-06-30'], 
    'מספר טלפון vs תאריך', false);
  
  addTest('CONTEXT_NOISE', 'Price: $2024-50 on 2024-08-15', ['2024-08-15'], 
    'מחיר עם מקף vs תאריך', false);
  
  // ==========================================
  // MULTI_DATES - Multiple dates in text (3 cases)
  // Weight: 40% of non-kill-gate score
  // ==========================================
  
  addTest('MULTI_DATES', 'From 2024-01-01 to 2024-12-31', ['2024-01-01', '2024-12-31'], 
    'שני תאריכים - טווח', false);
  
  addTest('MULTI_DATES', '2024-03-15 2024-03-15 2024-03-16', 
    ['2024-03-15', '2024-03-16'], 
    'תאריכים כפולים - החזר ייחודיים בלבד', false);
  
  addTest('MULTI_DATES', '2024-01-01\n2024-02-02\n2024-03-03', 
    ['2024-01-01', '2024-02-02', '2024-03-03'], 
    'תאריכים בשורות נפרדות', false);
  
  // ==========================================
  // PERFORMANCE_GUARD - One representative case
  // ==========================================
  
  addTest('PERFORMANCE_GUARD', 'x'.repeat(5000) + ' 2024-05-01 ' + 'y'.repeat(5000), 
    ['2024-05-01'], 
    'טקסט ארוך (10K chars) עם תאריך אחד', false);
  
  // Edge case: empty string
  addTest('BOUNDARY', '', [], 
    'מחרוזת ריקה', false);
  
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
