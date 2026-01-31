/**
 * Revenue Chart
 * Daily revenue visualization
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useDailyRevenue } from '@/hooks/useRevenueData';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  
  return (
    <div className="bg-popover border rounded-lg p-3 shadow-lg">
      <p className="font-medium text-sm">{label}</p>
      <p className="text-primary font-bold">
        ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </p>
      <p className="text-muted-foreground text-xs">
        {payload[0].payload.count} תשלומים
      </p>
    </div>
  );
}

export function RevenueChart() {
  const { data: dailyData, isLoading, error } = useDailyRevenue(30);
  
  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            הכנסות יומיות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="glass-card border-destructive/30">
        <CardContent className="pt-6">
          <p className="text-destructive">שגיאה בטעינת נתוני גרף</p>
        </CardContent>
      </Card>
    );
  }
  
  // Format data for chart
  const chartData = (dailyData || []).map(day => ({
    ...day,
    label: format(new Date(day.date), 'dd/MM', { locale: he }),
  }));
  
  if (chartData.length === 0) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            הכנסות יומיות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            אין נתונים להצגה
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          הכנסות יומיות (30 יום)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="amount_usd" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
