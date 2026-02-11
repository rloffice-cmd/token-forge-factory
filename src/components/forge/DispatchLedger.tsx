import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

export function DispatchLedger() {
  const { data: dispatches, isLoading } = useQuery({
    queryKey: ['forge-dispatches'],
    queryFn: async () => {
      const { data } = await supabase
        .from('m2m_ledger')
        .select(`
          id, lead_context, matched_keywords, affiliate_link,
          estimated_bounty_usd, actual_revenue_usd, status,
          dispatched_at, confirmed_at,
          m2m_partners(name)
        `)
        .order('dispatched_at', { ascending: false })
        .limit(25);
      return data || [];
    },
    refetchInterval: 15000,
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      dispatched: 'bg-info/20 text-info',
      pending: 'bg-warning/20 text-warning',
      confirmed: 'bg-success/20 text-success',
      rejected: 'bg-destructive/20 text-destructive',
    };
    return map[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="w-5 h-5 text-primary" />
          Dispatch Ledger
          <Badge variant="outline" className="mr-auto text-xs">
            {dispatches?.length || 0} entries
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-muted/30 rounded" />)}
          </div>
        ) : dispatches && dispatches.length > 0 ? (
          <div className="max-h-[420px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs">Lead Context</TableHead>
                  <TableHead className="text-xs">Partner</TableHead>
                  <TableHead className="text-xs">Bounty</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dispatches.map((d) => (
                  <TableRow key={d.id} className="hover:bg-muted/20">
                    <TableCell className="max-w-[180px]">
                      <p className="text-xs truncate" dir="ltr">{d.lead_context || '—'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(d.dispatched_at), { addSuffix: true })}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium">
                          {(d.m2m_partners as any)?.name || '—'}
                        </span>
                        {d.affiliate_link && (
                          <a href={d.affiliate_link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-primary" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <span className="text-warning">${Number(d.estimated_bounty_usd).toFixed(2)}</span>
                        {d.status === 'confirmed' && (
                          <span className="text-success block">
                            → ${Number(d.actual_revenue_usd).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${statusBadge(d.status)}`}>
                        {d.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No dispatches yet</p>
            <p className="text-xs mt-1">Signals matched to partners will appear here</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
