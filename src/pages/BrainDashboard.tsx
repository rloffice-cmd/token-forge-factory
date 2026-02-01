import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, Power, AlertTriangle, Activity, Target, Zap, 
  RefreshCw, Radio, Eye, TrendingUp, Database
} from 'lucide-react';
import { toast } from 'sonner';

interface BrainSettings {
  brain_enabled: boolean;
  scan_enabled: boolean;
  auto_approve_threshold: number;
  min_opportunity_value_usd: number;
  auto_closing_enabled: boolean;
  outreach_enabled: boolean;
  fulfillment_enabled: boolean;
  emergency_stop: boolean;
}

interface OfferSource {
  id: string;
  name: string;
  source_type: string;
  url: string;
  is_active: boolean;
  health_score: number;
  failure_count: number;
  last_scanned_at: string | null;
}

interface Signal {
  id: string;
  title: string;
  intent_type: string;
  confidence: number;
  url: string;
  processed: boolean;
  created_at: string;
}

interface Opportunity {
  id: string;
  composite_score: number;
  est_value_usd: number;
  status: string;
  created_at: string;
  signals?: { title: string };
  offers?: { name_he: string; code: string };
}

export default function BrainDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch brain settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['brain-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brain_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data as BrainSettings;
    }
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['brain-stats'],
    queryFn: async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [signalsRes, oppsRes, paymentsRes, sourcesRes] = await Promise.all([
        supabase.from('demand_signals').select('id', { count: 'exact' }).gte('created_at', yesterday.toISOString()),
        supabase.from('opportunities').select('id, status', { count: 'exact' }).gte('created_at', yesterday.toISOString()),
        supabase.from('payments').select('amount_usd').in('status', ['confirmed', 'resolved']).gte('confirmed_at', weekAgo.toISOString()),
        supabase.from('offer_sources').select('id, is_active, health_score')
      ]);

      const revenue7d = (paymentsRes.data || []).reduce((sum, p) => sum + Number(p.amount_usd || 0), 0);
      const activeSources = (sourcesRes.data || []).filter(s => s.is_active).length;
      const avgHealth = (sourcesRes.data || []).reduce((sum, s) => sum + Number(s.health_score || 0), 0) / (sourcesRes.data?.length || 1);
      const approvedOpps = (oppsRes.data || []).filter(o => o.status === 'approved').length;

      return {
        signals_24h: signalsRes.count || 0,
        opportunities_24h: oppsRes.count || 0,
        approved_24h: approvedOpps,
        revenue_7d: revenue7d,
        active_sources: activeSources,
        avg_health: avgHealth
      };
    }
  });

  // Fetch sources
  const { data: sources } = useQuery({
    queryKey: ['brain-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offer_sources')
        .select('*')
        .order('health_score', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as OfferSource[];
    }
  });

  // Fetch signals (using demand_signals table as fallback)
  const { data: signals } = useQuery({
    queryKey: ['brain-signals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demand_signals')
        .select('id, query_text, category, relevance_score, status, source_url, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map(s => ({
        id: s.id,
        title: s.query_text,
        intent_type: s.category || 'other',
        confidence: s.relevance_score || 0.5,
        url: s.source_url || '',
        processed: s.status !== 'new',
        created_at: s.created_at
      })) as Signal[];
    }
  });

  // Fetch opportunities
  const { data: opportunities } = useQuery({
    queryKey: ['brain-opportunities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          offers(name_he, code)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      
      // Map to expected format
      return (data || []).map(opp => ({
        ...opp,
        signals: undefined // We'll fetch signal titles separately if needed
      })) as Opportunity[];
    }
  });

  // Toggle brain setting
  const toggleMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const { error } = await supabase
        .from('brain_settings')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('id', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain-settings'] });
      toast.success('הגדרות עודכנו');
    },
    onError: () => {
      toast.error('שגיאה בעדכון');
    }
  });

  // Emergency stop
  const emergencyStop = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('brain_settings')
        .update({ 
          brain_enabled: false, 
          emergency_stop: true,
          updated_at: new Date().toISOString() 
        })
        .eq('id', true);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain-settings'] });
      toast.warning('כיבוי חירום בוצע!');
    }
  });

  // Toggle source active
  const toggleSource = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('offer_sources')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brain-sources'] });
      toast.success('מקור עודכן');
    }
  });

  const getHealthColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-500';
    if (score >= 0.5) return 'text-amber-500';
    return 'text-destructive';
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      approved: 'default',
      closed: 'outline',
      rejected: 'destructive'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  if (settingsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Brain Dashboard</h1>
              <p className="text-muted-foreground">לוח בקרה למנוע האוטונומי (דשבורד מוח)</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Brain</span>
              <Switch
                checked={settings?.brain_enabled || false}
                onCheckedChange={(checked) => toggleMutation.mutate({ key: 'brain_enabled', value: checked })}
              />
              <Badge variant={settings?.brain_enabled ? 'default' : 'secondary'}>
                {settings?.brain_enabled ? 'פעיל' : 'כבוי'}
              </Badge>
            </div>
            
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => emergencyStop.mutate()}
              disabled={!settings?.brain_enabled}
            >
              <AlertTriangle className="h-4 w-4 ml-2" />
              כיבוי חירום
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">סיגנלים (24ש')</span>
              </div>
              <p className="text-2xl font-bold mt-2">{stats?.signals_24h || 0}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">הזדמנויות</span>
              </div>
              <p className="text-2xl font-bold mt-2">{stats?.opportunities_24h || 0}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">אושרו אוטו'</span>
              </div>
              <p className="text-2xl font-bold mt-2">{stats?.approved_24h || 0}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">הכנסות (7ימים)</span>
              </div>
              <p className="text-2xl font-bold mt-2">${stats?.revenue_7d?.toFixed(0) || 0}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">מקורות פעילים</span>
              </div>
              <p className="text-2xl font-bold mt-2">{stats?.active_sources || 0}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">בריאות ממוצעת</span>
              </div>
              <p className={`text-2xl font-bold mt-2 ${getHealthColor(stats?.avg_health || 0)}`}>
                {((stats?.avg_health || 0) * 100).toFixed(0)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Power className="h-5 w-5" />
              בקרת מנועים (Engine Controls)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">סריקה (Scan)</span>
                <Switch
                  checked={settings?.scan_enabled || false}
                  onCheckedChange={(checked) => toggleMutation.mutate({ key: 'scan_enabled', value: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">סגירה (Close)</span>
                <Switch
                  checked={settings?.auto_closing_enabled || false}
                  onCheckedChange={(checked) => toggleMutation.mutate({ key: 'auto_closing_enabled', value: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">מילוי (Fulfill)</span>
                <Switch
                  checked={settings?.fulfillment_enabled || false}
                  onCheckedChange={(checked) => toggleMutation.mutate({ key: 'fulfillment_enabled', value: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">פנייה (Outreach)</span>
                <Switch
                  checked={settings?.outreach_enabled || false}
                  onCheckedChange={(checked) => toggleMutation.mutate({ key: 'outreach_enabled', value: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sources">מקורות ({sources?.length || 0})</TabsTrigger>
            <TabsTrigger value="signals">סיגנלים ({signals?.length || 0})</TabsTrigger>
            <TabsTrigger value="opportunities">הזדמנויות ({opportunities?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="sources">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>סוג</TableHead>
                      <TableHead>בריאות</TableHead>
                      <TableHead>כשלונות</TableHead>
                      <TableHead>סריקה אחרונה</TableHead>
                      <TableHead>פעיל</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(sources || []).map((source) => (
                      <TableRow key={source.id}>
                        <TableCell className="font-medium">{source.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{source.source_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className={getHealthColor(source.health_score)}>
                            {(source.health_score * 100).toFixed(0)}%
                          </span>
                        </TableCell>
                        <TableCell>{source.failure_count}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {source.last_scanned_at 
                            ? new Date(source.last_scanned_at).toLocaleString('he-IL')
                            : 'טרם נסרק'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={source.is_active}
                            onCheckedChange={(checked) => 
                              toggleSource.mutate({ id: source.id, is_active: checked })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signals">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>כותרת</TableHead>
                      <TableHead>כוונה</TableHead>
                      <TableHead>ביטחון</TableHead>
                      <TableHead>עובד</TableHead>
                      <TableHead>נוצר</TableHead>
                      <TableHead>קישור</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(signals || []).map((signal) => (
                      <TableRow key={signal.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {signal.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{signal.intent_type || 'other'}</Badge>
                        </TableCell>
                        <TableCell>{(signal.confidence * 100).toFixed(0)}%</TableCell>
                        <TableCell>
                          <Badge variant={signal.processed ? 'secondary' : 'default'}>
                            {signal.processed ? 'כן' : 'לא'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(signal.created_at).toLocaleString('he-IL')}
                        </TableCell>
                        <TableCell>
                          {signal.url && (
                            <a 
                              href={signal.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="opportunities">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>סיגנל</TableHead>
                      <TableHead>מוצר</TableHead>
                      <TableHead>ציון</TableHead>
                      <TableHead>ערך</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>נוצר</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(opportunities || []).map((opp) => (
                      <TableRow key={opp.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {opp.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{opp.offers?.code || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>{((opp.composite_score || 0) * 100).toFixed(0)}%</TableCell>
                        <TableCell>${(opp.est_value_usd || 0).toFixed(0)}</TableCell>
                        <TableCell>{getStatusBadge(opp.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(opp.created_at).toLocaleString('he-IL')}
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
    </AppLayout>
  );
}
