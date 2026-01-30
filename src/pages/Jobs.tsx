import { AppLayout } from '@/components/AppLayout';
import { JobsList } from '@/components/JobsList';
import { getJobsWithTasks } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';

export default function Jobs() {
  const jobs = getJobsWithTasks();
  const { toast } = useToast();

  const handleCreateJob = () => {
    toast({
      title: 'ג׳וב חדש',
      description: 'יצירת ג׳וב חדש... (MOCK)',
    });
  };

  const handleRunFactory = () => {
    toast({
      title: 'Factory מופעל',
      description: 'מריץ את כל הג׳ובים הממתינים... (MOCK)',
    });
  };

  return (
    <AppLayout>
      <div className="p-8">
        <JobsList 
          jobs={jobs} 
          onCreateJob={handleCreateJob}
          onRunFactory={handleRunFactory}
        />
      </div>
    </AppLayout>
  );
}
