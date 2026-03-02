import { AppLayout } from '@/components/AppLayout';
import { JobsList } from '@/components/JobsList';
import { useJobs, useCreateJob } from '@/hooks/useDatabase';
import { useRunPipeline } from '@/hooks/useRunPipeline';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';

// Default task ID for Date Extraction Forensic Auditor
const DEFAULT_TASK_ID = 'a0000000-0000-0000-0000-000000000001';

export default function Jobs() {
  const { data: jobs, isLoading, error } = useJobs();
  const createJobMutation = useCreateJob();
  const { run: runPipeline, isRunning, currentStatus, progress } = useRunPipeline();
  const { toast } = useToast();
  const [showProgress, setShowProgress] = useState(false);

  const handleCreateJob = async () => {
    try {
      const newJob = await createJobMutation.mutateAsync(DEFAULT_TASK_ID);
      toast({
        title: 'ג׳וב נוצר',
        description: `נוצר ג׳וב חדש: ${newJob.id.slice(0, 8)}...`,
      });
    } catch (err) {
      toast({
        title: 'שגיאה',
        description: 'לא ניתן ליצור ג׳וב חדש',
        variant: 'destructive',
      });
    }
  };

  const handleRunFactory = async () => {
    setShowProgress(true);
    await runPipeline(DEFAULT_TASK_ID);
    setShowProgress(false);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="text-center text-destructive">
            שגיאה בטעינת נתונים: {error.message}
          </div>
        </div>
      </AppLayout>
    );
  }

  // Calculate progress percentage based on status
  const statusOrder = [
    'CREATED', 'GENERATED', 'TESTS_BUILT', 'SANDBOX_RUNNING', 
    'JUDGED', 'READY_TO_SUBMIT', 'SUBMITTED', 'REWARDED', 
    'TREASURY_UPDATED', 'SETTLED'
  ];
  const progressPercent = currentStatus 
    ? ((statusOrder.indexOf(currentStatus) + 1) / statusOrder.length) * 100
    : 0;

  return (
    <AppLayout>
      <div className="p-8">
        <JobsList 
          jobs={jobs || []} 
          onCreateJob={handleCreateJob}
          onRunFactory={handleRunFactory}
        />
      </div>

      {/* Progress Dialog */}
      <Dialog open={showProgress} onOpenChange={setShowProgress}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>מריץ Factory...</DialogTitle>
            <DialogDescription>
              {currentStatus && `סטטוס נוכחי: ${currentStatus}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Progress value={progressPercent} className="h-2" />
            
            <div className="max-h-48 overflow-y-auto bg-muted/50 rounded-lg p-3">
              {progress.map((line, i) => (
                <div key={i} className="text-xs font-mono text-muted-foreground py-0.5">
                  {line}
                </div>
              ))}
              {isRunning && (
                <div className="flex items-center gap-2 text-xs text-primary py-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  מעבד...
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
 