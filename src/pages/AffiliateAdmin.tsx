/**
 * Affiliate Admin Dashboard v2
 * Complete setup and monitoring for affiliate programs
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  DollarSign, MousePointer, TrendingUp, RefreshCw, ExternalLink, 
  Loader2, Copy, CheckCircle, AlertCircle, Rocket, Play, Settings,
  BarChart3
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

interface AffiliateProgram {
  id: string;
  name: string;
  category: string;
  base_url: string;
  commission_type: string;
  commission_value: number;
  cookie_days: number | null;
  affiliate_id: string | null;
  affiliate_link_template: string | null;
  notes: string | null;
  is_active: boolean;
}

export default function AffiliateAdmin() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: programs, isLoading: programsLoading } = useQuery({
    queryKey: ["affiliate-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_programs")
        .select("*")
        .order("commission_value", { ascending: false });
      if (error) throw error;
      return data as AffiliateProgram[];
    },
  });

  const { data: clicks } = useQuery({
    queryKey: ["affiliate-clicks-summary"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("affiliate_clicks")
        .select("program_id, converted")
        .gte("clicked_at", thirtyDaysAgo);
      if (error) throw error;
      
      const summary: Record<string, { total: number; converted: number }> = {};
      for (const click of data) {
        if (!summary[click.program_id]) {
          summary[click.program_id] = { total: 0, converted: 0 };
        }
        summary[click.program_id].total++;
        if (click.converted) summary[click.program_id].converted++;
      }
      return summary;
    },
  });

  const { data: earnings } = useQuery({
    queryKey: ["affiliate-earnings-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_earnings")
        .select("program_id, amount_usd, status");
      if (error) throw error;
      
      const summary: Record<string, { pending: number; approved: number; paid: number }> = {};
      for (const earning of data) {
        if (!summary[earning.program_id]) {
          summary[earning.program_id] = { pending: 0, approved: 0, paid: 0 };
        }
        summary[earning.program_id][earning.status as "pending" | "approved" | "paid"] += earning.amount_usd;
      }
      return summary;
    },
  });

  const { data: content } = useQuery({
    queryKey: ["affiliate-content-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_content")
        .select("status");
      if (error) throw error;
      return {
        published: data.filter(c => c.status === "published").length,
        queued: data.filter(c => c.status === "queued").length,
      };
    },
  });

  const updateAffiliateMutation = useMutation({
    mutationFn: async ({ id, affiliateId }: { id: string; affiliateId: string }) => {
      const { error } = await supabase
        .from("affiliate_programs")
        .update({ affiliate_id: affiliateId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["affiliate-programs"] });
      toast.success("מזהה השותף נשמר בהצלחה!");
      setEditingId(null);
      setEditValue("");
    },
    onError: () => {
      toast.error("שגיאה בשמירת מזהה השותף");
    },
  });

  const runEngineMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("affiliate-automation-engine", {
        body: { action: "full_cycle" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("מחזור הושלם בהצלחה!");
      queryClient.invalidateQueries({ queryKey: ["affiliate-programs"] });
      queryClient.invalidateQueries({ queryKey: ["affiliate-clicks-summary"] });
      queryClient.invalidateQueries({ queryKey: ["affiliate-content-stats"] });
    },
    onError: () => {
      toast.error("שגיאה בהרצת המנוע");
    },
  });

  // Calculate totals
  const totalClicks = clicks ? Object.values(clicks).reduce((s, c) => s + c.total, 0) : 0;
  const totalConversions = clicks ? Object.values(clicks).reduce((s, c) => s + c.converted, 0) : 0;
  const totalPending = earnings ? Object.values(earnings).reduce((s, e) => s + e.pending, 0) : 0;
  const totalApproved = earnings ? Object.values(earnings).reduce((s, e) => s + e.approved, 0) : 0;
  const totalPaid = earnings ? Object.values(earnings).reduce((s, e) => s + e.paid, 0) : 0;

  const configuredPrograms = programs?.filter(p => p.affiliate_id) || [];
  const pendingPrograms = programs?.filter(p => !p.affiliate_id) || [];

  const getSignupUrl = (notes: string | null): string | null => {
    if (!notes) return null;
    const match = notes.match(/Signup: (https?:\/\/[^\s|]+)/);
    return match ? match[1] : null;
  };

  const getTrackedLink = (program: AffiliateProgram): string => {
    return `https://flsdahpijdvkohwiinqm.supabase.co/functions/v1/affiliate-click-tracker?p=${program.id}`;
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">💰 מנוע שותפים אוטומטי</h1>
            <p className="text-muted-foreground">שיווק אוטומטי של מוצרי SaaS והכנסה פסיבית</p>
          </div>
          <Button 
            onClick={() => runEngineMutation.mutate()}
            disabled={runEngineMutation.isPending}
          >
            {runEngineMutation.isPending ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 ml-2" />
            )}
            {runEngineMutation.isPending ? "מריץ..." : "הפעל מנוע עכשיו"}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MousePointer className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{totalClicks}</p>
                  <p className="text-sm text-muted-foreground">קליקים (30 יום)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">${totalApproved.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">הכנסות מאושרות</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">${totalPending.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">ממתין לאישור</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{content?.published || 0}</p>
                  <p className="text-sm text-muted-foreground">תכנים שפורסמו</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Setup Progress */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              סטטוס הגדרה
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${programs?.length ? (configuredPrograms.length / programs.length) * 100 : 0}%` }}
                />
              </div>
              <span className="font-mono text-lg">
                {configuredPrograms.length}/{programs?.length || 0}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {configuredPrograms.length === 0 
                ? "🚨 הוסף את מזהי השותפים שלך כדי להתחיל להרוויח!"
                : configuredPrograms.length === programs?.length
                  ? "🎉 כל התוכניות מוגדרות! המערכת פועלת באוטומציה מלאה"
                  : `${pendingPrograms.length} תוכניות ממתינות להגדרה`
              }
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <AlertCircle className="h-4 w-4" />
              ממתין להגדרה ({pendingPrograms.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              פעיל ({configuredPrograms.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {programsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : pendingPrograms.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">כל התוכניות מוגדרות!</p>
                  <p className="text-muted-foreground">המערכת פועלת באוטומציה מלאה</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingPrograms.map((program) => {
                  const signupUrl = getSignupUrl(program.notes);
                  
                  return (
                    <Card key={program.id} className="border-yellow-500/30">
                      <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row md:items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-lg">{program.name}</h3>
                              <Badge variant="outline">{program.category}</Badge>
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                {program.commission_type === "percentage" 
                                  ? `${program.commission_value}%` 
                                  : `$${program.commission_value}`
                                }
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Cookie: {program.cookie_days} ימים
                            </p>
                          </div>

                          <div className="flex flex-col md:flex-row gap-2 md:items-center">
                            {signupUrl && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => window.open(signupUrl, "_blank")}
                                className="gap-2"
                              >
                                <ExternalLink className="h-4 w-4" />
                                הירשם לתוכנית
                              </Button>
                            )}

                            {editingId === program.id ? (
                              <div className="flex gap-2">
                                <Input
                                  placeholder="הזן את מזהה השותף שלך"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-48"
                                  dir="ltr"
                                />
                                <Button 
                                  size="sm" 
                                  onClick={() => updateAffiliateMutation.mutate({ 
                                    id: program.id, 
                                    affiliateId: editValue 
                                  })}
                                  disabled={updateAffiliateMutation.isPending}
                                >
                                  שמור
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => { setEditingId(null); setEditValue(""); }}
                                >
                                  ביטול
                                </Button>
                              </div>
                            ) : (
                              <Button 
                                size="sm"
                                onClick={() => { setEditingId(program.id); setEditValue(""); }}
                                className="gap-2"
                              >
                                <Settings className="h-4 w-4" />
                                הוסף מזהה שותף
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active">
            {configuredPrograms.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">אין תוכניות פעילות</p>
                  <p className="text-muted-foreground">הוסף את מזהי השותפים שלך בלשונית "ממתין להגדרה"</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>תוכנית</TableHead>
                      <TableHead>עמלה</TableHead>
                      <TableHead>מזהה שותף</TableHead>
                      <TableHead>קליקים</TableHead>
                      <TableHead>הכנסות</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configuredPrograms.map((program) => {
                      const trackedLink = getTrackedLink(program);
                      const programClicks = clicks?.[program.id] || { total: 0, converted: 0 };
                      const programEarnings = earnings?.[program.id] || { pending: 0, approved: 0, paid: 0 };
                      const totalEarnings = programEarnings.pending + programEarnings.approved + programEarnings.paid;
                      
                      return (
                        <TableRow key={program.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{program.name}</span>
                              <Badge variant="outline" className="text-xs">{program.category}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-500/20 text-green-400">
                              {program.commission_type === "percentage" 
                                ? `${program.commission_value}%` 
                                : `$${program.commission_value}`
                              }
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded" dir="ltr">
                              {program.affiliate_id}
                            </code>
                          </TableCell>
                          <TableCell>{programClicks.total}</TableCell>
                          <TableCell>
                            <span className={totalEarnings > 0 ? "text-green-500 font-medium" : ""}>
                              ${totalEarnings.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(trackedLink);
                                  toast.success("קישור הועתק!");
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { 
                                  setEditingId(program.id); 
                                  setEditValue(program.affiliate_id || ""); 
                                }}
                              >
                                ערוך
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>🔄 איך זה עובד?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="font-bold text-lg mb-2">1️⃣ הרשמה</div>
                <p className="text-sm text-muted-foreground">
                  הירשם לתוכניות השותפים דרך הקישורים למעלה וקבל את מזהה השותף שלך
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="font-bold text-lg mb-2">2️⃣ הגדרה</div>
                <p className="text-sm text-muted-foreground">
                  הזן את מזהי השותפים במערכת - פעם אחת בלבד
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="font-bold text-lg mb-2">3️⃣ אוטומציה</div>
                <p className="text-sm text-muted-foreground">
                  המערכת מייצרת ומפיצה תוכן אוטומטית עם הקישורים שלך
                </p>
              </div>
              <div className="p-4 rounded-lg bg-secondary/50">
                <div className="font-bold text-lg mb-2">4️⃣ הכנסה</div>
                <p className="text-sm text-muted-foreground">
                  קליקים הופכים להמרות והכנסות נזקפות לחשבונך
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
