/**
 * Network Connectivity Status Light
 * Green = API Connected, Yellow = DNS Pending
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ConnectivityStatus {
  api: 'connected' | 'error';
  dns: 'active' | 'pending' | 'unknown';
}

export function NetworkConnectivity() {
  const { data: status } = useQuery<ConnectivityStatus>({
    queryKey: ['network-connectivity'],
    queryFn: async () => {
      let apiStatus: 'connected' | 'error' = 'error';
      let dnsStatus: 'active' | 'pending' | 'unknown' = 'unknown';

      // Check API connectivity (simple DB ping)
      try {
        const { error } = await supabase
          .from('m2m_partners')
          .select('id')
          .limit(1);
        apiStatus = error ? 'error' : 'connected';
      } catch {
        apiStatus = 'error';
      }

      // Check DNS/Domain status via setup-resend-domain
      try {
        const { data, error } = await supabase.functions.invoke('setup-resend-domain', {
          body: { action: 'get-records' },
        });
        if (!error && data?.status === 'verified') {
          dnsStatus = 'active';
        } else {
          dnsStatus = 'pending';
        }
      } catch {
        dnsStatus = 'pending';
      }

      return { api: apiStatus, dns: dnsStatus };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const apiOk = status?.api === 'connected';
  const dnsOk = status?.dns === 'active';
  const allGreen = apiOk && dnsOk;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/50 bg-card/50">
            {allGreen ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-amber-400" />
            )}
            <div className="flex items-center gap-1.5">
              {/* API dot */}
              <span
                className={`w-2 h-2 rounded-full ${
                  apiOk ? 'bg-emerald-400 shadow-[0_0_6px_hsl(var(--chart-2))]' : 'bg-destructive'
                }`}
              />
              {/* DNS dot */}
              <span
                className={`w-2 h-2 rounded-full ${
                  dnsOk
                    ? 'bg-emerald-400 shadow-[0_0_6px_hsl(var(--chart-2))]'
                    : 'bg-amber-400 animate-pulse shadow-[0_0_6px_hsl(45,93%,47%)]'
                }`}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {allGreen ? 'Connected' : 'DNS Pending'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${apiOk ? 'bg-emerald-400' : 'bg-destructive'}`} />
              API: {apiOk ? 'Connected' : 'Error'}
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${dnsOk ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              DNS: {dnsOk ? 'Active' : 'Pending'}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
