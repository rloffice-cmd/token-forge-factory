import { forwardRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { JobStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusChartProps {
  distribution: Record<JobStatus, number>;
}

const statusColors: Record<JobStatus, string> = {
  CREATED: 'bg-muted',
  GENERATED: 'bg-info',
  TESTS_BUILT: 'bg-info',
  SANDBOX_RUNNING: 'bg-warning',
  JUDGED: 'bg-success',
  READY_TO_SUBMIT: 'bg-success',
  SUBMITTED: 'bg-success',
  REWARDED: 'bg-primary',
  TREASURY_UPDATED: 'bg-primary',
  SETTLED: 'bg-primary',
  FAILED: 'bg-destructive',
  DROPPED: 'bg-destructive/70',
};

const statusLabels: Record<JobStatus, string> = {
  CREATED: 'נוצר',
  GENERATED: 'נוצר קוד',
  TESTS_BUILT: 'טסטים',
  SANDBOX_RUNNING: 'רץ',
  JUDGED: 'נשפט',
  READY_TO_SUBMIT: 'מוכן',
  SUBMITTED: 'הוגש',
  REWARDED: 'תוגמל',
  TREASURY_UPDATED: 'קופה',
  SETTLED: 'הושלם',
  FAILED: 'נכשל',
  DROPPED: 'נדחה',
};

export const StatusChart = forwardRef<HTMLDivElement, StatusChartProps>(
  ({ distribution }, ref) => {
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    const activeStatuses = Object.entries(distribution).filter(([, count]) => count > 0);

    return (
      <Card ref={ref} className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">התפלגות סטטוסים</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Bar chart */}
          {total > 0 ? (
            <div className="h-8 rounded-lg overflow-hidden flex">
              {activeStatuses.map(([status, count]) => {
                const percentage = (count / total) * 100;
                return (
                  <div
                    key={status}
                    className={cn(statusColors[status as JobStatus], 'transition-all duration-300')}
                    style={{ width: `${percentage}%` }}
                    title={`${statusLabels[status as JobStatus]}: ${count}`}
                  />
                );
              })}
            </div>
          ) : (
            <div className="h-8 rounded-lg bg-muted flex items-center justify-center">
              <span className="text-sm text-muted-foreground">אין ג׳ובים עדיין</span>
            </div>
          )}

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4">
            {activeStatuses.map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={cn('w-3 h-3 rounded-full', statusColors[status as JobStatus])} />
                <span className="text-sm text-muted-foreground">
                  {statusLabels[status as JobStatus]} ({count})
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
);

StatusChart.displayName = 'StatusChart';
