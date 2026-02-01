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

export function JobsTable({ jobs }: JobsTableProps) {
  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between p-4 lg:p-6">
        <CardTitle className="text-base lg:text-lg">ג׳ובים אחרונים</CardTitle>
        <Link 
          to="/jobs" 
          className="text-xs lg:text-sm text-primary hover:underline flex items-center gap-1"
        >
          הצג הכל
          <ArrowUpLeft className="w-3 h-3 lg:w-4 lg:h-4" />
        </Link>
      </CardHeader>
      <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
        <div className="space-y-2 lg:space-y-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="block p-3 lg:p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              {/* Mobile layout - stacked */}
              <div className="flex flex-col gap-2 sm:hidden">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                    {job.id.slice(0, 8)}...
                  </div>
                  <StatusBadge status={job.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {job.score !== null && (
                    <div className="flex items-center gap-1">
                      <Percent className="w-3 h-3" />
                      <span>{(job.score * 100).toFixed(0)}%</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {formatDistanceToNow(new Date(job.created_at), {
                        addSuffix: true,
                        locale: he,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Desktop layout - horizontal */}
              <div className="hidden sm:flex items-center justify-between">
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

          {jobs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              אין ג׳ובים להצגה
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
