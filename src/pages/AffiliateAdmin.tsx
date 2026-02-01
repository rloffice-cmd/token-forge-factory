/**
 * Affiliate Admin Dashboard
 * Monitor affiliate performance and earnings
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { DollarSign, MousePointer, TrendingUp, Percent, RefreshCw, ExternalLink, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

export default function AffiliateAdmin() {
  const { data: programs, isLoading: programsLoading, refetch: refetchPrograms } = useQuery({
    queryKey: ["affiliate-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("affiliate_programs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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
        .select("status")
        .eq("status", "published");
      if (error) throw error;
      return data.length;
    },
  });

  const runEngine = async () => {
    toast.info("מריץ את מנוע השותפים...");
    try {
      const { error } = await supabase.functions.invoke("affiliate-automation-engine", {
        body: { action: "full_cycle" },
      });
      if (error) throw error;
      toast.success("מחזור הושלם בהצלחה!");
      refetchPrograms();
    } catch (e) {
      console.error(e);
      toast.error("שגיאה בהרצת המנוע");
    }
  };

  // Calculate totals
  const totalClicks = clicks ? Object.values(clicks).reduce((s, c) => s + c.total, 0) : 0;
  const totalConversions = clicks ? Object.values(clicks).reduce((s, c) => s + c.converted, 0) : 0;
  const totalPending = earnings ? Object.values(earnings).reduce((s, e) => s + e.pending, 0) : 0;
  const totalPaid = earnings ? Object.values(earnings).reduce((s, e) => s + e.paid, 0) : 0;

  return (
    <AppLayout>
      <div className="p-6 space-y-6" dir="rtl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">💰 Affiliate Dashboard</h1>
            <p className="text-muted-foreground">ניהול וניטור תוכניות שותפים</p>
          </div>
          <Button onClick={runEngine}>
            <RefreshCw className="h-4 w-4 ml-2" />
            הרץ מחזור
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">קליקים (30 יום)</CardTitle>
              <MousePointer className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClicks}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">המרות</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalConversions}</div>
              <p className="text-xs text-muted-foreground">
                {totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : 0}% יחס המרה
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">ממתין לאישור</CardTitle>
              <DollarSign className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">${totalPending.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">שולם</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">${totalPaid.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Content Stats */}
        <Card>
          <CardHeader>
            <CardTitle>תוכן שפורסם</CardTitle>
            <CardDescription>{content || 0} פוסטים עם לינקים שותפים</CardDescription>
          </CardHeader>
        </Card>

        {/* Programs Table */}
        <Card>
          <CardHeader>
            <CardTitle>תוכניות שותפים פעילות</CardTitle>
            <CardDescription>כל התוכניות שמנוע השותפים מקדם</CardDescription>
          </CardHeader>
          <CardContent>
            {programsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>תוכנית</TableHead>
                    <TableHead>קטגוריה</TableHead>
                    <TableHead>עמלה</TableHead>
                    <TableHead>קליקים</TableHead>
                    <TableHead>המרות</TableHead>
                    <TableHead>הכנסות</TableHead>
                    <TableHead>פעולות</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programs?.map((program) => {
                    const programClicks = clicks?.[program.id] || { total: 0, converted: 0 };
                    const programEarnings = earnings?.[program.id] || { pending: 0, approved: 0, paid: 0 };
                    const totalEarnings = programEarnings.pending + programEarnings.approved + programEarnings.paid;
                    
                    return (
                      <TableRow key={program.id}>
                        <TableCell className="font-medium">{program.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{program.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {program.commission_type === "percentage" ? (
                            <span>{program.commission_value}%</span>
                          ) : (
                            <span>${program.commission_value}</span>
                          )}
                        </TableCell>
                        <TableCell>{programClicks.total}</TableCell>
                        <TableCell>
                          {programClicks.converted}
                          {programClicks.total > 0 && (
                            <span className="text-xs text-muted-foreground mr-1">
                              ({((programClicks.converted / programClicks.total) * 100).toFixed(0)}%)
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={totalEarnings > 0 ? "text-green-600 font-medium" : ""}>
                            ${totalEarnings.toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={program.base_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
