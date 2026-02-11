import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radar, Clock, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

export function SignalRadar() {
  const { data: signals, isLoading } = useQuery({
    queryKey: ['forge-signals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('demand_signals')
        .select('id, query_text, category, relevance_score, urgency_score, source_url, created_at, m2m_status')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 10000,
  });

  const statusColor = (status: string | null) => {
    switch (status) {
      case 'dispatched': return 'bg-primary/20 text-primary';
      case 'matched': return 'bg-warning/20 text-warning';
      case 'skipped': return 'bg-muted text-muted-foreground';
      default: return 'bg-info/20 text-info';
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Radar className="w-5 h-5 text-primary" />
          Signal Radar
          <Badge variant="outline" className="mr-auto text-xs">
            LIVE
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-muted/30 rounded-lg" />)}
          </div>
        ) : signals && signals.length > 0 ? (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {signals.map((sig) => (
              <div
                key={sig.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group"
              >
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" dir="ltr">
                    {sig.query_text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {sig.category || 'uncategorized'}
                    </span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(sig.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary" className="text-xs">
                    {Math.round((sig.relevance_score || 0) * 100)}%
                  </Badge>
                  <Badge className={`text-xs ${statusColor(sig.m2m_status)}`}>
                    {sig.m2m_status || 'new'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Radar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No signals detected yet</p>
            <p className="text-xs mt-1">Signals from 31 sources will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
