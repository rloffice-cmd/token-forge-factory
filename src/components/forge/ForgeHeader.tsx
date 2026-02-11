import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Activity, RefreshCw, Zap } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function ForgeHeader() {
  const queryClient = useQueryClient();

  const { data: activeDispatches } = useQuery({
    queryKey: ['m2m-active-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('m2m_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'dispatched');
      return count || 0;
    },
    refetchInterval: 15000,
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['m2m'] });
    queryClient.invalidateQueries({ queryKey: ['forge'] });
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          Token Forge
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          M2M Autonomous Broker — Signal → Partner → Revenue
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="gap-1.5 text-xs">
          <Activity className="w-3 h-3 text-primary animate-pulse" />
          {activeDispatches} active
        </Badge>
        <Button variant="outline" size="icon" onClick={refreshAll}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
