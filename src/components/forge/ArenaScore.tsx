import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp, MousePointerClick, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function ArenaScore() {
  const { data } = useQuery({
    queryKey: ['forge-arena-score'],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [clicksRes, dispatchesRes, weekClicksRes] = await Promise.all([
        supabase
          .from('click_analytics')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', todayStart.toISOString()),
        supabase
          .from('m2m_ledger')
          .select('id', { count: 'exact', head: true })
          .gte('dispatched_at', todayStart.toISOString()),
        supabase
          .from('click_analytics')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);

      const clicksToday = clicksRes.count || 0;
      const dispatchesToday = dispatchesRes.count || 0;
      const clicksWeek = weekClicksRes.count || 0;

      // CTR = clicks / dispatches (if dispatches > 0)
      const ctr = dispatchesToday > 0 ? Math.round((clicksToday / dispatchesToday) * 100) : 0;

      // Arena score: weighted combination
      const score = Math.min(100, Math.round(
        (clicksToday * 5) +
        (ctr * 0.5) +
        (dispatchesToday * 2)
      ));

      return { clicksToday, dispatchesToday, ctr, score, clicksWeek };
    },
    refetchInterval: 15000,
  });

  const score = data?.score ?? 0;
  const scoreColor = score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-destructive';

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-warning" />
          Arena Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center mb-4">
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${score * 2.64} 264`}
                className="transition-all duration-1000"
              />
            </svg>
            <span className={`absolute text-3xl font-bold ${scoreColor}`}>
              {score}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <MousePointerClick className="w-3 h-3" /> Clicks
            </div>
            <p className="text-lg font-semibold">{data?.clicksToday ?? 0}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <Target className="w-3 h-3" /> CTR
            </div>
            <p className="text-lg font-semibold">{data?.ctr ?? 0}%</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3 h-3" /> 7d
            </div>
            <p className="text-lg font-semibold">{data?.clicksWeek ?? 0}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
