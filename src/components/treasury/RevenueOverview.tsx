/**
 * Revenue Overview Card
 * Shows REAL revenue from confirmed payments
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Calendar, Coins } from 'lucide-react';
import { useRevenueStats } from '@/hooks/useRevenueData';

export function RevenueOverview() {
  const { data: stats, isLoading, error } = useRevenueStats();
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (error || !stats) {
    return (
      <Card className="glass-card border-destructive/30">
        <CardContent className="pt-6">
          <p className="text-destructive">שגיאה בטעינת נתוני הכנסות</p>
        </CardContent>
      </Card>
    );
  }
  
  const cards = [
    {
      title: 'סה״כ הכנסות',
      value: `$${stats.totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      subtitle: `${stats.totalEth.toFixed(4)} ETH`,
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-primary/20',
    },
    {
      title: 'היום',
      value: `$${stats.todayUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      subtitle: `${stats.todayPayments} תשלומים`,
      icon: Calendar,
      color: 'text-success',
      bgColor: 'bg-success/20',
    },
    {
      title: '7 ימים אחרונים',
      value: `$${stats.last7DaysUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      subtitle: '',
      icon: TrendingUp,
      color: 'text-info',
      bgColor: 'bg-info/20',
    },
    {
      title: 'סה״כ תשלומים',
      value: stats.totalPayments.toString(),
      subtitle: 'מאושרים',
      icon: Coins,
      color: 'text-warning',
      bgColor: 'bg-warning/20',
    },
  ];
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <Card key={index} className="glass-card glow-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full ${card.bgColor} flex items-center justify-center shrink-0`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">{card.title}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                {card.subtitle && (
                  <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
