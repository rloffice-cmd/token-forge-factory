import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MousePointerClick, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

export function ClickTicker() {
  const { data: clicks } = useQuery({
    queryKey: ['forge-clicks'],
    queryFn: async () => {
      const { data } = await supabase
        .from('click_analytics')
        .select('id, partner_slug, lead_id, source_platform, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    },
    refetchInterval: 10000,
  });

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MousePointerClick className="w-4 h-4 text-primary" />
          Click Ticker
          <Badge variant="secondary" className="text-xs mr-auto">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-y-auto">
        {(!clicks || clicks.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No clicks tracked yet. Redirect links will appear here.
          </p>
        ) : (
          clicks.map((click) => (
            <div
              key={click.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <ExternalLink className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {click.partner_slug}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {click.source_platform} · {click.lead_id?.slice(0, 8) || 'direct'}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(click.created_at), { addSuffix: true })}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
