import type { Task, Job, Artifact, SkepticTest, JudgeResult, TreasuryEntry, DashboardStats } from '@/types';

// Default policy for ISO date extraction
export const defaultPolicy = {
  function_name: 'extract_iso_dates',
  input_type: 'str',
  output_type: 'list[str]',
  rules: [
    'Extract only ISO-8601 format: YYYY-MM-DD',
    'Ambiguity = REJECT (return empty list)',
    'Invalid dates = REJECT',
    'Date range: 1900-01-01 to 2100-12-31',
    'None or empty string => []',
    'Output: unique list, order of appearance',
  ],
  forbidden: [
    'No guessing dates',
    'No DD/MM or MM/DD interpretation',
    'No external libraries (only re, datetime)',
  ],
  date_range: {
    min: '1900-01-01',
    max: '2100-12-31',
  },
};

export const mockTasks: Task[] = [
  {
    id: 'task-001',
    name: 'Date Extraction Forensic Auditor',
    policy_json: defaultPolicy,
    created_at: '2026-01-30T08:00:00Z',
  },
];

export const mockJobs: Job[] = [
  {
    id: 'job-001',
    task_id: 'task-001',
    status: 'SETTLED',
    score: 0.98,
    iteration: 1,
    created_at: '2026-01-30T09:00:00Z',
    updated_at: '2026-01-30T09:05:00Z',
  },
  {
    id: 'job-002',
    task_id: 'task-001',
    status: 'REWARDED',
    score: 0.96,
    iteration: 1,
    created_at: '2026-01-30T10:00:00Z',
    updated_at: '2026-01-30T10:04:00Z',
  },
  {
    id: 'job-003',
    task_id: 'task-001',
    status: 'DROPPED',
    score: 0,
    iteration: 1,
    created_at: '2026-01-30T11:00:00Z',
    updated_at: '2026-01-30T11:02:00Z',
  },
  {
    id: 'job-004',
    task_id: 'task-001',
    status: 'JUDGED',
    score: 0.97,
    iteration: 1,
    created_at: '2026-01-30T12:00:00Z',
    updated_at: '2026-01-30T12:03:00Z',
  },
  {
    id: 'job-005',
    task_id: 'task-001',
    status: 'SANDBOX_RUNNING',
    score: null,
    iteration: 1,
    created_at: '2026-01-30T13:00:00Z',
    updated_at: '2026-01-30T13:01:00Z',
  },
];

export const mockSkepticTests: SkepticTest[] = [
  // AMBIGUITY - Kill Gate
  {
    id: 'test-amb-001',
    category: 'AMBIGUITY',
    input: '01/02/2024',
    expected_output: [],
    is_kill_gate: true,
    description: 'תאריך עמום (Ambiguous) - DD/MM או MM/DD',
  },
  {
    id: 'test-amb-002',
    category: 'AMBIGUITY',
    input: '12-05-2024',
    expected_output: [],
    is_kill_gate: true,
    description: 'פורמט לא תקני עם מקפים',
  },
  // INVALID_DATES - Kill Gate
  {
    id: 'test-inv-001',
    category: 'INVALID_DATES',
    input: '2024-02-30',
    expected_output: [],
    is_kill_gate: true,
    description: 'תאריך לא קיים - 30 בפברואר',
  },
  {
    id: 'test-inv-002',
    category: 'INVALID_DATES',
    input: '2024-13-01',
    expected_output: [],
    is_kill_gate: true,
    description: 'חודש לא חוקי - 13',
  },
  // MALFORMED_ISO - Kill Gate
  {
    id: 'test-mal-001',
    category: 'MALFORMED_ISO',
    input: '2024-1-15',
    expected_output: [],
    is_kill_gate: true,
    description: 'חודש חד-ספרתי במקום דו-ספרתי',
  },
  // BOUNDARY
  {
    id: 'test-bnd-001',
    category: 'BOUNDARY',
    input: '1900-01-01 and 2100-12-31',
    expected_output: ['1900-01-01', '2100-12-31'],
    is_kill_gate: false,
    description: 'גבולות טווח חוקיים',
  },
  {
    id: 'test-bnd-002',
    category: 'BOUNDARY',
    input: '1899-12-31',
    expected_output: [],
    is_kill_gate: false,
    description: 'מחוץ לטווח - לפני 1900',
  },
  // CONTEXT_NOISE
  {
    id: 'test-ctx-001',
    category: 'CONTEXT_NOISE',
    input: 'Meeting scheduled for 2024-03-15 at 10:00 AM in room A-2024-B',
    expected_output: ['2024-03-15'],
    is_kill_gate: false,
    description: 'תאריך בתוך טקסט עם רעש',
  },
  {
    id: 'test-ctx-002',
    category: 'CONTEXT_NOISE',
    input: 'Version 2024-01 released on 2024-01-20',
    expected_output: ['2024-01-20'],
    is_kill_gate: false,
    description: 'הבדלה בין מספר גרסה לתאריך',
  },
  // MULTI_DATES
  {
    id: 'test-mul-001',
    category: 'MULTI_DATES',
    input: 'From 2024-01-01 to 2024-12-31',
    expected_output: ['2024-01-01', '2024-12-31'],
    is_kill_gate: false,
    description: 'שני תאריכים חוקיים',
  },
  {
    id: 'test-mul-002',
    category: 'MULTI_DATES',
    input: '2024-01-01 2024-01-01 2024-01-02',
    expected_output: ['2024-01-01', '2024-01-02'],
    is_kill_gate: false,
    description: 'תאריכים כפולים - יש להחזיר ייחודיים',
  },
  // PERFORMANCE_GUARD
  {
    id: 'test-perf-001',
    category: 'PERFORMANCE_GUARD',
    input: 'x'.repeat(10000) + ' 2024-05-01 ' + 'y'.repeat(10000),
    expected_output: ['2024-05-01'],
    is_kill_gate: false,
    description: 'טקסט ארוך מאוד - בדיקת ביצועים',
  },
];

export const mockSolutionCode = `"""
Date Extraction Forensic Auditor
Extract ISO-8601 dates (YYYY-MM-DD) with strict validation.
"""
import re
from datetime import datetime
from typing import List

def extract_iso_dates(text: str) -> List[str]:
    """
    Extract valid ISO-8601 dates from text.
    
    Args:
        text: Input string to extract dates from
        
    Returns:
        List of unique valid dates in order of appearance
    """
    if text is None or text == "":
        return []
    
    # ISO-8601 pattern: YYYY-MM-DD
    pattern = r'\\b(\\d{4})-(\\d{2})-(\\d{2})\\b'
    matches = re.findall(pattern, text)
    
    seen = set()
    result = []
    
    for year, month, day in matches:
        date_str = f"{year}-{month}-{day}"
        
        # Skip duplicates
        if date_str in seen:
            continue
            
        # Validate year range
        year_int = int(year)
        if year_int < 1900 or year_int > 2100:
            continue
            
        # Validate date exists
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            continue
            
        seen.add(date_str)
        result.append(date_str)
    
    return result
`;

export const mockJudgeResult: JudgeResult = {
  job_id: 'job-001',
  passed: true,
  score: 0.98,
  kill_gate_triggered: false,
  category_scores: {
    AMBIGUITY: 1.0,
    INVALID_DATES: 1.0,
    MALFORMED_ISO: 1.0,
    BOUNDARY: 1.0,
    CONTEXT_NOISE: 0.95,
    MULTI_DATES: 1.0,
    PERFORMANCE_GUARD: 1.0,
  },
  total_tests: 12,
  passed_tests: 12,
  failed_tests: [],
};

export const mockTreasuryEntries: TreasuryEntry[] = [
  {
    id: 'treasury-001',
    asset: 'DTF-TOKEN',
    amount: 150.5,
    job_id: 'job-001',
    created_at: '2026-01-30T09:06:00Z',
  },
  {
    id: 'treasury-002',
    asset: 'DTF-TOKEN',
    amount: 125.0,
    job_id: 'job-002',
    created_at: '2026-01-30T10:05:00Z',
  },
];

export const mockDashboardStats: DashboardStats = {
  jobsToday: 5,
  passRate: 80,
  tokensEarned: 275.5,
  fpCriticalCount: 1,
  recentJobs: mockJobs.slice(0, 5),
  statusDistribution: {
    CREATED: 0,
    GENERATED: 0,
    TESTS_BUILT: 0,
    SANDBOX_RUNNING: 1,
    JUDGED: 1,
    READY_TO_SUBMIT: 0,
    SUBMITTED: 0,
    REWARDED: 1,
    TREASURY_UPDATED: 0,
    SETTLED: 1,
    FAILED: 0,
    DROPPED: 1,
  },
};

// Helper to get task by id
export const getTaskById = (id: string): Task | undefined => 
  mockTasks.find(t => t.id === id);

// Helper to get job by id
export const getJobById = (id: string): Job | undefined =>
  mockJobs.find(j => j.id === id);

// Helper to get jobs with tasks
export const getJobsWithTasks = (): Job[] =>
  mockJobs.map(job => ({
    ...job,
    task: getTaskById(job.task_id),
  }));
