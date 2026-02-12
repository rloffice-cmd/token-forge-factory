import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Cpu, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ROIData {
  estimatedCommission: number;
  aiTokenCost: number;
  functionInvocationCost: number;
  netROI: number;
  roiRatio: number;
  totalLeads: number;
  lowPriorityCount: number;
}

export function ROITracker() {
  const { data: roi, isLoading } = useQuery<ROIData>({
    queryKey: ['roi-tracker'],
    queryFn: async () => {
      // Fetch affiliate earnings
      const { count: earningsCount } = await supabase
        .from('affiliate_earnings')
        .select('*', { count: 'exact', head: true });

      const { data: earnings } = await supabase
        .from('affiliate_earnings')
        .select('amount_usd')
        .eq('status', 'confirmed');

      const estimatedCommission = (earnings || []).reduce((sum, e) => sum + (e.amount_usd || 0), 0);

      // Estimate costs (simplified model)
      const { count: functionCalls } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const functionInvocationCost = (functionCalls || 0) * 0.000002; // ~$2/million invocations
      const aiTokenCost = (functionCalls || 0) * 0.00005; // estimated AI calls

      const totalCost = aiTokenCost + functionInvocationCost;
      const netROI = estimatedCommission - totalCost;
      const roiRatio = totalCost > 0 ? estimatedCommission / totalCost : 0;

      // Count leads
      const { count: totalLeads } = await supabase
        .from('auto_leads')
        .select('*', { count: 'exact', head: true });

      return {
        estimatedCommission,
        aiTokenCost: Math.round(aiTokenCost * 100) / 100,
        functionInvocationCost: Math.round(functionInvocationCost * 100) / 100,
        netROI: Math.round(netROI * 100) / 100,
        roiRatio: Math.round(roiRatio * 100) / 100,
        totalLeads: totalLeads || 0,
        lowPriorityCount: 0,
      };
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">ROI Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const isHealthy = (roi?.roiRatio || 0) >= 1.2;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Unit Economics — ROI Tracker
          </CardTitle>
          <Badge variant={isHealthy ? 'default' : 'destructive'} className="text-xs">
            {isHealthy ? 'Healthy' : 'Below Threshold'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <DollarSign className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
            <div className="text-lg font-bold text-emerald-400">${roi?.estimatedCommission.toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Commission</div>
          </div>
          <div className="text-center">
            <Cpu className="w-4 h-4 mx-auto text-orange-400 mb-1" />
            <div className="text-lg font-bold text-orange-400">
              ${((roi?.aiTokenCost || 0) + (roi?.functionInvocationCost || 0)).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">Total Cost</div>
          </div>
          <div className="text-center">
            {isHealthy ? (
              <TrendingUp className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
            ) : (
              <TrendingDown className="w-4 h-4 mx-auto text-destructive mb-1" />
            )}
            <div className={`text-lg font-bold ${isHealthy ? 'text-emerald-400' : 'text-destructive'}`}>
              {roi?.roiRatio}x
            </div>
            <div className="text-xs text-muted-foreground">ROI Ratio</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground border-t border-border/30 pt-2 flex justify-between">
          <span>Threshold: 1.2x</span>
          <span>{roi?.totalLeads} leads tracked</span>
        </div>
      </CardContent>
    </Card>
  );
}
