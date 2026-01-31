/**
 * Money Machine Dashboard - Remote Control View
 * צפייה וניהול של מכונת הכסף האוטונומית
 */

import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  TrendingUp, 
  Wallet, 
  Users, 
  Zap,
  Clock,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Settings,
  ExternalLink,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { he } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface MachineStats {
  totalRevenue: number;
  todayRevenue: number;
  totalCustomers: number;
  totalJobs: number;
  successRate: number;
  pendingPayouts: number;
  lastPayout: string | null;
  isRunning: boolean;
}

export default function MoneyMachine() {
  const navigate = useNavigate();

  // Fetch machine stats
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['money-machine-stats'],
    queryFn: async (): Promise<MachineStats> => {
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();

      // Parallel fetches for efficiency
      const [
        ledgerTotal,
        ledgerToday,
        customers,
        jobs,
        settledJobs,
        pendingPayouts,
        lastPayout,
        runningJobs,
      ] = await Promise.all([
        // Total revenue
        supabase.from('treasury_ledger').select('amount').eq('direction', 'IN'),
        // Today revenue
        supabase.from('treasury_ledger').select('amount').eq('direction', 'IN')
          .gte('created_at', todayStart).lte('created_at', todayEnd),
        // Customers
        supabase.from('users_customers').select('id', { count: 'exact', head: true }),
        // Total jobs
        supabase.from('jobs').select('id', { count: 'exact', head: true }),
        // Settled jobs
        supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'SETTLED'),
        // Pending payouts
        supabase.from('cashout_requests').select('amount_usd').eq('status', 'pending'),
        // Last payout
        supabase.from('cashout_requests').select('confirmed_at').eq('status', 'confirmed')
          .order('confirmed_at', { ascending: false }).limit(1).maybeSingle(),
        // Running jobs
        supabase.from('jobs').select('id')
          .in('status', ['CREATED', 'GENERATED', 'TESTS_BUILT', 'SANDBOX_RUNNING']),
      ]);

      const totalRevenue = (ledgerTotal.data || []).reduce((sum, r) => sum + Number(r.amount), 0);
      const todayRevenue = (ledgerToday.data || []).reduce((sum, r) => sum + Number(r.amount), 0);
      const totalCustomers = customers.count || 0;
      const totalJobs = jobs.count || 0;
      const settled = settledJobs.count || 0;
      const successRate = totalJobs > 0 ? Math.round((settled / totalJobs) * 100) : 0;
      const pending = (pendingPayouts.data || []).reduce((sum, r) => sum + Number(r.amount_usd), 0);
      const isRunning = (runningJobs.data || []).length > 0;

      return {
        totalRevenue,
        todayRevenue,
        totalCustomers,
        totalJobs,
        successRate,
        pendingPayouts: pending,
        lastPayout: lastPayout.data?.confirmed_at || null,
        isRunning,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch recent transactions
  const { data: recentTransactions } = useQuery({
    queryKey: ['recent-transactions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('treasury_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Fetch system health
  const { data: systemHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const oneDayAgo = subDays(new Date(), 1).toISOString();
      
      const [stuckJobs, recentErrors] = await Promise.all([
        supabase.from('jobs')
          .select('id', { count: 'exact', head: true })
          .in('status', ['CREATED', 'GENERATED', 'TESTS_BUILT', 'SANDBOX_RUNNING'])
          .lt('created_at', oneDayAgo),
        supabase.from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('action', 'pipeline_error')
          .gte('created_at', oneDayAgo),
      ]);

      return {
        stuckJobs: stuckJobs.count || 0,
        recentErrors: recentErrors.count || 0,
        isHealthy: (stuckJobs.count || 0) === 0 && (recentErrors.count || 0) < 5,
      };
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[50vh]">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Zap className="w-8 h-8 text-primary" />
              Money Machine
            </h1>
            <p className="text-muted-foreground mt-1">
              מכונת הכסף האוטונומית - צפייה וניהול מרחוק
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant={stats?.isRunning ? 'default' : 'secondary'}
              className={stats?.isRunning ? 'bg-success animate-pulse' : ''}
            >
              {stats?.isRunning ? (
                <>
                  <Activity className="w-3 h-3 mr-1" />
                  פעילה
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3 mr-1" />
                  ממתינה
                </>
              )}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* System Health Banner */}
        {systemHealth && !systemHealth.isHealthy && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <span className="font-medium">
                    נמצאו בעיות: {systemHealth.stuckJobs} ג'ובים תקועים, {systemHealth.recentErrors} שגיאות
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/system')}>
                  צפה בפרטים
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Revenue */}
          <Card className="glass-card glow-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">הכנסות כוללות</p>
                  <p className="text-3xl font-bold text-primary">
                    ${stats?.totalRevenue.toFixed(2)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-success">
                <ArrowUpRight className="w-4 h-4 mr-1" />
                <span>+${stats?.todayRevenue.toFixed(2)} היום</span>
              </div>
            </CardContent>
          </Card>

          {/* Customers */}
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">לקוחות</p>
                  <p className="text-3xl font-bold">{stats?.totalCustomers}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-info/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-info" />
                </div>
              </div>
              <div className="mt-4">
                <Button variant="ghost" size="sm" className="p-0 h-auto text-sm" onClick={() => window.open('/landing', '_blank')}>
                  <ExternalLink className="w-3 h-3 mr-1" />
                  צפה בדף הנחיתה
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Jobs */}
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ג'ובים</p>
                  <p className="text-3xl font-bold">{stats?.totalJobs}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-success" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>אחוז הצלחה</span>
                  <span className="font-medium">{stats?.successRate}%</span>
                </div>
                <Progress value={stats?.successRate} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Pending Payouts */}
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ממתין למשיכה</p>
                  <p className="text-3xl font-bold">${stats?.pendingPayouts.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-warning" />
                </div>
              </div>
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={() => navigate('/treasury')}>
                  נהל משיכות
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transactions */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                עסקאות אחרונות
              </CardTitle>
              <CardDescription>
                תשלומים נכנסים ויוצאים
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentTransactions && recentTransactions.length > 0 ? (
                <div className="space-y-3">
                  {recentTransactions.map((tx) => (
                    <div 
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.direction === 'IN' ? 'bg-success/20' : 'bg-destructive/20'
                        }`}>
                          {tx.direction === 'IN' ? (
                            <ArrowUpRight className="w-4 h-4 text-success" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-destructive" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {tx.direction === 'IN' ? 'תשלום נכנס' : 'משיכה'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.created_at), 'dd/MM HH:mm', { locale: he })}
                          </p>
                        </div>
                      </div>
                      <div className={`font-bold ${
                        tx.direction === 'IN' ? 'text-success' : 'text-destructive'
                      }`}>
                        {tx.direction === 'IN' ? '+' : '-'}${Number(tx.amount_usd || tx.amount).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  אין עסקאות עדיין
                </p>
              )}
            </CardContent>
          </Card>

          {/* Machine Status */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                סטטוס המכונה
              </CardTitle>
              <CardDescription>
                מצב הרכיבים והתהליכים
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Component Status List */}
                <div className="space-y-3">
                  <StatusRow 
                    label="דף נחיתה (Landing Page)" 
                    status="active" 
                    detail="/landing"
                  />
                  <StatusRow 
                    label="עיבוד תשלומים (Coinbase)" 
                    status="active" 
                    detail="Webhook פעיל"
                  />
                  <StatusRow 
                    label="Pipeline אוטומטי" 
                    status="active" 
                    detail="pg_cron כל דקה"
                  />
                  <StatusRow 
                    label="Daily Sweep" 
                    status="active" 
                    detail="07:00 UTC"
                  />
                  <StatusRow 
                    label="התראות טלגרם" 
                    status="active" 
                    detail="תשלומים + דו״ח יומי"
                  />
                </div>

                {/* Quick Actions */}
                <div className="pt-4 border-t border-border space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/settings')}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    הגדרות משיכה אוטומטית
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/system')}
                  >
                    <Activity className="w-4 h-4 mr-2" />
                    דשבורד מערכת
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

// Status Row Component
function StatusRow({ 
  label, 
  status, 
  detail 
}: { 
  label: string; 
  status: 'active' | 'warning' | 'error'; 
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${
          status === 'active' ? 'bg-success animate-pulse' :
          status === 'warning' ? 'bg-warning' : 'bg-destructive'
        }`} />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}
