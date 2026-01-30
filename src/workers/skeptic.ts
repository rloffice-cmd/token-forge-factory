/**
 * Skeptic Worker v0.1
 * Generates deterministic test cases for extract_iso_dates function
 * No LLM - purely rule-based generation
 */

import type { SkepticTest, SkepticCategory } from '@/types';

interface TestGeneratorConfig {
  minYear: number;
  maxYear: number;
}

/**
 * Generate a complete skeptic test suite
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
  // AMBIGUITY - Kill Gate (KILL_FP)
  // Any date extracted = False Positive = FAIL
  // ==========================================
  
  addTest('AMBIGUITY', '01/02/2024', [], 
    'פורמט עמום DD/MM או MM/DD - חייב להחזיר ריק', true);
  
  addTest('AMBIGUITY', '12-05-2024', [], 
    'מקפים בסדר שגוי - לא ISO', true);
  
  addTest('AMBIGUITY', '2024/03/15', [], 
    'סלאשים במקום מקפים', true);
  
  addTest('AMBIGUITY', '15.03.2024', [], 
    'נקודות כמפריד - פורמט אירופאי', true);
  
  addTest('AMBIGUITY', 'March 15, 2024', [], 
    'פורמט טקסטואלי - לא ISO', true);
  
  addTest('AMBIGUITY', '20240315', [], 
    'בלי מפרידים - לא ISO-8601 מלא', true);
  
  // ==========================================
  // INVALID_DATES - Kill Gate (KILL_FP)
  // Dates that look like ISO but don't exist
  // ==========================================
  
  addTest('INVALID_DATES', '2024-02-30', [], 
    'פברואר 30 - לא קיים', true);
  
  addTest('INVALID_DATES', '2024-02-31', [], 
    'פברואר 31 - לא קיים', true);
  
  addTest('INVALID_DATES', '2023-02-29', [], 
    '29 בפברואר בשנה לא מעוברת', true);
  
  addTest('INVALID_DATES', '2024-04-31', [], 
    'אפריל 31 - לא קיים (30 ימים)', true);
  
  addTest('INVALID_DATES', '2024-06-31', [], 
    'יוני 31 - לא קיים', true);
  
  addTest('INVALID_DATES', '2024-09-31', [], 
    'ספטמבר 31 - לא קיים', true);
  
  addTest('INVALID_DATES', '2024-11-31', [], 
    'נובמבר 31 - לא קיים', true);
  
  addTest('INVALID_DATES', '2024-13-01', [], 
    'חודש 13 - לא קיים', true);
  
  addTest('INVALID_DATES', '2024-00-15', [], 
    'חודש 00 - לא קיים', true);
  
  addTest('INVALID_DATES', '2024-01-00', [], 
    'יום 00 - לא קיים', true);
  
  addTest('INVALID_DATES', '2024-01-32', [], 
    'יום 32 - לא קיים', true);
  
  // ==========================================
  // MALFORMED_ISO - Kill Gate (KILL_FP)
  // Wrong digit counts
  // ==========================================
  
  addTest('MALFORMED_ISO', '2024-1-15', [], 
    'חודש חד-ספרתי - צריך להיות 01', true);
  
  addTest('MALFORMED_ISO', '2024-01-5', [], 
    'יום חד-ספרתי - צריך להיות 05', true);
  
  addTest('MALFORMED_ISO', '24-01-15', [], 
    'שנה דו-ספרתית - צריך 4 ספרות', true);
  
  addTest('MALFORMED_ISO', '02024-01-15', [], 
    'שנה עם 5 ספרות', true);
  
  addTest('MALFORMED_ISO', '2024-001-15', [], 
    'חודש עם 3 ספרות', true);
  
  // ==========================================
  // BOUNDARY - Edge cases at limits
  // ==========================================
  
  addTest('BOUNDARY', `${config.minYear}-01-01`, [`${config.minYear}-01-01`], 
    'גבול תחתון - תאריך מינימלי חוקי', false);
  
  addTest('BOUNDARY', `${config.maxYear}-12-31`, [`${config.maxYear}-12-31`], 
    'גבול עליון - תאריך מקסימלי חוקי', false);
  
  addTest('BOUNDARY', `${config.minYear - 1}-12-31`, [], 
    'מתחת לגבול תחתון - דחייה', false);
  
  addTest('BOUNDARY', `${config.maxYear + 1}-01-01`, [], 
    'מעל לגבול עליון - דחייה', false);
  
  addTest('BOUNDARY', '2024-02-29', ['2024-02-29'], 
    'שנה מעוברת - 29 בפברואר חוקי', false);
  
  addTest('BOUNDARY', '2000-02-29', ['2000-02-29'], 
    'שנה מעוברת (מאה) - 29 בפברואר חוקי', false);
  
  addTest('BOUNDARY', '1900-02-28', ['1900-02-28'], 
    'שנה לא מעוברת (חריג מאה) - רק עד 28', false);
  
  // ==========================================
  // CONTEXT_NOISE - Dates in noisy text
  // Weight: 60% of non-kill-gate score
  // ==========================================
  
  addTest('CONTEXT_NOISE', 'Meeting on 2024-03-15 at 10:00 AM', ['2024-03-15'], 
    'תאריך בתוך משפט רגיל', false);
  
  addTest('CONTEXT_NOISE', 'Room A-2024-B has meeting 2024-05-01', ['2024-05-01'], 
    'הבדלה בין קוד חדר לתאריך', false);
  
  addTest('CONTEXT_NOISE', 'Version 2024-01 released on 2024-01-20', ['2024-01-20'], 
    'הבדלה בין מספר גרסה לתאריך', false);
  
  addTest('CONTEXT_NOISE', 'Call 1-800-2024-01-15 or see date 2024-06-30', ['2024-06-30'], 
    'מספר טלפון vs תאריך', false);
  
  addTest('CONTEXT_NOISE', 'ID: 2024-123456, Date: 2024-07-04', ['2024-07-04'], 
    'מזהה עם מקף vs תאריך אמיתי', false);
  
  addTest('CONTEXT_NOISE', 'Price: $2024-50 on 2024-08-15', ['2024-08-15'], 
    'מחיר עם מקף vs תאריך', false);
  
  addTest('CONTEXT_NOISE', '   2024-03-15   ', ['2024-03-15'], 
    'תאריך עם רווחים מסביב', false);
  
  addTest('CONTEXT_NOISE', '2024-03-15.', ['2024-03-15'], 
    'תאריך עם נקודה בסוף', false);
  
  addTest('CONTEXT_NOISE', '(2024-03-15)', ['2024-03-15'], 
    'תאריך בסוגריים', false);
  
  addTest('CONTEXT_NOISE', '[2024-03-15]', ['2024-03-15'], 
    'תאריך בסוגריים מרובעים', false);
  
  // ==========================================
  // MULTI_DATES - Multiple dates in text
  // Weight: 40% of non-kill-gate score
  // ==========================================
  
  addTest('MULTI_DATES', 'From 2024-01-01 to 2024-12-31', ['2024-01-01', '2024-12-31'], 
    'שני תאריכים - טווח', false);
  
  addTest('MULTI_DATES', '2024-01-01, 2024-06-15, 2024-12-31', 
    ['2024-01-01', '2024-06-15', '2024-12-31'], 
    'שלושה תאריכים מופרדים בפסיקים', false);
  
  addTest('MULTI_DATES', '2024-03-15 2024-03-15 2024-03-16', 
    ['2024-03-15', '2024-03-16'], 
    'תאריכים כפולים - החזר ייחודיים בלבד', false);
  
  addTest('MULTI_DATES', '2024-01-01\n2024-02-02\n2024-03-03', 
    ['2024-01-01', '2024-02-02', '2024-03-03'], 
    'תאריכים בשורות נפרדות', false);
  
  addTest('MULTI_DATES', 'Start: 2024-01-15, Middle: 2024-06-15, End: 2024-12-15', 
    ['2024-01-15', '2024-06-15', '2024-12-15'], 
    'תאריכים מרובים עם labels', false);
  
  // ==========================================
  // PERFORMANCE_GUARD - Large inputs
  // ==========================================
  
  addTest('PERFORMANCE_GUARD', 'x'.repeat(10000) + ' 2024-05-01 ' + 'y'.repeat(10000), 
    ['2024-05-01'], 
    'טקסט ארוך מאוד (20K chars) עם תאריך אחד', false);
  
  addTest('PERFORMANCE_GUARD', '2024-01-01 '.repeat(1000).trim(), 
    ['2024-01-01'], 
    'אלף חזרות של אותו תאריך - החזר אחד', false);
  
  addTest('PERFORMANCE_GUARD', Array.from({length: 100}, (_, i) => 
    `2024-${String(Math.floor(i/8) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`
  ).join(' '), 
    // Expected: first 100 unique valid dates
    Array.from(new Set(Array.from({length: 100}, (_, i) => 
      `2024-${String(Math.floor(i/8) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`
    ))), 
    '100 תאריכים שונים - בדיקת ביצועים', false);
  
  // Edge case: empty/null
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
