/**
 * צייד אוטונומי Dashboard
 * מצב מפלצת toggle, activity log, הרצה יבשה, and lead stats
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { getPartnerBrand } from '@/lib/partnerLogos';
import {
  Crosshair,
  Zap,
  Shield,
  Play,
  Pause,
  Eye,
  Send,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Loader2,
  Radio,
  BarChart3,
} from 'lucide-react';

interface HunterSettings {
  monster_mode: boolean;
  dry_run_mode: boolean;
  daily_limit: number;
  sends_today: number;
  last_run_at: string | null;
  domain: string;
}

interface ActivityEntry {
  id: string;
  action: string;
  lead_id: string | null;
  partner_name: string | null;
  details: string;
  status: string;
  dry_run: boolean;
  created_at: string;
}

interface LeadStat {
  status: string;
  count: number;
}

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STATUS_COLORS: Record<string, string> = {
  success: 'text-emerald-400',
  error: 'text-destructive',
  warning: 'text-amber-400',
  info: 'text-muted-foreground',
};

export default function HunterDashboard() {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);

  // Fetch settings
  const { data: settings } = useQuery<HunterSettings>({
    queryKey: ['hunter-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hunter_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as HunterSettings;
    },
  });

  // Fetch activity log
  const { data: activityLog = [] } = useQuery<ActivityEntry[]>({
    queryKey: ['hunter-activity-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hunter_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as ActivityEntry[];
    },
    refetchInterval: 10000,
  });

  // Fetch lead stats
  const { data: leadStats = [] } = useQuery<LeadStat[]>({
    queryKey: ['hunter-lead-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('auto_leads')
        .select('status');
      if (!data) return [];
      const counts: Record<string, number> = {};
      data.forEach((r: any) => {
        counts[r.status] = (counts[r.status] || 0) + 1;
      });
      return Object.entries(counts).map(([status, count]) => ({ status, count }));
    },
  });

  // Toggle מצב מפלצת
  const toggleMonster = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.functions.invoke('autonomous-hunter', {
        body: { action: 'toggle' },
      });
      // Direct update via admin — since RLS restricts, we use the function
      // For now, update directly (service_role via function)
      // We'll update through the settings endpoint
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hunter-settings'] }),
  });

  // Update settings via supabase (admin)
  const updateSetting = async (field: string, value: any) => {
    // Using supabase function invoke for admin actions
    const { error } = await supabase
      .from('hunter_settings')
      .update({ [field]: value })
      .eq('id', true);
    
    if (error) {
      toast({ title: 'שגיאה', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ עודכן' });
      queryClient.invalidateQueries({ queryKey: ['hunter-settings'] });
    }
  };

  // Manual run
  const runHunter = async (action: string) => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('autonomous-hunter', {
        body: { action },
      });
      if (error) throw error;
      toast({
        title: '🎯 Hunter Executed',
        description: `Discovered: ${data?.discovered || 0} | Sent: ${data?.sent || 0} | הרצה יבשה: ${data?.dry_run ? 'Yes' : 'No'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['hunter-activity-log'] });
      queryClient.invalidateQueries({ queryKey: ['hunter-lead-stats'] });
    } catch (err: any) {
      toast({ title: 'שגיאה', description: err.message, variant: 'destructive' });
    } finally {
      setIsRunning(false);
    }
  };

  const totalLeads = leadStats.reduce((s, l) => s + l.count, 0);
  const sentCount = leadStats.find(l => l.status === 'sent')?.count || 0;
  const discoveredCount = leadStats.find(l => l.status === 'discovered')?.count || 0;

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                <Crosshair className="w-5 h-5 text-white" />
              </div>
              צייד אוטונומי
            </h1>
            <p className="text-muted-foreground mt-1">Lead Discovery & Outreach Engine</p>
          </div>
          <div className="flex items-center gap-2">
            {settings?.monster_mode ? (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/50 gap-1">
                <Radio className="w-3 h-3 animate-pulse" /> מצב מפלצת
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1">
                <Pause className="w-3 h-3" /> Standby
              </Badge>
            )}
            {settings?.dry_run_mode && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-400 bg-amber-500/10 gap-1">
                <Eye className="w-3 h-3" /> הרצה יבשה
              </Badge>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-border/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">סה״כ לידים</p>
              <p className="text-2xl font-bold mt-1">{totalLeads}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-border/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">נשלח</p>
              <p className="text-2xl font-bold mt-1 text-emerald-400">{sentCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-border/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">ממתין</p>
              <p className="text-2xl font-bold mt-1 text-amber-400">{discoveredCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-border/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase">שליחות היום</p>
              <p className="text-2xl font-bold mt-1">
                {settings?.sends_today || 0}/{settings?.daily_limit || 50}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Panel */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                בקרות ראשיות
              </CardTitle>
              <CardDescription>הגדרות בטיחות וביצוע</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* מצב מפלצת Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-red-400" />
                    מצב מפלצת
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Autonomous discovery + outreach
                  </p>
                </div>
                <Switch
                  checked={settings?.monster_mode || false}
                  onCheckedChange={(v) => updateSetting('monster_mode', v)}
                />
              </div>

              <Separator />

              {/* הרצה יבשה Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Eye className="w-4 h-4 text-amber-400" />
                    מצב הרצה יבשה
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    סימולציה ללא שליחה
                  </p>
                </div>
                <Switch
                  checked={settings?.dry_run_mode ?? true}
                  onCheckedChange={(v) => updateSetting('dry_run_mode', v)}
                />
              </div>

              <Separator />

              {/* מגבלה יומית */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">מגבלה יומית</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    מקסימום שליחות ביום
                  </p>
                </div>
                <Input
                  type="number"
                  className="w-20 bg-muted/30"
                  value={settings?.daily_limit || 50}
                  onChange={(e) => updateSetting('daily_limit', parseInt(e.target.value) || 50)}
                  dir="ltr"
                />
              </div>

              <Separator />

              {/* Domain */}
              <div>
                <Label className="text-sm font-semibold">דומיין שליחה</Label>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono" dir="ltr">
                  {settings?.domain || 'getsignalforge.com'}
                </p>
              </div>

              <Separator />

              {/* Manual Actions */}
              <div className="space-y-2">
                <Button
                  onClick={() => runHunter('full_cycle')}
                  disabled={isRunning}
                  className="w-full gap-2"
                  variant={settings?.dry_run_mode ? 'outline' : 'default'}
                >
                  {isRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {settings?.dry_run_mode ? 'הרץ מחזור יבש' : 'הרץ מחזור מלא'}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => runHunter('discover')}
                    disabled={isRunning}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    <Target className="w-3.5 h-3.5" /> Discover
                  </Button>
                  <Button
                    onClick={() => runHunter('send')}
                    disabled={isRunning}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    <Send className="w-3.5 h-3.5" /> Send
                  </Button>
                </div>
              </div>

              {settings?.last_run_at && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Last run: {new Date(settings.last_run_at).toLocaleString('he-IL')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                יומן פעילות חי
                <Badge variant="outline" className="ml-auto text-xs">
                  {activityLog.length} entries
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {activityLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">
                    אין פעילות עדיין. הרץ מחזור כדי לראות תוצאות.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activityLog.map((entry) => {
                      const Icon = STATUS_ICONS[entry.status] || Info;
                      const color = STATUS_COLORS[entry.status] || 'text-muted-foreground';
                      const brand = entry.partner_name ? getPartnerBrand(entry.partner_name) : null;

                      return (
                        <div
                          key={entry.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/10 border border-border/20 hover:bg-muted/20 transition-colors"
                        >
                          <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">
                                {new Date(entry.created_at).toLocaleTimeString('he-IL')}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {entry.action}
                              </Badge>
                              {entry.partner_name && brand && (
                                <Badge
                                  className="text-[10px] text-white"
                                  style={{ backgroundColor: brand.color }}
                                >
                                  {brand.initials} {entry.partner_name}
                                </Badge>
                              )}
                              {entry.dry_run && (
                                <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-400">
                                  הרצה יבשה
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 break-words" dir="ltr">
                              {entry.details}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* פירוט סטטוס לידים */}
        {leadStats.length > 0 && (
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">פירוט סטטוס לידים</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {leadStats.map((stat) => (
                  <div key={stat.status} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/20 border border-border/30">
                    <span className={`w-2 h-2 rounded-full ${
                      stat.status === 'sent' ? 'bg-emerald-400' :
                      stat.status === 'discovered' ? 'bg-cyan-400' :
                      stat.status === 'dry_run_ready' ? 'bg-amber-400' :
                      stat.status === 'failed' ? 'bg-destructive' :
                      'bg-muted-foreground'
                    }`} />
                    <span className="text-sm font-medium capitalize">{stat.status.replace('_', ' ')}</span>
                    <span className="text-sm font-bold">{stat.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
