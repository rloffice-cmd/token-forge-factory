import { AppLayout } from '@/components/AppLayout';
import { TreasuryView } from '@/components/TreasuryView';
import { mockTreasuryEntries } from '@/data/mockData';

export default function Treasury() {
  return (
    <AppLayout>
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">קופה</h1>
          <p className="text-muted-foreground mt-1">
            ניהול יתרות וטוקנים שנצברו
          </p>
        </div>
        
        <TreasuryView entries={mockTreasuryEntries} />
      </div>
    </AppLayout>
  );
}
