import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Shield, 
  Wallet, 
  Webhook, 
  DollarSign, 
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Zap,
  Target
} from 'lucide-react';
import { format } from 'date-fns';

interface PainScore {
  id: string;
  customer_id: string;
  window_date: string;
  pain_score_total: number;
  estimated_loss_usd_total: number;
  events_count: number;
  top_problem_type: string | null;
  wallet_risk_high_count: number;
  webhook_failures_count: number;
  payment_drift_total_usd: number;
}

interface MicroEvent {
  id: string;
  customer_id: string;
  product: string;
  severity: number;
  estimated_loss_usd: number;
  cost_usd: number;
  raw_output: Record<string, unknown>;
  created_at: string;
}

interface GuardianOffer {
  id: string;
  customer_id: string;
  estimated_monthly_loss_usd: number;
  reason: string;
  price_usd: number;
  status: string;
  expires_at: string;
  created_at: string;
}

interface RateLimit {
  id: string;
  customer_id: string;
  limit_date: string;
  spent_usd: number;
  cap_usd: number;
  hits_count: number;
  blocked_at: string | null;
}

export default function MicroAdminDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');

  // Fetch pain scores
  const { data: painScores = [] } = useQuery({
    queryKey: ['admin-pain-scores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pain_scores')
        .select('*')
        .order('window_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as PainScore[];
    },
  });

  // Fetch micro events
  const { data: events = [] } = useQuery({
    queryKey: ['admin-micro-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('micro_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as MicroEvent[];
    },
  });

  // Fetch guardian offers
  const { data: offers = [] } = useQuery({
    queryKey: ['admin-guardian-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guardian_offers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as GuardianOffer[];
    },
  });

  // Fetch auto-offer rules
  const { data: rules = [] } = useQuery({
    queryKey: ['admin-auto-offer-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auto_offer_rules')
        .select('*')
        .order('priority', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate KPIs
  const today = new Date().toISOString().split('T')[0];
  const todayEvents = events.filter(e => e.created_at.startsWith(today));
  const todayOffers = offers.filter(o => o.created_at.startsWith(today));
  const paidOffers = offers.filter(o => o.status === 'paid');
  const todayRevenue = todayEvents.reduce((sum, e) => sum + e.cost_usd, 0);
  const totalRevenue = events.reduce((sum, e) => sum + e.cost_usd, 0);

  const getProductIcon = (product: string) => {
    switch (product) {
      case 'wallet-risk': return <Wallet className="h-4 w-4 text-orange-500" />;
      case 'webhook-check': return <Webhook className="h-4 w-4 text-blue-500" />;
      case 'payment-drift': return <DollarSign className="h-4 w-4 text-green-500" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getSeverityBadge = (severity: number) => {
    if (severity >= 8) return <Badge variant="destructive">{severity}</Badge>;
    if (severity >= 5) return <Badge className="bg-orange-500">{severity}</Badge>;
    return <Badge variant="secondary">{severity}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      created: 'bg-blue-500',
      sent: 'bg-purple-500',
      viewed: 'bg-yellow-500',
      paid: 'bg-green-500',
      expired: 'bg-gray-500',
      declined: 'bg-red-500',
    };
    return <Badge className={variants[status] || 'bg-gray-500'}>{status}</Badge>;
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background p-6" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Micro Stack Admin</h1>
              <p className="text-muted-foreground">ניהול מוצרי חיישנים ו-Auto-Upsell</p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              <Shield className="h-5 w-5 ml-2 text-primary" />
              Sensor Layer v0
            </Badge>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardHeader className="pb-2">
                <CardDescription>אירועים היום</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{todayEvents.length}</div>
                <p className="text-sm text-muted-foreground">קריאות מיקרו</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader className="pb-2">
                <CardDescription>הצעות Guardian היום</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{todayOffers.length}</div>
                <p className="text-sm text-muted-foreground">Auto-Upsell</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardDescription>הצעות ששולמו</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{paidOffers.length}</div>
                <p className="text-sm text-muted-foreground">${paidOffers.length * 499} סה"כ</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardDescription>הכנסות מיקרו</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">${todayRevenue.toFixed(2)}</div>
                <p className="text-sm text-muted-foreground">סה"כ: ${totalRevenue.toFixed(2)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
              <TabsTrigger value="overview">סקירה</TabsTrigger>
              <TabsTrigger value="events">אירועים</TabsTrigger>
              <TabsTrigger value="offers">הצעות</TabsTrigger>
              <TabsTrigger value="rules">חוקים</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent Pain Scores */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      ציוני כאב אחרונים
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {painScores.slice(0, 5).map((score) => (
                        <div key={score.id} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <p className="text-sm font-medium">{score.window_date}</p>
                            <p className="text-xs text-muted-foreground">
                              {score.events_count} אירועים | {score.top_problem_type || 'ללא בעיה'}
                            </p>
                          </div>
                          <div className="text-left">
                            <p className="text-lg font-bold text-orange-500">
                              {score.pain_score_total}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ${score.estimated_loss_usd_total.toFixed(0)} הפסד
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Offers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      הצעות Guardian אחרונות
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {offers.slice(0, 5).map((offer) => (
                        <div key={offer.id} className="flex items-center justify-between border-b pb-2">
                          <div>
                            <p className="text-sm font-medium">{offer.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(offer.created_at), 'dd/MM HH:mm')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              ${offer.estimated_monthly_loss_usd.toFixed(0)}/חודש
                            </span>
                            {getStatusBadge(offer.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Events Tab */}
            <TabsContent value="events">
              <Card>
                <CardHeader>
                  <CardTitle>אירועי מיקרו</CardTitle>
                  <CardDescription>כל הקריאות למוצרי הסנסור</CardDescription>
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
                      {events.slice(0, 20).map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="flex items-center gap-2">
                            {getProductIcon(event.product)}
                            <span className="text-sm">{event.product}</span>
                          </TableCell>
                          <TableCell>{getSeverityBadge(event.severity)}</TableCell>
                          <TableCell>${event.estimated_loss_usd.toFixed(0)}</TableCell>
                          <TableCell>${event.cost_usd.toFixed(2)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(event.created_at), 'dd/MM HH:mm:ss')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Offers Tab */}
            <TabsContent value="offers">
              <Card>
                <CardHeader>
                  <CardTitle>הצעות Guardian</CardTitle>
                  <CardDescription>Auto-Upsell ל-$499/חודש</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">סיבה</TableHead>
                        <TableHead className="text-right">הפסד חודשי</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">פג תוקף</TableHead>
                        <TableHead className="text-right">נוצר</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {offers.map((offer) => (
                        <TableRow key={offer.id}>
                          <TableCell className="font-medium">{offer.reason}</TableCell>
                          <TableCell className="text-orange-500 font-bold">
                            ${offer.estimated_monthly_loss_usd.toFixed(0)}
                          </TableCell>
                          <TableCell>{getStatusBadge(offer.status)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(offer.expires_at), 'dd/MM/yy')}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(offer.created_at), 'dd/MM HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Rules Tab */}
            <TabsContent value="rules">
              <Card>
                <CardHeader>
                  <CardTitle>חוקי Auto-Offer</CardTitle>
                  <CardDescription>כללים להפעלת הצעות Guardian אוטומטיות</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">שם החוק</TableHead>
                        <TableHead className="text-right">סוג</TableHead>
                        <TableHead className="text-right">סף</TableHead>
                        <TableHead className="text-right">חלון זמן</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map((rule: any) => (
                        <TableRow key={rule.id}>
                          <TableCell className="font-medium">{rule.rule_name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{rule.rule_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {rule.threshold_value} {rule.threshold_unit}
                          </TableCell>
                          <TableCell>{rule.time_window_hours}h</TableCell>
                          <TableCell>
                            {rule.is_active ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
