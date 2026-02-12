import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Industry average conversion rates by category
const AVG_CONVERSION: Record<string, number> = {
  'sales': 0.03, 'crm': 0.03, 'outreach': 0.04,
  'security': 0.025, 'compliance': 0.025,
  'ai': 0.02, 'infrastructure': 0.02,
  'default': 0.025,
};

export function LiveRevenueFeed() {
  const { data } = useQuery({
    queryKey: ['forge-live-revenue'],
    queryFn: async () => {
      const [clicksByPartner, partners, ledger] = await Promise.all([
        supabase
          .from('click_analytics')
          .select('partner_slug')
          .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from('m2m_partners').select('name, commission_rate, category_tags').eq('is_active', true),
        supabase.from('m2m_ledger').select('actual_revenue_usd').eq('status', 'confirmed'),
      ]);

      // Count clicks per partner slug
      const clickCounts: Record<string, number> = {};
      for (const c of clicksByPartner.data || []) {
        clickCounts[c.partner_slug] = (clickCounts[c.partner_slug] || 0) + 1;
      }

      // Calculate estimated revenue per partner
      const partnerRevenue = (partners.data || []).map((p) => {
        const slug = p.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const clicks = clickCounts[slug] || 0;
        const category = (p.category_tags?.[0] || 'default').toLowerCase();
        const convRate = AVG_CONVERSION[category] || AVG_CONVERSION['default'];
        const estimatedConversions = clicks * convRate;
        const estimatedRevenue = estimatedConversions * (p.commission_rate || 0);
        return { name: p.name, slug, clicks, estimatedRevenue, commission: p.commission_rate };
      }).filter(p => p.clicks > 0).sort((a, b) => b.estimatedRevenue - a.estimatedRevenue);

      const totalEstimated = partnerRevenue.reduce((s, p) => s + p.estimatedRevenue, 0);
      const totalConfirmed = (ledger.data || []).reduce((s, r) => s + Number(r.actual_revenue_usd), 0);
      const totalClicks = Object.values(clickCounts).reduce((s, c) => s + c, 0);

      return { partnerRevenue, totalEstimated, totalConfirmed, totalClicks };
    },
    refetchInterval: 15000,
  });

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-success" />
          Live Revenue Feed
          <Badge variant="outline" className="text-xs mr-auto gap-1">
            <Zap className="w-2.5 h-2.5" /> 30d
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 rounded-lg bg-success/10 text-center">
            <p className="text-xs text-muted-foreground">Confirmed</p>
            <p className="text-lg font-bold text-success">${(data?.totalConfirmed ?? 0).toFixed(0)}</p>
          </div>
          <div className="p-3 rounded-lg bg-warning/10 text-center">
            <p className="text-xs text-muted-foreground">Estimated</p>
            <p className="text-lg font-bold text-warning">${(data?.totalEstimated ?? 0).toFixed(0)}</p>
          </div>
          <div className="p-3 rounded-lg bg-info/10 text-center">
            <p className="text-xs text-muted-foreground">Clicks</p>
            <p className="text-lg font-bold text-info">{data?.totalClicks ?? 0}</p>
          </div>
        </div>

        {/* Partner breakdown */}
        <div className="space-y-2 max-h-[250px] overflow-y-auto">
          {(data?.partnerRevenue || []).map((p) => (
            <div key={p.slug} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span className="text-sm font-medium">{p.name}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{p.clicks} clicks</span>
                <span className="text-success font-medium">~${p.estimatedRevenue.toFixed(0)}</span>
              </div>
            </div>
          ))}
          {(!data?.partnerRevenue || data.partnerRevenue.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No click data yet. Revenue estimates will appear as clicks are tracked.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
