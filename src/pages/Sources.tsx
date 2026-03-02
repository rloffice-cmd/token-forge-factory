import { AppLayout } from '@/components/AppLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { 
  Rss, 
  RefreshCw, 
  Plus,
  Loader2,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Search,
  Globe
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Sources() {
  const queryClient = useQueryClient();

  // Fetch sources
  const { data: sources, isLoading } = useQuery({
    queryKey: ['offer-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offer_sources')
        .select('*')
        .order('health_score', { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Toggle source active status
  const toggleSource = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('offer_sources')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offer-sources'] });
      toast.success('מקור עודכן בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בעדכון מקור');
    },
  });

  // Trigger source discovery
  const discoverSources = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('brain-discover-sources', {
        body: { action: 'discover' }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offer-sources'] });
      toast.success('גילוי מקורות הופעל');
    },
    onError: () => {
      toast.error('שגיאה בהפעלת גילוי מקורות');
    },
  });

  const getSourceTypeBadge = (type: string) => {
    switch (type) {
      case 'rss':
        return <Badge className="bg-orange-500"><Rss className="w-3 h-3 mr-1" />RSS</Badge>;
      case 'api':
        return <Badge className="bg-blue-500"><Zap className="w-3 h-3 mr-1" />API</Badge>;
      case 'search':
        return <Badge className="bg-purple-500"><Search className="w-3 h-3 mr-1" />חיפוש</Badge>;
      case 'webhook':
        return <Badge className="bg-green-500"><Globe className="w-3 h-3 mr-1" />ווב-הוק</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const getHealthIndicator = (score: number | null) => {
    const s = score || 0;
    if (s >= 0.8) return <CheckCircle className="w-5 h-5 text-success" />;
    if (s >= 0.5) return <AlertTriangle className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-destructive" />;
  };

  // Stats
  const activeSources = sources?.filter(s => s.is_active).length || 0;
  const totalSources = sources?.length || 0;
  const avgHealth = sources && sources.length > 0
    ? (sources.reduce((acc, s) => acc + (s.health_score || 0), 0) / sources.length * 100).toFixed(0)
    : '0';
  const recentlyScanned = sources?.filter(s => {
    if (!s.last_scanned_at) return false;
    const diff = Date.now() - new Date(s.last_scanned_at).getTime();
    return diff < 60 * 60 * 1000; // Last hour
  }).length || 0;

  return (
    <AppLayout>
      <div className="p-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Rss className="w-8 h-8 text-primary" />
              מקורות סריקה (Sources)
            </h1>
            <p className="text-muted-foreground">
              ניהול מקורות RSS, API וחיפוש לזיהוי ביקוש
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => discoverSources.mutate()}
              disabled={discoverSources.isPending}
            >
              {discoverSources.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              גלה מקורות חדשים
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">מקורות פעילים</p>
                  <p className="text-2xl font-bold">{activeSources}</p>
                  <p className="text-xs text-muted-foreground">מתוך {totalSources}</p>
                </div>
                <div className="p-3 rounded-full bg-success/10">
                  <CheckCircle className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">בריאות ממוצעת</p>
                  <p className="text-2xl font-bold">{avgHealth}%</p>
                  <p className="text-xs text-muted-foreground">ציון בריאות</p>
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">נסרקו לאחרונה</p>
                  <p className="text-2xl font-bold">{recentlyScanned}</p>
                  <p className="text-xs text-muted-foreground">בשעה האחרונה</p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/10">
                  <RefreshCw className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סוגי מקורות</p>
                  <p className="text-2xl font-bold">
                    {new Set(sources?.map(s => s.source_type) || []).size}
                  </p>
                  <p className="text-xs text-muted-foreground">RSS, API, חיפוש</p>
                </div>
                <div className="p-3 rounded-full bg-purple-500/10">
                  <Globe className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sources Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rss className="w-5 h-5" />
              רשימת מקורות
            </CardTitle>
            <CardDescription>
              כל המקורות הפעילים לסריקת ביקוש
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : sources && sources.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>פעיל</TableHead>
                    <TableHead>מקור</TableHead>
                    <TableHead>סוג</TableHead>
                    <TableHead>בריאות</TableHead>
                    <TableHead>מילות מפתח</TableHead>
                    <TableHead>סריקה אחרונה</TableHead>
                    <TableHead>כשלונות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.id} className={!source.is_active ? 'opacity-50' : ''}>
                      <TableCell>
                        <Switch
                          checked={source.is_active}
                          onCheckedChange={(checked) => 
                            toggleSource.mutate({ id: source.id, isActive: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{source.name}</p>
                          <a 
                            href={source.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                          >
                            <span className="truncate max-w-[200px]">{source.url}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </TableCell>
                      <TableCell>{getSourceTypeBadge(source.source_type)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getHealthIndicator(source.health_score)}
                          <div className="w-16">
                            <Progress 
                              value={(source.health_score || 0) * 100} 
                              className="h-2"
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {((source.health_score || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {source.query_keywords?.slice(0, 3).map((kw, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                          {source.query_keywords && source.query_keywords.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{source.query_keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {source.last_scanned_at ? (
                          <span className="text-sm">
                            {formatDistanceToNow(new Date(source.last_scanned_at), { 
                              addSuffix: true, 
                              locale: he 
                            })}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">טרם נסרק</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={source.failure_count && source.failure_count > 5 ? 'destructive' : 'secondary'}
                        >
                          {source.failure_count || 0}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Rss className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p>אין מקורות מוגדרים</p>
                <Button 
                  variant="link" 
                  onClick={() => discoverSources.mutate()}
                  disabled={discoverSources.isPending}
                >
                  הפעל גילוי אוטומטי
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
