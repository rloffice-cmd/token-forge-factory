import { AppLayout } from '@/components/AppLayout';
import { TreasuryView } from '@/components/TreasuryView';
import { useTreasuryEntries } from '@/hooks/useDatabase';
import { Loader2 } from 'lucide-react';

export default function Treasury() {
  const { data: entries, isLoading, error } = useTreasuryEntries();

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

  return (
    <AppLayout>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">קופה</h1>
          <p className="text-muted-foreground mt-1">
            ניהול יתרות וטוקנים שנצברו
          </p>
        </div>
        
        <TreasuryView entries={entries || []} />
      </div>
    </AppLayout>
  );
}
