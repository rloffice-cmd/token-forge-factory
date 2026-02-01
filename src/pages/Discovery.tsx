import { AppLayout } from '@/components/AppLayout';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Compass, 
  Users, 
  Sparkles, 
  TrendingUp,
  Loader2,
  ExternalLink,
  Star,
  Target,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

export default function Discovery() {
  // Fetch service catalog
  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['service-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_catalog')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch scored leads
  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ['scored-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .not('composite_score', 'is', null)
        .order('composite_score', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'launched':
        return <Badge className="bg-success">פעיל</Badge>;
      case 'planned':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">מתוכנן</Badge>;
      case 'development':
        return <Badge className="bg-primary">בפיתוח</Badge>;
      case 'deprecated':
        return <Badge variant="secondary">הוצא משימוש</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getLeadStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">חדש</Badge>;
      case 'contacted':
        return <Badge className="bg-primary">נוצר קשר</Badge>;
      case 'qualified':
        return <Badge className="bg-success">מוסמך</Badge>;
      case 'converted':
        return <Badge className="bg-amber-500">הומר</Badge>;
      case 'lost':
        return <Badge variant="destructive">אבוד</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getFunnelStageBadge = (stage: string | null) => {
    switch (stage) {
      case 'awareness':
        return <Badge variant="outline">מודעות</Badge>;
      case 'interest':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">עניין</Badge>;
      case 'consideration':
        return <Badge className="bg-primary/20 text-primary">שיקול</Badge>;
      case 'decision':
        return <Badge className="bg-amber-500/20 text-amber-600">החלטה</Badge>;
      case 'purchase':
        return <Badge className="bg-success/20 text-success">רכישה</Badge>;
      default:
        return <Badge variant="secondary">{stage || '-'}</Badge>;
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-muted-foreground';
    if (score >= 0.8) return 'text-success';
    if (score >= 0.5) return 'text-amber-500';
    return 'text-muted-foreground';
  };

  // Stats
  const activeServices = services?.filter(s => s.status === 'active' || s.status === 'launched').length || 0;
  const plannedServices = services?.filter(s => s.status === 'planned').length || 0;
  const qualifiedLeads = leads?.filter(l => l.status === 'qualified' || l.status === 'converted').length || 0;
  const avgScore = leads && leads.length > 0 
    ? (leads.reduce((acc, l) => acc + (l.composite_score || 0), 0) / leads.length * 100).toFixed(0)
    : '0';

  return (
    <AppLayout>
      <div className="p-6 space-y-6" dir="rtl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Compass className="w-8 h-8 text-primary" />
            גילוי והרחבה
          </h1>
          <p className="text-muted-foreground">
            שירותים שזוהו ולידים שדורגו על ידי מנוע ההרחבה
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">שירותים פעילים</p>
                  <p className="text-2xl font-bold">{activeServices}</p>
                  <p className="text-xs text-muted-foreground">{plannedServices} מתוכננים</p>
                </div>
                <div className="p-3 rounded-full bg-success/10">
                  <Sparkles className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">לידים מדורגים</p>
                  <p className="text-2xl font-bold">{leads?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">{qualifiedLeads} מוסמכים</p>
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">ציון ממוצע</p>
                  <p className="text-2xl font-bold">{avgScore}%</p>
                  <p className="text-xs text-muted-foreground">Composite Score</p>
                </div>
                <div className="p-3 rounded-full bg-amber-500/10">
                  <Star className="w-6 h-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">סה"כ שירותים</p>
                  <p className="text-2xl font-bold">{services?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">בקטלוג</p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Target className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Tables */}
        <Tabs defaultValue="services" className="space-y-4">
          <TabsList>
            <TabsTrigger value="services">שירותים</TabsTrigger>
            <TabsTrigger value="leads">לידים מדורגים</TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  קטלוג שירותים
                </CardTitle>
                <CardDescription>שירותים שזוהו והוספו על ידי מנוע ההרחבה</CardDescription>
              </CardHeader>
              <CardContent>
                {servicesLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : services && services.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>שירות</TableHead>
                        <TableHead>קטגוריה</TableHead>
                        <TableHead>סטטוס</TableHead>
                        <TableHead>זוהה ע"י</TableHead>
                        <TableHead>הושק</TableHead>
                        <TableHead>מטריקות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{service.name}</p>
                              <p className="text-xs text-muted-foreground">{service.service_key}</p>
                              {service.description && (
                                <p className="text-xs text-muted-foreground mt-1 max-w-[300px] truncate">
                                  {service.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{service.category}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(service.status)}</TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {service.discovered_by || 'ידני'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {service.launched_at ? (
                              <span className="text-sm">
                                {formatDistanceToNow(new Date(service.launched_at), { addSuffix: true, locale: he })}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {service.metrics && typeof service.metrics === 'object' ? (
                              <div className="text-xs space-y-1">
                                {Object.entries(service.metrics as Record<string, unknown>).slice(0, 2).map(([key, value]) => (
                                  <div key={key} className="flex gap-1">
                                    <span className="text-muted-foreground">{key}:</span>
                                    <span className="font-medium">{String(value)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>אין שירותים בקטלוג</p>
                    <p className="text-sm">מנוע ההרחבה יזהה שירותים חדשים אוטומטית</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  לידים מדורגים
                </CardTitle>
                <CardDescription>לידים שדורגו לפי Composite Score</CardDescription>
              </CardHeader>
              <CardContent>
                {leadsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : leads && leads.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ליד</TableHead>
                        <TableHead>מקור</TableHead>
                        <TableHead>ציון כולל</TableHead>
                        <TableHead>ציוני משנה</TableHead>
                        <TableHead>משפך</TableHead>
                        <TableHead>סטטוס</TableHead>
                        <TableHead>זמן</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {lead.username || lead.email || lead.wallet_address?.slice(0, 10) + '...' || 'אנונימי'}
                              </p>
                              {lead.company && (
                                <p className="text-xs text-muted-foreground">{lead.company}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Badge variant="secondary" className="text-xs">{lead.source}</Badge>
                              {lead.source_url && (
                                <a 
                                  href={lead.source_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div 
                                className="h-2 rounded-full bg-primary" 
                                style={{ width: `${(lead.composite_score || 0) * 60}px` }}
                              />
                              <span className={`text-sm font-medium ${getScoreColor(lead.composite_score)}`}>
                                {((lead.composite_score || 0) * 100).toFixed(0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">כוונה:</span>
                                <span>{((lead.intent_score || 0) * 100).toFixed(0)}%</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">מעורבות:</span>
                                <span>{((lead.engagement_score || 0) * 100).toFixed(0)}%</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground">רלוונטיות:</span>
                                <span>{((lead.relevance_score || 0) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getFunnelStageBadge(lead.funnel_stage)}</TableCell>
                          <TableCell>{getLeadStatusBadge(lead.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: he })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p>אין לידים מדורגים</p>
                    <p className="text-sm">מנוע ההרחבה ידרג לידים אוטומטית</p>
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
