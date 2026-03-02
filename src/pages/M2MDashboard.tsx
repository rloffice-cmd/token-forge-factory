/**
 * M2M PPL Dashboard v4 — Pay-Per-Lead Engine Command Center
 * Enhanced: Partner EPC/CR cards, Revenue Heatmap by platform, auto affiliate links
 */

import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AutomatedMarketingHub } from '@/components/forge/AutomatedMarketingHub';
import {
  DollarSign,
  Target,
  TrendingUp,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  Shield,
  PieChart as PieIcon,
  Clock,
  Megaphone,
  MousePointerClick,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
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

interface OutreachJob {
  intent_topic: string;
  status: string;
  confidence: number;
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

const CATEGORY_COLORS: Record<string, string> = {
  'Security': 'hsl(346, 87%, 56%)',
  'Email Marketing': 'hsl(142, 71%, 45%)',
  'Webhooks': 'hsl(199, 89%, 48%)',
  'Other': 'hsl(262, 83%, 58%)',
};

function categorizeIntent(topic: string): string {
  const t = topic.toLowerCase();
  if (t.includes('wallet') || t.includes('security') || t.includes('guardian') || t.includes('risk')) return 'Security';
  if (t.includes('email') || t.includes('cold') || t.includes('outreach') || t.includes('deliverability') || t.includes('woodpecker')) return 'Email Marketing';
  if (t.includes('webhook') || t.includes('replay')) return 'Webhooks';
  return 'Other';
}

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

  const { data: allPartners = [] } = useQuery<PartnerRow[]>({
    queryKey: ['m2m-partners-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('m2m_partners')
        .select('id, name, commission_rate, total_dispatches, total_conversions, total_revenue_usd, category_tags, is_active')
        .order('name');
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

  // Fetch outreach jobs for category distribution
  const { data: outreachJobs = [] } = useQuery<OutreachJob[]>({
    queryKey: ['outreach-jobs-categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('outreach_jobs')
        .select('intent_topic, status, confidence')
        .order('created_at', { ascending: false })
        .limit(500);
      return (data as any[]) || [];
    },
  });

  // Fetch click analytics for revenue heatmap
  const { data: clickAnalytics = [] } = useQuery<{ source_platform: string; created_at: string }[]>({
    queryKey: ['click-analytics-heatmap'],
    queryFn: async () => {
      const { data } = await supabase
        .from('click_analytics')
        .select('source_platform, created_at')
        .order('created_at', { ascending: false })
        .limit(1000);
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

  // Lead Category Distribution data
  const categoryMap: Record<string, number> = {};
  outreachJobs.forEach((j) => {
    const cat = categorizeIntent(j.intent_topic || '');
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });
  const categoryChartData = Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value,
    fill: CATEGORY_COLORS[name] || CATEGORY_COLORS['Other'],
  }));

  // V3.0 — Estimated הכנסה פוטנציאלית per niche
  const NICHE_AVG_BOUNTY: Record<string, number> = {
    'Email Marketing': 20,
    'Security': 15,
    'Webhooks': 10,
    'Other': 12,
  };
  const nicheRevenueEstimates = Object.entries(categoryMap).map(([niche, count]) => ({
    niche,
    leads: count,
    avgBounty: NICHE_AVG_BOUNTY[niche] || 12,
    estimatedRevenue: count * (NICHE_AVG_BOUNTY[niche] || 12),
  }));
  const totalEstimatedRevenue = nicheRevenueEstimates.reduce((s, n) => s + n.estimatedRevenue, 0);

  const securityLeads = outreachJobs.filter(
    (j) => categorizeIntent(j.intent_topic || '') === 'Security' && j.status === 'queued' && j.confidence >= 0.85
  );

  // Standby partners (inactive)
  const standbyPartners = allPartners.filter((p) => !p.is_active);

  // Recent ledger activity
  const recentActivity = ledger.slice(0, 10);

  // EPC (Earnings Per Click) data per partner
  const partnerEPCData = partners.map((p) => {
    const epc = p.total_dispatches > 0 ? Number(p.total_revenue_usd || 0) / p.total_dispatches : 0;
    const cr = p.total_dispatches > 0 ? (p.total_conversions / p.total_dispatches) * 100 : 0;
    return { ...p, epc, cr };
  });

  // Revenue Heatmap by platform
  const platformCounts: Record<string, number> = {};
  clickAnalytics.forEach((c) => {
    const plat = c.source_platform || 'direct';
    platformCounts[plat] = (platformCounts[plat] || 0) + 1;
  });
  const PLATFORM_COLORS: Record<string, string> = {
    linkedin: 'hsl(199, 89%, 48%)',
    twitter: 'hsl(199, 89%, 68%)',
    reddit: 'hsl(16, 100%, 50%)',
    whatsapp: 'hsl(142, 71%, 45%)',
    telegram: 'hsl(199, 89%, 58%)',
    facebook: 'hsl(221, 68%, 55%)',
    hackernews: 'hsl(24, 95%, 53%)',
    direct: 'hsl(262, 83%, 58%)',
  };
  const heatmapData = Object.entries(platformCounts)
    .map(([name, clicks]) => ({ name, clicks, fill: PLATFORM_COLORS[name] || 'hsl(var(--muted-foreground))' }))
    .sort((a, b) => b.clicks - a.clicks);

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              M2M PPL Engine
            </h1>
            <p className="text-muted-foreground mt-1">Pay-Per-Lead Command Center · Autonomous Bounty Tracking</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 bg-emerald-500/10">
              <Zap className="w-3 h-3 mr-1" /> {partners.length} Partners Active
            </Badge>
            {standbyPartners.length > 0 && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-400 bg-amber-500/10">
                <Clock className="w-3 h-3 mr-1" /> {standbyPartners.length} Standby
              </Badge>
            )}
          </div>
        </div>

        {/* Security Lead Alert */}
        {securityLeads.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-300">
                {securityLeads.length} High-Intent Security Lead{securityLeads.length > 1 ? 's' : ''} — Awaiting Security Partner
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Confidence ≥ 85%. Preserved in queue until a relevant partner (e.g. NordLayer) is activated.
              </p>
            </div>
          </div>
        )}

        {/* Main Tabs: Analytics vs Marketing Hub */}
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="h-10">
            <TabsTrigger value="analytics" className="gap-2">
              <Target className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="marketing" className="gap-2">
              <Megaphone className="w-4 h-4" />
              Marketing Kit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            title="הכנסה פוטנציאלית"
            value={`$${potentialRevenue.toFixed(2)}`}
            subtitle="מסיגנלים שנשלחו"
            icon={<Target className="w-5 h-5" />}
            trend="pending"
            gradientFrom="from-amber-500/20"
            gradientTo="to-orange-500/20"
            iconColor="text-amber-400"
          />
          <MetricCard
            title="הכנסה מאושרת"
            value={`$${confirmedRevenue.toFixed(2)}`}
            subtitle="Postback אומת"
            icon={<DollarSign className="w-5 h-5" />}
            trend={confirmedRevenue > 0 ? 'up' : 'neutral'}
            gradientFrom="from-emerald-500/20"
            gradientTo="to-green-500/20"
            iconColor="text-emerald-400"
          />
          <MetricCard
            title="יעילות סיגנל"
            value={`${signalEfficiency.toFixed(1)}%`}
            subtitle={`${totalConversions}/${totalDispatches} converted`}
            icon={<TrendingUp className="w-5 h-5" />}
            trend={signalEfficiency > 5 ? 'up' : 'neutral'}
            gradientFrom="from-cyan-500/20"
            gradientTo="to-blue-500/20"
            iconColor="text-cyan-400"
          />
          <MetricCard
            title="הכנסה כוללת"
            value={`$${totalRevenue.toFixed(2)}`}
            subtitle="רווחי שותפים לכל החיים"
            icon={<Shield className="w-5 h-5" />}
            trend={totalRevenue > 0 ? 'up' : 'neutral'}
            gradientFrom="from-violet-500/20"
            gradientTo="to-purple-500/20"
            iconColor="text-violet-400"
          />
        </div>

        {/* EPC & CR Partner Performance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {partnerEPCData.slice(0, 8).map((p) => (
            <Card key={p.id} className="bg-card/50 backdrop-blur-sm border-border/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-sm truncate">{p.name}</span>
                  <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">EPC</p>
                    <p className="text-lg font-bold text-emerald-400">${p.epc.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">CVR</p>
                    <p className="text-lg font-bold text-cyan-400">{p.cr.toFixed(1)}%</p>
                  </div>
                </div>
                <Progress value={Math.min(p.cr, 100)} className="mt-3 h-1.5" />
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {p.total_dispatches} dispatches · {p.total_conversions} conversions
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Revenue Heatmap by Platform */}
        {heatmapData.length > 0 && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                Revenue Heatmap — Click Sources by Platform
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={heatmapData} margin={{ left: 0, right: 10 }}>
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                    }}
                  />
                  <Bar dataKey="clicks" name="Clicks" radius={[4, 4, 0, 0]}>
                    {heatmapData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-3 justify-center">
                {heatmapData.map((plat) => (
                  <div key={plat.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: plat.fill }} />
                    <span className="text-muted-foreground capitalize">{plat.name}</span>
                    <span className="font-medium">{plat.clicks}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

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

              {/* Standby Partners */}
              {standbyPartners.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/30">
                  <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Standby Partners</p>
                  <div className="flex flex-wrap gap-2">
                    {standbyPartners.map((p) => (
                      <Badge key={p.id} variant="outline" className="border-amber-500/30 text-amber-400/70 bg-amber-500/5 text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {p.name} — Awaiting Link
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead Category Distribution */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-violet-400" />
                Lead Category Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryChartData.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">No lead data yet.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-3 mt-2 justify-center">
                    {categoryChartData.map((cat) => (
                      <div key={cat.name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.fill }} />
                        <span className="text-muted-foreground">{cat.name}</span>
                        <span className="font-medium">{cat.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* V3.0 — Estimated Revenue by Niche */}
        {nicheRevenueEstimates.length > 0 && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Estimated Revenue by Niche
                <Badge variant="outline" className="ml-auto text-xs border-border/50">
                  Total: ${totalEstimatedRevenue.toFixed(0)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {nicheRevenueEstimates.map((n) => (
                  <div key={n.niche} className="p-4 rounded-lg bg-muted/20 border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[n.niche] || CATEGORY_COLORS['Other'] }} />
                      <span className="text-sm font-medium">{n.niche}</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-400">${n.estimatedRevenue.toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {n.leads} leads × ${n.avgBounty} avg bounty
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bounty Distribution + Recent Activity */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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

          {/* Recent Dispatch Activity */}
          <Card className="xl:col-span-2 bg-card/50 backdrop-blur-sm border-border/50">
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
          </TabsContent>

          <TabsContent value="marketing">
            <AutomatedMarketingHub />
          </TabsContent>
        </Tabs>
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
