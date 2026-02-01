import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Shield, 
  Wallet, 
  Webhook, 
  DollarSign, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface DashboardData {
  today: {
    pain_score: number;
    estimated_loss_usd: number;
    events_count: number;
    top_problem: string | null;
    wallet_risk_high_count: number;
    webhook_failures_count: number;
    payment_drift_usd: number;
  };
  rate_limit: {
    spent_usd: number;
    cap_usd: number;
    remaining_usd: number;
    hits_count: number;
    blocked: boolean;
  };
  summary_7d: {
    total_loss_usd: number;
    avg_daily_pain: number;
    estimated_monthly_loss_usd: number;
    days_with_data: number;
  };
  history: Array<{
    date: string;
    pain_score: number;
    loss_usd: number;
    events: number;
  }>;
  recent_events: Array<{
    id: string;
    product: string;
    severity: number;
    loss_usd: number;
    cost_usd: number;
    created_at: string;
  }>;
  guardian_offer: {
    id: string;
    estimated_monthly_loss_usd: number;
    reason: string;
    price_usd: number;
    status: string;
    expires_at: string;
    payment_link: string | null;
  } | null;
}

interface MicroCustomerDashboardProps {
  apiKey: string;
}

export default function MicroCustomerDashboard({ apiKey }: MicroCustomerDashboardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['micro-dashboard', apiKey],
    queryFn: async (): Promise<DashboardData> => {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/micro-dashboard-value`,
        {
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      return response.json();
    },
    enabled: !!apiKey,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getProductIcon = (product: string) => {
    switch (product) {
      case 'wallet-risk': return <Wallet className="h-4 w-4 text-orange-500" />;
      case 'webhook-check': return <Webhook className="h-4 w-4 text-blue-500" />;
      case 'payment-drift': return <DollarSign className="h-4 w-4 text-green-500" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 8) return 'text-red-500';
    if (severity >= 5) return 'text-orange-500';
    return 'text-green-500';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">טוען נתונים...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background p-6" dir="rtl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>שגיאה בטעינת הנתונים</AlertTitle>
          <AlertDescription>נסה שוב מאוחר יותר או בדוק את מפתח ה-API</AlertDescription>
        </Alert>
      </div>
    );
  }

  const usagePercent = (data.rate_limit.spent_usd / data.rate_limit.cap_usd) * 100;

  return (
    <div className="min-h-screen bg-background p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">דשבורד לקוח</h1>
            <p className="text-muted-foreground">מעקב שימוש וזיהוי כאב</p>
          </div>
          <Badge variant="outline">
            <Clock className="h-4 w-4 ml-1" />
            עודכן לאחרונה: {format(new Date(), 'HH:mm')}
          </Badge>
        </div>

        {/* Guardian Offer Alert */}
        {data.guardian_offer && (
          <Alert className="border-2 border-primary bg-primary/5">
            <Shield className="h-5 w-5 text-primary" />
            <AlertTitle className="text-lg">🎯 הצעת Guardian זמינה!</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                זיהינו סיכון לאובדן של{' '}
                <span className="font-bold text-orange-500">
                  ${data.guardian_offer.estimated_monthly_loss_usd.toLocaleString()}/חודש
                </span>
                . Guardian מונע/מתקן את זה אוטונומית.
              </p>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-primary">
                  ${data.guardian_offer.price_usd}
                </span>
                <span className="text-muted-foreground">/חודש</span>
                {data.guardian_offer.payment_link && (
                  <Button asChild className="gap-2">
                    <a href={data.guardian_offer.payment_link} target="_blank" rel="noopener noreferrer">
                      הפעל Guardian
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Rate Limit Card */}
        <Card className={data.rate_limit.blocked ? 'border-red-500' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>תקרת שימוש יומית</span>
              {data.rate_limit.blocked && (
                <Badge variant="destructive">חסום</Badge>
              )}
            </CardTitle>
            <CardDescription>
              ${data.rate_limit.spent_usd.toFixed(2)} מתוך ${data.rate_limit.cap_usd.toFixed(2)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress 
              value={usagePercent} 
              className={usagePercent > 80 ? 'bg-red-200' : ''} 
            />
            <p className="text-sm text-muted-foreground mt-2">
              נותרו: ${data.rate_limit.remaining_usd.toFixed(2)} | {data.rate_limit.hits_count} קריאות
            </p>
          </CardContent>
        </Card>

        {/* Today's Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>ציון כאב היום</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getSeverityColor(data.today.pain_score)}`}>
                {data.today.pain_score}
              </div>
              <p className="text-sm text-muted-foreground">
                {data.today.top_problem || 'אין בעיות'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>הפסד משוער היום</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-500">
                ${data.today.estimated_loss_usd.toFixed(0)}
              </div>
              <p className="text-sm text-muted-foreground">
                {data.today.events_count} אירועים
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>הפסד חודשי משוער</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">
                ${data.summary_7d.estimated_monthly_loss_usd.toFixed(0)}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-4 w-4" />
                מבוסס על 7 ימים
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>ממוצע כאב יומי</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {data.summary_7d.avg_daily_pain.toFixed(1)}
              </div>
              <p className="text-sm text-muted-foreground">
                {data.summary_7d.days_with_data} ימים עם נתונים
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Problems Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className={data.today.wallet_risk_high_count > 0 ? 'border-orange-500' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.today.wallet_risk_high_count}</p>
                  <p className="text-sm text-muted-foreground">ארנקים בסיכון גבוה</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={data.today.webhook_failures_count > 0 ? 'border-blue-500' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Webhook className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{data.today.webhook_failures_count}</p>
                  <p className="text-sm text-muted-foreground">כשלונות Webhook</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={data.today.payment_drift_usd > 0 ? 'border-green-500' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">${data.today.payment_drift_usd.toFixed(0)}</p>
                  <p className="text-sm text-muted-foreground">פער בתשלומים</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Events Table */}
        <Card>
          <CardHeader>
            <CardTitle>אירועים אחרונים</CardTitle>
            <CardDescription>20 הקריאות האחרונות למוצרי סנסור</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">מוצר</TableHead>
                  <TableHead className="text-right">חומרה</TableHead>
                  <TableHead className="text-right">הפסד משוער</TableHead>
                  <TableHead className="text-right">עלות</TableHead>
                  <TableHead className="text-right">זמן</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="flex items-center gap-2">
                      {getProductIcon(event.product)}
                      <span>{event.product}</span>
                    </TableCell>
                    <TableCell>
                      <span className={getSeverityColor(event.severity)}>
                        {event.severity}
                      </span>
                    </TableCell>
                    <TableCell>${event.loss_usd.toFixed(0)}</TableCell>
                    <TableCell>${event.cost_usd.toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(event.created_at), 'HH:mm:ss')}
                    </TableCell>
                  </TableRow>
                ))}
                {data.recent_events.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      אין אירועים עדיין. התחל לבצע קריאות API.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
