import { cn } from '@/lib/utils';
import type { JobStatus } from '@/types';

interface StatusBadgeProps {
  status: JobStatus;
  className?: string;
}

const statusConfig: Record<JobStatus, { label: string; className: string }> = {
  CREATED: { label: 'נוצר', className: 'status-created' },
  GENERATED: { label: 'קוד נוצר', className: 'status-generated' },
  TESTS_BUILT: { label: 'טסטים נבנו', className: 'status-generated' },
  SANDBOX_RUNNING: { label: 'רץ בסנדבוקס', className: 'status-running' },
  JUDGED: { label: 'נשפט', className: 'status-passed' },
  READY_TO_SUBMIT: { label: 'מוכן להגשה', className: 'status-passed' },
  SUBMITTED: { label: 'הוגש', className: 'status-passed' },
  REWARDED: { label: 'תוגמל', className: 'status-rewarded' },
  TREASURY_UPDATED: { label: 'קופה עודכנה', className: 'status-rewarded' },
  SETTLED: { label: 'הושלם', className: 'status-rewarded' },
  FAILED: { label: 'נכשל', className: 'status-failed' },
  DROPPED: { label: 'נדחה', className: 'status-dropped' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={cn('status-badge', config.className, className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-glow" />
      {config.label}
    </span>
  );
}
