/**
 * Hook to run the factory pipeline
 */

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { runPipeline, type PipelineResult } from '@/workers/pipeline';
import { useToast } from '@/hooks/use-toast';
import * as db from '@/lib/database';
import type { Job, Task, JobStatus, AuditLog } from '@/types';

export function useRunPipeline() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<JobStatus | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const run = useCallback(async (taskId: string): Promise<PipelineResult | null> => {
    setIsRunning(true);
    setProgress([]);
    setCurrentStatus('CREATED');

    try {
      // Create job in database
      const job = await db.createJob(taskId);
      
      // Fetch task
      const task = await db.fetchTaskById(taskId);
      if (!task) {
        throw new Error('Task not found');
      }

      // Run pipeline with callbacks
      const result = await runPipeline(job, task, {
        onStatusChange: (jobId, status) => {
          setCurrentStatus(status);
          setProgress(prev => [...prev, `סטטוס: ${status}`]);
        },
        onLog: (log: AuditLog) => {
          setProgress(prev => [...prev, `${log.action}`]);
        },
        onNotification: (title, message) => {
          toast({ title, description: message });
        },
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['treasury'] });

      if (result.error) {
        toast({
          title: 'שגיאה בהרצה',
          description: result.error,
          variant: 'destructive',
        });
      } else if (result.judgeResult?.passed) {
        toast({
          title: '✅ הג׳וב הושלם בהצלחה!',
          description: `ציון: ${(result.judgeResult.score * 100).toFixed(0)}%`,
        });
      } else if (result.judgeResult?.kill_gate_triggered) {
        toast({
          title: '⚠️ Kill Gate הופעל',
          description: result.judgeResult.kill_gate_reason?.slice(0, 100),
          variant: 'destructive',
        });
      }

      return result;

    } catch (error) {
      const message = error instanceof Error ? error.message : 'שגיאה לא ידועה';
      toast({
        title: 'שגיאה',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsRunning(false);
      setCurrentStatus(null);
    }
  }, [queryClient, toast]);

  return {
    run,
    isRunning,
    currentStatus,
    progress,
  };
}
