// Data-to-Token Factory Type Definitions

export type JobStatus =
  | 'CREATED'
  | 'GENERATED'
  | 'TESTS_BUILT'
  | 'SANDBOX_RUNNING'
  | 'JUDGED'
  | 'READY_TO_SUBMIT'
  | 'SUBMITTED'
  | 'REWARDED'
  | 'TREASURY_UPDATED'
  | 'SETTLED'
  | 'FAILED'
  | 'DROPPED';

export interface Task {
  id: string;
  name: string;
  policy_json: PolicySpec;
  created_at: string;
}

export interface PolicySpec {
  function_name: string;
  input_type: string;
  output_type: string;
  rules: string[];
  forbidden: string[];
  date_range: {
    min: string;
    max: string;
  };
}

export interface Job {
  id: string;
  task_id: string;
  task?: Task;
  status: JobStatus;
  score: number | null;
  iteration: number;
  created_at: string;
  updated_at: string;
}

export interface Artifact {
  id: string;
  job_id: string;
  type: ArtifactType;
  content: string;
  created_at: string;
}

export type ArtifactType =
  | 'GEN_CODE'
  | 'SKEPTIC_JSON'
  | 'PYTEST_REPORT'
  | 'JUDGE_JSON'
  | 'PROOF_PACK';

export interface SkepticTest {
  id: string;
  category: SkepticCategory;
  input: string;
  expected_output: string[];
  is_kill_gate: boolean;
  description: string;
}

export type SkepticCategory =
  | 'AMBIGUITY'
  | 'INVALID_DATES'
  | 'MALFORMED_ISO'
  | 'BOUNDARY'
  | 'CONTEXT_NOISE'
  | 'MULTI_DATES'
  | 'PERFORMANCE_GUARD';

export interface SkepticResult {
  test_id: string;
  passed: boolean;
  actual_output: string[];
  runtime_ms: number;
  error?: string;
}

export interface JudgeResult {
  job_id: string;
  passed: boolean;
  score: number;
  kill_gate_triggered: boolean;
  kill_gate_reason?: string;
  category_scores: Record<SkepticCategory, number>;
  total_tests: number;
  passed_tests: number;
  failed_tests: SkepticResult[];
}

export interface ProofPack {
  solution_py: string;
  skeptic_json: SkepticTest[];
  pytest_report: SkepticResult[];
  judge_json: JudgeResult;
  metadata: ProofMetadata;
}

export interface ProofMetadata {
  job_id: string;
  task_id: string;
  timestamp: string;
  version: string;
  checksum: string;
}

export interface TreasuryEntry {
  id: string;
  asset: string;
  amount: number;
  job_id: string;
  created_at: string;
}

export type AuditSeverity = 'INFO' | 'WARN' | 'KILL';

export interface AuditLog {
  id: string;
  job_id: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Enhanced audit metadata for Kill Gate events
 * Contains Repro Pack + Generator Fingerprint + Regex Context
 */
export interface KillGateAuditMetadata {
  event: 'KILL_GATE_TRIGGERED';
  severity: AuditSeverity;
  timestamp: string;
  job_id: string;
  
  // Repro Pack - enables quick reproduction without opening artifacts
  repro_pack: {
    failed_test_id: string;
    failure_category: SkepticCategory;
    input_excerpt: string; // max 500 chars
    expected_output: string[];
    actual_output: string[];
    diff_summary: string;
  };
  
  // Generator Fingerprint - for quick fix identification
  generator_fingerprint: {
    version: string;
    solution_checksum: string;
    snippet: {
      file: string;
      start_line: number;
      end_line: number;
      code: string; // 20-40 lines max
    };
  };
  
  // Regex Context - for INVALID_DATES/AMBIGUITY cases
  regex_context?: {
    pattern: string;
    match_groups_sample: string[][]; // up to 3 matches
    validation_rule: string;
  };
  
  // Runtime stats
  runtime_ms: number;
  
  // Error info - stacktrace only for real exceptions
  error?: {
    type: string;
    message: string;
    stacktrace?: string; // only if type != AssertionError, truncated to 30 lines
  };
  
  // References to full artifacts (keeps audit_logs light)
  artifact_refs: {
    gen_code_id?: string;
    pytest_report_id?: string;
    judge_json_id?: string;
  };
}

// Dashboard stats
export interface DashboardStats {
  jobsToday: number;
  passRate: number;
  tokensEarned: number;
  fpCriticalCount: number;
  recentJobs: Job[];
  statusDistribution: Record<JobStatus, number>;
}

// Worker interfaces
export interface GeneratorOutput {
  code: string;
  success: boolean;
  error?: string;
}

export interface SandboxOutput {
  results: SkepticResult[];
  stdout: string;
  stderr: string;
  runtime_ms: number;
  success: boolean;
}
