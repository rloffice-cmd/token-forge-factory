/**
 * Audit Builder - Creates enhanced audit metadata for forensic analysis
 * 
 * Builds compact yet comprehensive audit entries for Kill Gate events
 * following the MVP Evidence structure:
 * - Repro Pack: enables quick reproduction
 * - Generator Fingerprint: identifies fix location
 * - Regex Context: for date validation issues
 */

import type { 
  SkepticTest, 
  SkepticResult, 
  SkepticCategory,
  KillGateAuditMetadata,
  AuditSeverity 
} from '@/types';

const GENERATOR_VERSION = '0.1.3';
const INPUT_EXCERPT_MAX = 500;
const SNIPPET_MAX_LINES = 40;
const STACKTRACE_MAX_LINES = 30;

/**
 * Generate a simple checksum for solution code
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
 * Extract the relevant code snippet (regex pattern area)
 */
function extractRelevantSnippet(solutionCode: string): {
  file: string;
  start_line: number;
  end_line: number;
  code: string;
} {
  const lines = solutionCode.split('\n');
  
  // Find the regex pattern line
  let patternLineIdx = lines.findIndex(l => l.includes('pattern = '));
  if (patternLineIdx === -1) {
    patternLineIdx = lines.findIndex(l => l.includes('re.findall'));
  }
  
  // Default to function definition if pattern not found
  if (patternLineIdx === -1) {
    patternLineIdx = lines.findIndex(l => l.includes('def extract_iso_dates'));
  }
  
  // Calculate snippet bounds (20 lines before, 20 after)
  const startLine = Math.max(0, patternLineIdx - 10);
  const endLine = Math.min(lines.length - 1, patternLineIdx + SNIPPET_MAX_LINES - 10);
  
  const snippetLines = lines.slice(startLine, endLine + 1);
  
  return {
    file: 'solution.py',
    start_line: startLine + 1, // 1-indexed
    end_line: endLine + 1,
    code: snippetLines.join('\n'),
  };
}

/**
 * Extract regex pattern from solution code
 */
function extractRegexPattern(solutionCode: string): string {
  const patternMatch = solutionCode.match(/pattern\s*=\s*r?['"](.*?)['"]/);
  if (patternMatch) {
    return patternMatch[1];
  }
  return 'pattern not found';
}

/**
 * Generate diff summary for failed test
 */
function generateDiffSummary(
  expected: string[],
  actual: string[],
  category: SkepticCategory
): string {
  if (expected.length === 0 && actual.length > 0) {
    return `false_positive: returned ${actual.length} date(s) when expected empty`;
  }
  if (expected.length > 0 && actual.length === 0) {
    return `false_negative: returned empty when expected ${expected.length} date(s)`;
  }
  if (expected.length !== actual.length) {
    return `count_mismatch: expected ${expected.length}, got ${actual.length}`;
  }
  
  // Check for value differences
  const diffs: string[] = [];
  for (let i = 0; i < expected.length; i++) {
    if (expected[i] !== actual[i]) {
      diffs.push(`[${i}]: "${expected[i]}" → "${actual[i]}"`);
    }
  }
  
  if (diffs.length > 0) {
    return `value_mismatch: ${diffs.slice(0, 3).join(', ')}`;
  }
  
  return `category_${category.toLowerCase()}_failure`;
}

/**
 * Truncate input to max chars
 */
function truncateInput(input: string, maxLen: number = INPUT_EXCERPT_MAX): string {
  if (input.length <= maxLen) return input;
  return input.slice(0, maxLen - 3) + '...';
}

/**
 * Truncate stacktrace to max lines
 */
function truncateStacktrace(stacktrace: string | undefined): string | undefined {
  if (!stacktrace) return undefined;
  
  const lines = stacktrace.split('\n');
  if (lines.length <= STACKTRACE_MAX_LINES) return stacktrace;
  
  return lines.slice(0, STACKTRACE_MAX_LINES).join('\n') + '\n... (truncated)';
}

/**
 * Determine if stacktrace should be included
 * Only for real exceptions, not simple assertion failures
 */
function shouldIncludeStacktrace(error: string | undefined): boolean {
  if (!error) return false;
  
  const realExceptions = [
    'SyntaxError', 'ImportError', 'TypeError', 'RecursionError',
    'TimeoutError', 'MemoryError', 'RuntimeError', 'IndentationError'
  ];
  
  return realExceptions.some(ex => error.includes(ex));
}

/**
 * Build enhanced audit metadata for Kill Gate events
 */
export function buildKillGateAudit(params: {
  jobId: string;
  failedTest: SkepticTest;
  failedResult: SkepticResult;
  solutionCode: string;
  runtimeMs: number;
  killGateReason: string;
  artifactIds?: {
    genCodeId?: string;
    pytestReportId?: string;
    judgeJsonId?: string;
  };
}): KillGateAuditMetadata {
  const { 
    jobId, 
    failedTest, 
    failedResult, 
    solutionCode, 
    runtimeMs,
    killGateReason,
    artifactIds = {}
  } = params;
  
  // Extract regex pattern for context
  const regexPattern = extractRegexPattern(solutionCode);
  
  // Build regex context for date-related categories
  const dateCategories: SkepticCategory[] = ['INVALID_DATES', 'AMBIGUITY', 'MALFORMED_ISO'];
  const regexContext = dateCategories.includes(failedTest.category) ? {
    pattern: regexPattern,
    match_groups_sample: failedResult.actual_output.slice(0, 3).map(d => d.split('-')),
    validation_rule: solutionCode.includes('strptime') 
      ? 'datetime.strptime validation' 
      : 'manual regex-only (missing date validation)',
  } : undefined;
  
  // Determine error info
  const errorType = failedResult.error 
    ? (failedResult.error.includes(':') ? failedResult.error.split(':')[0] : 'Error')
    : 'AssertionError';
  
  const includeStacktrace = shouldIncludeStacktrace(failedResult.error);
  
  return {
    event: 'KILL_GATE_TRIGGERED',
    severity: 'KILL' as AuditSeverity,
    timestamp: new Date().toISOString(),
    job_id: jobId,
    
    repro_pack: {
      failed_test_id: failedTest.id,
      failure_category: failedTest.category,
      input_excerpt: truncateInput(failedTest.input),
      expected_output: failedTest.expected_output,
      actual_output: failedResult.actual_output,
      diff_summary: generateDiffSummary(
        failedTest.expected_output,
        failedResult.actual_output,
        failedTest.category
      ),
    },
    
    generator_fingerprint: {
      version: GENERATOR_VERSION,
      solution_checksum: generateChecksum(solutionCode),
      snippet: extractRelevantSnippet(solutionCode),
    },
    
    regex_context: regexContext,
    
    runtime_ms: runtimeMs,
    
    error: {
      type: errorType,
      message: failedResult.error || killGateReason,
      stacktrace: includeStacktrace ? truncateStacktrace(failedResult.error) : undefined,
    },
    
    artifact_refs: {
      gen_code_id: artifactIds.genCodeId,
      pytest_report_id: artifactIds.pytestReportId,
      judge_json_id: artifactIds.judgeJsonId,
    },
  };
}

/**
 * Build simple audit metadata for non-Kill Gate events
 */
export function buildSimpleAudit(
  action: string,
  severity: AuditSeverity,
  data: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...data,
    severity,
    timestamp: new Date().toISOString(),
  };
}
