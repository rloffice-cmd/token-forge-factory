import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Brain, 
  Zap, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Loader2,
  RefreshCw,
  Play,
  Pause,
  Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

type EngineConfigRow = {
  id: string;
  config_key: string;
  config_value: boolean | string | number;
  description: string | null;
  updated_at: string;
};

type DemandSignalRow = {
  id: string;
  source_url: string | null;
  query_text: string;
  urgency_score: number | null;
  relevance_score: number | null;
  category: string | null;
  status: string;
  detected_at: string;
  rejection_reason: string | null;
};

type OpportunityRow = {
  id: string;
  expected_value_usd: number | null;
  composite_score: number | null;
  confidence_score: number | null;
  risk_flags: string[] | null;
  status: string;
  auto_approved: boolean | null;
  created_at: string;
  demand_signals: {
    query_text: string;
    source_url: string | null;
  } | null;
  offers: {
    name: string;
  } | null;
};

export default function Intelligence() {
  const queryClient = useQueryClient();
  const [isScanning, setIsScanning] = useState(false);

  // Fetch engine config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['engine-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engine_config')
        .select('*')
        .order('config_key');
      if (error) throw error;
      return data as EngineConfigRow[];
    },
  });

  // Fetch demand signals
  const { data: signals, isLoading: signalsLoading } = useQuery({
    queryKey: ['demand-signals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demand_signals')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as DemandSignalRow[];
    },
  });

  // Fetch opportunities
  const { data: opportunities, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('opportunities')
        .select(`
          *,
          demand_signals (query_text, source_url),
          offers (name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as OpportunityRow[];
    },
  });

  // Update config mutation
  const updateConfig = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean | string | number }) => {
      const { error } = await supabase
        .from('engine_config')
        .update({ config_value: value })
        .eq('config_key', key);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['engine-config'] });
      toast.success('הגדרה עודכנה');
    },
    onError: () => {
      toast.error('שגיאה בעדכון הגדרה');
    },
  });

  // Update opportunity status
  const updateOpportunity = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === 'approved') {
        updates.approved_at = new Date().toISOString();
      }
      const { error } = await supabase
        .from('opportunities')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      toast.success('הזדמנות עודכנה');
    },
    onError: () => {
      toast.error('שגיאה בעדכון הזדמנות');
    },
  });

  // Run scanner manually
  const runScanner = async () => {
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('demand-scanner');
      if (error) throw error;
      toast.success(`סריקה הושלמה: ${data?.signals_found || 0} סיגנלים חדשים`);
      queryClient.invalidateQueries({ queryKey: ['demand-signals'] });
    } catch (error) {
      toast.error('שגיאה בסריקה');
    } finally {
      setIsScanning(false);
    }
  };

  const getConfigValue = (key: string): boolean | string | number => {
    const item = config?.find(c => c.config_key === key);
    return item?.config_value ?? false;
  };

  const isConfigEnabled = (key: string): boolean => {
    const value = getConfigValue(key);
    return value === true || value === 'true';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="outline" className="border-blue-500 text-blue-500"><Clock className="w-3 h-3 mr-1" />חדש</Badge>;
      case 'approved':
        return <Badge className="bg-success"><CheckCircle2 className="w-3 h-3 mr-1" />מאושר</Badge>;
      case 'closed':
        return <Badge className="bg-primary"><Zap className="w-3 h-3 mr-1" />נסגר</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />נדחה</Badge>;
      case 'matched':
        return <Badge className="bg-blue-500"><TrendingUp className="w-3 h-3 mr-1" />מותאם</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Stats
  const totalSignals = signals?.length || 0;
  const newSignals = signals?.filter(s => s.status === 'new').length || 0;
  const totalOpportunities = opportunities?.length || 0;
  const approvedOpportunities = opportunities?.filter(o => o.status === 'approved' || o.status === 'closed').length || 0;
  const conversionRate = totalOpportunities > 0 ? ((approvedOpportunities / totalOpportunities) * 100).toFixed(1) : '0';

  return (
    <AppLayout>
      <div className="p-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Brain className="w-8 h-8 text-primary" />
              מנוע אינטליגנציה
            </h1>
            <p className="text-muted-foreground">
              Demand-to-Deal Engine - גילוי וסגירת עסקאות אוטומטית
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => queryClient.invalidateQueries()}
            >
              <RefreshCw className="w-4 h-4 ml-2" />
              רענן
            </Button>
            <Button 
              onClick={runScanner}
              disabled={isScanning}
            >
              {isScanning ? (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 ml-2" />
              )}
              הרץ סריקה
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סיגנלים</p>
                  <p className="text-2xl font-bold">{totalSignals}</p>
                  <p className="text-xs text-muted-foreground">{newSignals} חדשים</p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Zap className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">הזדמנויות</p>
                  <p className="text-2xl font-bold">{totalOpportunities}</p>
                  <p className="text-xs text-muted-foreground">{approvedOpportunities} מאושרות</p>
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">המרה</p>
                  <p className="text-2xl font-bold">{conversionRate}%</p>
                  <p className="text-xs text-muted-foreground">Signal → Deal</p>
                </div>
                <div className="p-3 rounded-full bg-success/10">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">מנוע</p>
                  <p className="text-2xl font-bold">
                    {isConfigEnabled('scan_enabled') ? 'פעיל' : 'מושהה'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isConfigEnabled('auto_closing_enabled') ? 'סגירה אוטומטית' : 'ידני'}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${isConfigEnabled('scan_enabled') ? 'bg-success/10' : 'bg-muted'}`}>
                  {isConfigEnabled('scan_enabled') ? (
                    <Play className="w-6 h-6 text-success" />
                  ) : (
                    <Pause className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Engine Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              בקרת מנוע
            </CardTitle>
            <CardDescription>הגדרות גלובליות למנוע Demand-to-Deal</CardDescription>
          </CardHeader>
          <CardContent>
            {configLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">סריקת ביקוש</p>
                    <p className="text-sm text-muted-foreground">איתור סיגנלים ממקורות</p>
                  </div>
                  <Switch
                    checked={isConfigEnabled('scan_enabled')}
                    onCheckedChange={(checked) => updateConfig.mutate({ key: 'scan_enabled', value: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">סגירה אוטומטית</p>
                    <p className="text-sm text-muted-foreground">יצירת Checkouts אוטומטית</p>
                  </div>
                  <Switch
                    checked={isConfigEnabled('auto_closing_enabled')}
                    onCheckedChange={(checked) => updateConfig.mutate({ key: 'auto_closing_enabled', value: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">אספקה אוטומטית</p>
                    <p className="text-sm text-muted-foreground">הנפקת API Keys/Reports</p>
                  </div>
                  <Switch
                    checked={isConfigEnabled('fulfillment_enabled')}
                    onCheckedChange={(checked) => updateConfig.mutate({ key: 'fulfillment_enabled', value: checked })}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Tables */}
        <Tabs defaultValue="opportunities" className="space-y-4">
          <TabsList>
            <TabsTrigger value="opportunities">הזדמנויות</TabsTrigger>
            <TabsTrigger value="signals">סיגנלים</TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities">
            <Card>
              <CardHeader>
                <CardTitle>הזדמנויות פעילות</CardTitle>
                <CardDescription>סיגנלים שעברו ניקוד והותאמו למוצרים</CardDescription>
              </CardHeader>
              <CardContent>
                {opportunitiesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : opportunities && opportunities.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>סיגנל</TableHead>
                        <TableHead>הצעה</TableHead>
                        <TableHead>ציון</TableHead>
                        <TableHead>ערך צפוי</TableHead>
                        <TableHead>סטטוס</TableHead>
                        <TableHead>פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {opportunities.map((opp) => (
                        <TableRow key={opp.id}>
                          <TableCell>
                            <div className="max-w-[200px]">
                              <p className="truncate font-medium">{opp.demand_signals?.query_text || '-'}</p>
                              {opp.demand_signals?.source_url && (
                                <a 
                                  href={opp.demand_signals.source_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  מקור
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{opp.offers?.name || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <div 
                                className="h-2 rounded-full bg-primary" 
                                style={{ width: `${(opp.composite_score || 0) * 50}px` }}
                              />
                              <span className="text-sm">{((opp.composite_score || 0) * 100).toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>${opp.expected_value_usd || 0}</TableCell>
                          <TableCell>
                            {getStatusBadge(opp.status)}
                            {opp.auto_approved && (
                              <Badge variant="outline" className="mr-1 text-xs">אוטומטי</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {opp.status === 'new' && (
                              <div className="flex gap-1">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => updateOpportunity.mutate({ id: opp.id, status: 'approved' })}
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => updateOpportunity.mutate({ id: opp.id, status: 'rejected' })}
                                >
                                  <XCircle className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>אין הזדמנויות עדיין</p>
                    <p className="text-sm">הפעל את הסריקה או הוסף מקורות</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signals">
            <Card>
              <CardHeader>
                <CardTitle>סיגנלי ביקוש</CardTitle>
                <CardDescription>ביקושים שזוהו ממקורות מוגדרים</CardDescription>
              </CardHeader>
              <CardContent>
                {signalsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : signals && signals.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>טקסט</TableHead>
                        <TableHead>קטגוריה</TableHead>
                        <TableHead>דחיפות</TableHead>
                        <TableHead>רלוונטיות</TableHead>
                        <TableHead>סטטוס</TableHead>
                        <TableHead>זמן</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signals.map((signal) => (
                        <TableRow key={signal.id}>
                          <TableCell>
                            <div className="max-w-[250px]">
                              <p className="truncate">{signal.query_text}</p>
                              {signal.source_url && (
                                <a 
                                  href={signal.source_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline"
                                >
                                  מקור
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{signal.category || 'כללי'}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{((signal.urgency_score || 0) * 100).toFixed(0)}%</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{((signal.relevance_score || 0) * 100).toFixed(0)}%</span>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(signal.status)}
                            {signal.rejection_reason && (
                              <p className="text-xs text-muted-foreground mt-1">{signal.rejection_reason}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(signal.detected_at), { addSuffix: true, locale: he })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>אין סיגנלים עדיין</p>
                    <p className="text-sm">הוסף מקורות והפעל סריקה</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
