import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, ArrowUpRight, Target, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function FinancialHealth() {
  const { data } = useQuery({
    queryKey: ['forge-financial'],
    queryFn: async () => {
      const [ledgerAll, confirmed, partners, signals] = await Promise.all([
        supabase.from('m2m_ledger').select('estimated_bounty_usd, actual_revenue_usd, status'),
        supabase.from('m2m_ledger').select('actual_revenue_usd').eq('status', 'confirmed'),
        supabase.from('m2m_partners').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('demand_signals').select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      ]);

      const rows = ledgerAll.data || [];
      const estimatedTotal = rows.reduce((s, r) => s + Number(r.estimated_bounty_usd), 0);
      const actualTotal = (confirmed.data || []).reduce((s, r) => s + Number(r.actual_revenue_usd), 0);
      const dispatched = rows.filter(r => r.status === 'dispatched').length;
      const confirmedCount = rows.filter(r => r.status === 'confirmed').length;
      const conversionRate = rows.length > 0 ? Math.round((confirmedCount / rows.length) * 100) : 0;

      return {
        estimatedTotal,
        actualTotal,
        dispatched,
        confirmedCount,
        conversionRate,
        activePartners: partners.count || 0,
        signalsToday: signals.count || 0,
      };
    },
    refetchInterval: 20000,
  });

  const metrics = [
    {
      label: 'Estimated Bounty',
      value: `$${(data?.estimatedTotal ?? 0).toFixed(2)}`,
      sub: `${data?.dispatched ?? 0} dispatched`,
      icon: Target,
      accent: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      label: 'Postback Revenue',
      value: `$${(data?.actualTotal ?? 0).toFixed(2)}`,
      sub: `${data?.confirmedCount ?? 0} confirmed`,
      icon: DollarSign,
      accent: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Conversion Rate',
      value: `${data?.conversionRate ?? 0}%`,
      sub: 'dispatch → confirm',
      icon: TrendingUp,
      accent: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Active Partners',
      value: `${data?.activePartners ?? 0}`,
      sub: `${data?.signalsToday ?? 0} signals/24h`,
      icon: Zap,
      accent: 'text-info',
      bg: 'bg-info/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m) => (
        <Card key={m.label} className="glass-card hover:glow-border transition-all duration-300">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className={`text-2xl font-bold mt-1 ${m.accent}`}>{m.value}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center`}>
                <m.icon className={`w-4 h-4 ${m.accent}`} />
              </div>
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground">
              <ArrowUpRight className="w-3 h-3 mr-1" />
              {m.sub}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
