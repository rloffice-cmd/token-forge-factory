import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { JobDetails } from '@/components/JobDetails';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { getJobById } from '@/data/mockData';

export default function JobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const job = getJobById(id || '');

  if (!job) {
    return (
      <AppLayout>
        <div className="p-8 flex flex-col items-center justify-center min-h-[50vh]">
          <h1 className="text-2xl font-bold mb-4">ג׳וב לא נמצא</h1>
          <p className="text-muted-foreground mb-6">
            לא נמצא ג׳וב עם המזהה {id}
          </p>
          <Button asChild>
            <Link to="/jobs">
              <ArrowRight className="w-4 h-4 ml-2" />
              חזרה לרשימת הג׳ובים
            </Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link 
            to="/jobs" 
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ArrowRight className="w-4 h-4" />
            חזרה לג׳ובים
          </Link>
        </div>
        
        <JobDetails job={job} />
      </div>
    </AppLayout>
  );
}
