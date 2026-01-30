/**
 * Database Layer - Supabase CRUD operations
 * Replaces mock data with real database queries
 */

import { supabase } from '@/integrations/supabase/client';
import type { Task, Job, Artifact, TreasuryEntry, AuditLog, DashboardStats, JobStatus, PolicySpec } from '@/types';
import type { Json } from '@/integrations/supabase/types';

// Helper to safely cast Json to PolicySpec
function parsePolicy(json: Json): PolicySpec {
  return json as unknown as PolicySpec;
}

// ==========================================
// TASKS
// ==========================================

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    policy_json: parsePolicy(row.policy_json),
    created_at: row.created_at,
  }));
}

export async function fetchTaskById(id: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) return null;
  
  return {
    id: data.id,
    name: data.name,
    policy_json: parsePolicy(data.policy_json),
    created_at: data.created_at,
  };
}

// ==========================================
// JOBS
// ==========================================

export async function fetchJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, tasks(*)')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    task_id: row.task_id,
    status: row.status as JobStatus,
    score: row.score ? Number(row.score) : null,
    iteration: row.iteration,
    created_at: row.created_at,
    updated_at: row.updated_at,
    task: row.tasks ? {
      id: row.tasks.id,
      name: row.tasks.name,
      policy_json: parsePolicy(row.tasks.policy_json),
      created_at: row.tasks.created_at,
    } : undefined,
  }));
}

export async function fetchJobById(id: string): Promise<Job | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, tasks(*)')
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) return null;
  
  return {
    id: data.id,
    task_id: data.task_id,
    status: data.status as JobStatus,
    score: data.score ? Number(data.score) : null,
    iteration: data.iteration,
    created_at: data.created_at,
    updated_at: data.updated_at,
    task: data.tasks ? {
      id: data.tasks.id,
      name: data.tasks.name,
      policy_json: parsePolicy(data.tasks.policy_json),
      created_at: data.tasks.created_at,
    } : undefined,
  };
}

export async function createJob(taskId: string): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      task_id: taskId,
      status: 'CREATED',
      iteration: 1,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    task_id: data.task_id,
    status: data.status as JobStatus,
    score: data.score ? Number(data.score) : null,
    iteration: data.iteration,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updateJobStatus(id: string, status: JobStatus, score?: number): Promise<void> {
  const updateData: { status: string; score?: number } = { status };
  if (score !== undefined) {
    updateData.score = score;
  }
  
  const { error } = await supabase
    .from('jobs')
    .update(updateData)
    .eq('id', id);
  
  if (error) throw error;
}

export async function fetchJobsToday(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const { count, error } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString());
  
  if (error) throw error;
  return count || 0;
}

// ==========================================
// ARTIFACTS
// ==========================================

export async function fetchArtifactsByJobId(jobId: string): Promise<Artifact[]> {
  const { data, error } = await supabase
    .from('artifacts')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    job_id: row.job_id,
    type: row.type as Artifact['type'],
    content: row.content,
    created_at: row.created_at,
  }));
}

export async function createArtifact(
  jobId: string, 
  type: Artifact['type'], 
  content: string
): Promise<Artifact> {
  const { data, error } = await supabase
    .from('artifacts')
    .insert({
      job_id: jobId,
      type,
      content,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    job_id: data.job_id || '',
    type: data.type as Artifact['type'],
    content: data.content,
    created_at: data.created_at,
  };
}

// ==========================================
// TREASURY
// ==========================================

export async function fetchTreasuryEntries(): Promise<TreasuryEntry[]> {
  const { data, error } = await supabase
    .from('treasury_ledger')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    asset: row.asset,
    amount: Number(row.amount),
    job_id: row.job_id,
    created_at: row.created_at,
  }));
}

export async function createTreasuryEntry(
  jobId: string,
  amount: number,
  asset: string = 'DTF-TOKEN'
): Promise<TreasuryEntry> {
  const { data, error } = await supabase
    .from('treasury_ledger')
    .insert({
      job_id: jobId,
      amount,
      asset,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    asset: data.asset,
    amount: Number(data.amount),
    job_id: data.job_id || '',
    created_at: data.created_at,
  };
}

export async function fetchTotalTokens(): Promise<number> {
  const { data, error } = await supabase
    .from('treasury_ledger')
    .select('amount');
  
  if (error) throw error;
  
  return (data || []).reduce((sum, row) => sum + Number(row.amount), 0);
}

// ==========================================
// AUDIT LOGS
// ==========================================

export async function fetchAuditLogsByJobId(jobId: string): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    job_id: row.job_id,
    action: row.action,
    metadata: row.metadata as Record<string, unknown>,
    created_at: row.created_at,
  }));
}

export async function createAuditLog(
  jobId: string,
  action: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from('audit_logs')
    .insert({
      job_id: jobId,
      action,
      metadata: metadata as Json,
    });
  
  if (error) throw error;
}

// ==========================================
// DASHBOARD STATS
// ==========================================

export async function fetchDashboardStats(): Promise<DashboardStats> {
  // Fetch all required data in parallel
  const [jobsResult, treasuryResult] = await Promise.all([
    supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('treasury_ledger')
      .select('amount'),
  ]);
  
  if (jobsResult.error) throw jobsResult.error;
  if (treasuryResult.error) throw treasuryResult.error;
  
  const jobs = jobsResult.data || [];
  const treasury = treasuryResult.data || [];
  
  // Calculate stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const jobsToday = jobs.filter(j => new Date(j.created_at) >= today).length;
  const passedJobs = jobs.filter(j => ['SETTLED', 'REWARDED', 'TREASURY_UPDATED'].includes(j.status)).length;
  const passRate = jobs.length > 0 ? Math.round((passedJobs / jobs.length) * 100) : 0;
  const tokensEarned = treasury.reduce((sum, t) => sum + Number(t.amount), 0);
  const fpCriticalCount = jobs.filter(j => j.status === 'DROPPED').length;
  
  // Status distribution
  const statusDistribution: Record<JobStatus, number> = {
    CREATED: 0,
    GENERATED: 0,
    TESTS_BUILT: 0,
    SANDBOX_RUNNING: 0,
    JUDGED: 0,
    READY_TO_SUBMIT: 0,
    SUBMITTED: 0,
    REWARDED: 0,
    TREASURY_UPDATED: 0,
    SETTLED: 0,
    FAILED: 0,
    DROPPED: 0,
  };
  
  for (const job of jobs) {
    const status = job.status as JobStatus;
    if (status in statusDistribution) {
      statusDistribution[status]++;
    }
  }
  
  const recentJobs: Job[] = jobs.slice(0, 5).map(row => ({
    id: row.id,
    task_id: row.task_id,
    status: row.status as JobStatus,
    score: row.score ? Number(row.score) : null,
    iteration: row.iteration,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
  
  return {
    jobsToday,
    passRate,
    tokensEarned,
    fpCriticalCount,
    recentJobs,
    statusDistribution,
  };
}
