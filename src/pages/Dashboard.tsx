import { AppLayout } from '@/components/AppLayout';
import { StatCard } from '@/components/StatCard';
import { JobsTable } from '@/components/JobsTable';
import { StatusChart } from '@/components/StatusChart';
import { FileCode2, Percent, Coins, AlertTriangle } from 'lucide-react';
import { mockDashboardStats } from '@/data/mockData';

export default function Dashboard() {
  const stats = mockDashboardStats;

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">דשבורד</h1>
          <p className="text-muted-foreground mt-1">
            סקירה כללית של מערכת Data-to-Token Factory
          </p>
        </div>

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
            trend={{ value: 5, isPositive: true }}
          />
          <StatCard
            title="טוקנים שנצברו"
            value={stats.tokensEarned.toFixed(1)}
            subtitle="DTF (MOCK)"
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
