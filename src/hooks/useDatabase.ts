/**
 * React hooks for database operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as db from '@/lib/database';
import type { JobStatus, Artifact } from '@/types';

// ==========================================
// TASKS
// ==========================================

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: db.fetchTasks,
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: () => db.fetchTaskById(id),
    enabled: !!id,
  });
}

// ==========================================
// JOBS
// ==========================================

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: db.fetchJobs,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => db.fetchJobById(id),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (taskId: string) => db.createJob(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateJobStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status, score }: { id: string; status: JobStatus; score?: number }) =>
      db.updateJobStatus(id, status, score),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ==========================================
// ARTIFACTS
// ==========================================

export function useArtifacts(jobId: string) {
  return useQuery({
    queryKey: ['artifacts', jobId],
    queryFn: () => db.fetchArtifactsByJobId(jobId),
    enabled: !!jobId,
  });
}

export function useCreateArtifact() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ jobId, type, content }: { jobId: string; type: Artifact['type']; content: string }) =>
      db.createArtifact(jobId, type, content),
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['artifacts', jobId] });
    },
  });
}

// ==========================================
// TREASURY
// ==========================================

export function useTreasuryEntries() {
  return useQuery({
    queryKey: ['treasury'],
    queryFn: db.fetchTreasuryEntries,
  });
}

export function useCreateTreasuryEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ jobId, amount, asset }: { jobId: string; amount: number; asset?: string }) =>
      db.createTreasuryEntry(jobId, amount, asset),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ==========================================
// AUDIT LOGS
// ==========================================

export function useAuditLogs(jobId: string) {
  return useQuery({
    queryKey: ['audit-logs', jobId],
    queryFn: () => db.fetchAuditLogsByJobId(jobId),
    enabled: !!jobId,
  });
}

export function useCreateAuditLog() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ jobId, action, metadata }: { jobId: string; action: string; metadata?: Record<string, unknown> }) =>
      db.createAuditLog(jobId, action, metadata),
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs', jobId] });
    },
  });
}

// ==========================================
// DASHBOARD
// ==========================================

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: db.fetchDashboardStats,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
