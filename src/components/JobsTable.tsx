import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { ArrowUpLeft, Clock, Percent } from 'lucide-react';
import type { Job } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

interface JobsTableProps {
  jobs: Job[];
}

export const JobsTable = forwardRef<HTMLDivElement, JobsTableProps>(function JobsTable({ jobs }, ref) {
  return (
    <Card ref={ref} className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">ג׳ובים אחרונים</CardTitle>
        <Link 
          to="/jobs" 
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          הצג הכל
          <ArrowUpLeft className="w-4 h-4" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="block p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="font-mono text-sm text-muted-foreground">
                    {job.id}
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                  {job.score !== null && (
                    <div className="flex items-center gap-1">
                      <Percent className="w-4 h-4" />
                      <span>{(job.score * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>
                      {formatDistanceToNow(new Date(job.created_at), {
                        addSuffix: true,
                        locale: he,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});
