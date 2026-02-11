import { AppLayout } from '@/components/AppLayout';
import { StatCard } from '@/components/StatCard';
import { JobsTable } from '@/components/JobsTable';
import { StatusChart } from '@/components/StatusChart';
import { ActivationChecklist } from '@/components/ActivationChecklist';
import { FileCode2, Percent, Coins, AlertTriangle, Loader2, Radio, Clock } from 'lucide-react';
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

  // Check ZeroDev status from Edge Function
  const { data: hasZeroDev } = useQuery({
    queryKey: ['zerodev-check'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('zerodev-status');
        if (error) return false;
        return data?.status === 'active';
      } catch {
        return false;
      }
    },
    staleTime: 60000, // Cache for 1 minute
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 lg:p-8 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-4 lg:p-8">
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
        <div className="p-4 lg:p-8">
          <div className="text-center text-muted-foreground">
            אין נתונים להצגה
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">דשבורד</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            סקירה כללית של מערכת Token Forge Factory
          </p>
        </div>

        {/* Partial Launch Banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-3">
          <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
          <div className="flex-1">
            <h3 className="font-semibold text-emerald-400">🚀 Partial Launch: Woodpecker Engine Active | Others Queued</h3>
            <p className="text-sm text-muted-foreground">
              Signal scanning active. Brain matching all leads. Outreach dispatching for Woodpecker only — other partners on standby.
            </p>
          </div>
          <Clock className="w-5 h-5 text-emerald-500/50" />
        </div>

        {/* Activation Checklist */}
        <ActivationChecklist 
          hasCoinbaseKey={true}
          hasCoinbaseWebhook={true}
          hasPayoutWallet={hasPayoutWallet || false}
          hasTelegram={true}
          hasZeroDev={hasZeroDev || false}
          hasTestPassed={false}
          hasFirstPayment={hasFirstPayment || false}
        />

        {/* Stats grid - 2 columns on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
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

        {/* Charts and table - stack on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <JobsTable jobs={stats.recentJobs} />
          </div>
          <div className="order-1 lg:order-2">
            <StatusChart distribution={stats.statusDistribution} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
