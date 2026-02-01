import { AppLayout } from '@/components/AppLayout';
import { StatCard } from '@/components/StatCard';
import { JobsTable } from '@/components/JobsTable';
import { StatusChart } from '@/components/StatusChart';
import { ActivationChecklist } from '@/components/ActivationChecklist';
import { FileCode2, Percent, Coins, AlertTriangle, Loader2 } from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDatabase';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { data: stats, isLoading, error } = useDashboardStats();

  // Check for first confirmed payment
  const { data: hasFirstPayment } = useQuery({
    queryKey: ['first-payment-check'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('id')
        .eq('status', 'confirmed')
        .limit(1)
        .maybeSingle();
      
      return !!data;
    },
  });

  // Check payout wallet configuration
  const { data: hasPayoutWallet } = useQuery({
    queryKey: ['payout-wallet-check'],
    queryFn: async () => {
      // Check treasury_settings first
      const { data: treasuryData } = await supabase
        .from('treasury_settings')
        .select('payout_wallet_address')
        .limit(1)
        .maybeSingle();
      
      if (treasuryData?.payout_wallet_address) return true;
      
      // Fallback to brain_settings
      const { data: brainData } = await supabase
        .from('brain_settings')
        .select('payout_wallet_address')
        .limit(1)
        .maybeSingle();
      
      return !!(brainData?.payout_wallet_address);
    },
  });

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

  if (!stats) {
    return (
      <AppLayout>
        <div className="p-8">
          <div className="text-center text-muted-foreground">
            אין נתונים להצגה
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">דשבורד</h1>
          <p className="text-muted-foreground mt-1">
            סקירה כללית של מערכת Token Forge Factory
          </p>
        </div>

        {/* Activation Checklist */}
        <ActivationChecklist 
          hasCoinbaseKey={true}
          hasCoinbaseWebhook={true}
          hasPayoutWallet={hasPayoutWallet || false}
          hasTelegram={true}
          hasZeroDev={false}
          hasTestPassed={false}
          hasFirstPayment={hasFirstPayment || false}
        />

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="ג׳ובים היום"
            value={stats.jobsToday}
            subtitle="משימות שהורצו"
            icon={FileCode2}
            variant="default"
          />
          <StatCard
            title="אחוז הצלחה"
            value={`${stats.passRate}%`}
            subtitle="מכל הג׳ובים"
            icon={Percent}
            variant="success"
          />
          <StatCard
            title="טוקנים שנצברו"
            value={stats.tokensEarned.toFixed(1)}
            subtitle="DTF"
            icon={Coins}
            variant="default"
          />
          <StatCard
            title="FP קריטיים"
            value={stats.fpCriticalCount}
            subtitle="Kill Gate הופעלו"
            icon={AlertTriangle}
            variant={stats.fpCriticalCount > 0 ? 'danger' : 'success'}
          />
        </div>

        {/* Charts and table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <JobsTable jobs={stats.recentJobs} />
          </div>
          <div>
            <StatusChart distribution={stats.statusDistribution} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
