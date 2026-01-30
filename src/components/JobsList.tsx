import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Plus, Play, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Job } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

interface JobsListProps {
  jobs: Job[];
  onCreateJob: () => void;
  onRunFactory: () => void;
}

export function JobsList({ jobs, onCreateJob, onRunFactory }: JobsListProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ג׳ובים</h1>
          <p className="text-muted-foreground">ניהול והרצת עבודות Factory</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCreateJob}>
            <Plus className="w-4 h-4 ml-2" />
            ג׳וב חדש
          </Button>
          <Button onClick={onRunFactory}>
            <Play className="w-4 h-4 ml-2" />
            Run Factory
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="חיפוש לפי ID..." 
            className="pr-10 bg-muted/30 border-muted"
          />
        </div>
        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4 ml-2" />
          סינון
        </Button>
      </div>

      {/* Jobs list */}
      <div className="grid gap-3">
        {jobs.map((job) => (
          <Link
            key={job.id}
            to={`/jobs/${job.id}`}
            className="block p-6 rounded-xl bg-card/50 border border-border/50 hover:bg-card hover:border-primary/30 transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <p className="font-mono font-semibold">{job.id}</p>
                  <p className="text-sm text-muted-foreground">
                    איטרציה {job.iteration}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>
              
              <div className="flex items-center gap-8 text-sm">
                {job.score !== null && (
                  <div className="text-left">
                    <p className="text-muted-foreground">ציון</p>
                    <p className="font-bold text-lg">
                      {(job.score * 100).toFixed(0)}%
                    </p>
                  </div>
                )}
                <div className="text-left">
                  <p className="text-muted-foreground">נוצר</p>
                  <p>
                    {formatDistanceToNow(new Date(job.created_at), {
                      addSuffix: true,
                      locale: he,
                    })}
                  </p>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
