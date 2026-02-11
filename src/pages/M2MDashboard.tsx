/**
 * M2M PPL Dashboard — Pay-Per-Lead Engine Command Center
 * Glassmorphism dark-mode dashboard for tracking bounties, signal efficiency, and partner performance.
 */

import { AppLayout } from '@/components/AppLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  Target,
  TrendingUp,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  Shield,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface PartnerRow {
  id: string;
  name: string;
  commission_rate: number;
  total_dispatches: number;
  total_conversions: number;
  total_revenue_usd: number;
  category_tags: string[];
  is_active: boolean;
}

interface LedgerRow {
  id: string;
  status: string;
  estimated_bounty_usd: number;
  actual_revenue_usd: number;
  dispatched_at: string;
  confirmed_at: string | null;
  partner_id: string;
}

const CHART_COLORS = [
  'hsl(142, 71%, 45%)',
  'hsl(199, 89%, 48%)',
  'hsl(262, 83%, 58%)',
  'hsl(47, 96%, 53%)',
  'hsl(346, 87%, 56%)',
  'hsl(174, 72%, 40%)',
  'hsl(24, 95%, 53%)',
  'hsl(290, 65%, 55%)',
];

export default function M2MDashboard() {
  const { data: partners = [] } = useQuery<PartnerRow[]>({
    queryKey: ['m2m-partners'],
    queryFn: async () => {
      const { data } = await supabase
        .from('m2m_partners')
        .select('id, name, commission_rate, total_dispatches, total_conversions, total_revenue_usd, category_tags, is_active')
        .eq('is_active', true)
        .order('total_revenue_usd', { ascending: false });
      return (data as any[]) || [];
    },
  });

  const { data: ledger = [] } = useQuery<LedgerRow[]>({
    queryKey: ['m2m-ledger-recent'],
    queryFn: async () => {
      const { data } = await supabase
        .from('m2m_ledger')
        .select('id, status, estimated_bounty_usd, actual_revenue_usd, dispatched_at, confirmed_at, partner_id')
        .order('created_at', { ascending: false })
        .limit(200);
      return (data as any[]) || [];
    },
  });

  // Aggregate metrics
  const totalDispatches = partners.reduce((s, p) => s + (p.total_dispatches || 0), 0);
  const totalConversions = partners.reduce((s, p) => s + (p.total_conversions || 0), 0);
  const totalRevenue = partners.reduce((s, p) => s + Number(p.total_revenue_usd || 0), 0);

  const potentialRevenue = ledger
    .filter((l) => l.status === 'dispatched')
    .reduce((s, l) => s + Number(l.estimated_bounty_usd || 0), 0);
  const confirmedRevenue = ledger
    .filter((l) => l.status === 'confirmed')
    .reduce((s, l) => s + Number(l.actual_revenue_usd || 0), 0);

  const signalEfficiency = totalDispatches > 0 ? ((totalConversions / totalDispatches) * 100) : 0;

  // Chart data for partner performance
  const partnerChartData = partners
    .filter((p) => p.total_dispatches > 0 || p.commission_rate > 0)
    .slice(0, 8)
    .map((p) => ({
      name: p.name,
      dispatches: p.total_dispatches || 0,
      conversions: p.total_conversions || 0,
      rate: p.total_dispatches > 0 ? ((p.total_conversions / p.total_dispatches) * 100).toFixed(1) : '0',
      revenue: Number(p.total_revenue_usd || 0),
      bounty: p.commission_rate,
    }));

  // Recent ledger activity
  const recentActivity = ledger.slice(0, 10);

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              M2M PPL Engine
            </h1>
            <p className="text-muted-foreground mt-1">Pay-Per-Lead Command Center · Autonomous Bounty Tracking</p>
          </div>
          <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
            <Zap className="w-3 h-3 mr-1" /> {partners.length} Partners Active
          </Badge>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Potential Revenue"
            value={`$${potentialRevenue.toFixed(2)}`}
            subtitle="From dispatched signals"
            icon={<Target className="w-5 h-5" />}
            trend="pending"
            gradientFrom="from-amber-500/20"
            gradientTo="to-orange-500/20"
            iconColor="text-amber-400"
          />
          <MetricCard
            title="Confirmed Income"
            value={`$${confirmedRevenue.toFixed(2)}`}
            subtitle="Postback verified"
            icon={<DollarSign className="w-5 h-5" />}
            trend={confirmedRevenue > 0 ? 'up' : 'neutral'}
            gradientFrom="from-emerald-500/20"
            gradientTo="to-green-500/20"
            iconColor="text-emerald-400"
          />
          <MetricCard
            title="Signal Efficiency"
            value={`${signalEfficiency.toFixed(1)}%`}
            subtitle={`${totalConversions}/${totalDispatches} converted`}
            icon={<TrendingUp className="w-5 h-5" />}
            trend={signalEfficiency > 5 ? 'up' : 'neutral'}
            gradientFrom="from-cyan-500/20"
            gradientTo="to-blue-500/20"
            iconColor="text-cyan-400"
          />
          <MetricCard
            title="Total Revenue"
            value={`$${totalRevenue.toFixed(2)}`}
            subtitle="Lifetime partner earnings"
            icon={<Shield className="w-5 h-5" />}
            trend={totalRevenue > 0 ? 'up' : 'neutral'}
            gradientFrom="from-violet-500/20"
            gradientTo="to-purple-500/20"
            iconColor="text-violet-400"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Partner Performance Table */}
          <Card className="xl:col-span-2 bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-400" />
                Partner Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {partners.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No active partners yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50 text-muted-foreground">
                        <th className="text-right py-2 pr-4 font-medium">Partner</th>
                        <th className="text-right py-2 px-2 font-medium">Bounty</th>
                        <th className="text-right py-2 px-2 font-medium">Dispatches</th>
                        <th className="text-right py-2 px-2 font-medium">Conversions</th>
                        <th className="text-right py-2 px-2 font-medium">CVR</th>
                        <th className="text-right py-2 pl-2 font-medium">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partners.map((p) => {
                        const cvr = p.total_dispatches > 0
                          ? ((p.total_conversions / p.total_dispatches) * 100).toFixed(1)
                          : '—';
                        const isLive = p.name.toLowerCase() === 'woodpecker';
                        return (
                          <tr key={p.id} className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${isLive ? 'bg-emerald-500/5' : ''}`}>
                            <td className="py-3 pr-4 font-medium flex items-center gap-2">
                              {p.name}
                              {isLive && (
                                <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10 text-[10px] px-1.5 py-0">
                                  <Zap className="w-2.5 h-2.5 mr-0.5" />REVENUE LIVE
                                </Badge>
                              )}
                            </td>
                            <td className="py-3 px-2 text-right text-amber-400">${p.commission_rate}</td>
                            <td className="py-3 px-2 text-right">{p.total_dispatches}</td>
                            <td className="py-3 px-2 text-right text-emerald-400">{p.total_conversions}</td>
                            <td className="py-3 px-2 text-right">{cvr}%</td>
                            <td className="py-3 pl-2 text-right font-semibold text-emerald-400">
                              ${Number(p.total_revenue_usd || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bounty Distribution Chart */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Bounty Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {partnerChartData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Awaiting data…</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={partnerChartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={80}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar dataKey="bounty" name="Bounty ($)" radius={[0, 4, 4, 0]}>
                      {partnerChartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Dispatch Activity */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Recent Dispatch Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No dispatches recorded yet. The engine will populate this automatically.</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((entry) => {
                  const partner = partners.find((p) => p.id === entry.partner_id);
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/30"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            entry.status === 'confirmed'
                              ? 'bg-emerald-400'
                              : entry.status === 'rejected'
                              ? 'bg-red-400'
                              : 'bg-amber-400 animate-pulse'
                          }`}
                        />
                        <span className="font-medium text-sm">{partner?.name || 'Unknown'}</span>
                        <Badge
                          variant="outline"
                          className={
                            entry.status === 'confirmed'
                              ? 'border-emerald-500/50 text-emerald-400'
                              : entry.status === 'rejected'
                              ? 'border-red-500/50 text-red-400'
                              : 'border-amber-500/50 text-amber-400'
                          }
                        >
                          {entry.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          Est: ${Number(entry.estimated_bounty_usd || 0).toFixed(2)}
                        </span>
                        {entry.status === 'confirmed' && (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <ArrowUpRight className="w-3 h-3" />
                            ${Number(entry.actual_revenue_usd || 0).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

/* Glassmorphism Metric Card */
function MetricCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  gradientFrom,
  gradientTo,
  iconColor,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral' | 'pending';
  gradientFrom: string;
  gradientTo: string;
  iconColor: string;
}) {
  return (
    <Card className={`bg-gradient-to-br ${gradientFrom} ${gradientTo} backdrop-blur-sm border-border/40 relative overflow-hidden`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`p-2 rounded-lg bg-background/30 ${iconColor}`}>{icon}</div>
        </div>
        {trend === 'up' && (
          <ArrowUpRight className="absolute bottom-2 right-2 w-4 h-4 text-emerald-400 opacity-50" />
        )}
        {trend === 'down' && (
          <ArrowDownRight className="absolute bottom-2 right-2 w-4 h-4 text-red-400 opacity-50" />
        )}
      </CardContent>
    </Card>
  );
}
