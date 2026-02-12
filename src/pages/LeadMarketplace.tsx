/**
 * Performance Board V4.2 — Profit-Driven Brokerage Dashboard
 * Replaces Lead Marketplace with real-time partner performance metrics.
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, TrendingUp, Zap, BarChart3, Activity, ArrowUpRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const ACCESS_CODE = "BROKER2026";

interface PartnerPerf {
  id: string;
  name: string;
  commission_value_usd: number;
  avg_conv_rate: number;
  total_dispatches: number;
  total_conversions: number;
  is_active: boolean;
  niche_winner: boolean;
  testing_phase: boolean;
  testing_leads_sent: number;
}

interface ClickEvent {
  id: string;
  partner_slug: string;
  source_platform: string;
  created_at: string;
}

export default function PerformanceBoard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [code, setCode] = useState("");
  const [partners, setPartners] = useState<PartnerPerf[]>([]);
  const [clicks, setClicks] = useState<ClickEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAuth = () => {
    if (code === ACCESS_CODE) {
      setAuthenticated(true);
      localStorage.setItem("broker_access", "true");
    } else {
      toast({ title: "Invalid Code", description: "Access denied.", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (localStorage.getItem("broker_access") === "true") setAuthenticated(true);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchData();
  }, [authenticated]);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("m2m_partners").select("id, name, commission_value_usd, avg_conv_rate, total_dispatches, total_conversions, is_active, niche_winner, testing_phase, testing_leads_sent").order("commission_value_usd", { ascending: false }),
      supabase.from("click_analytics").select("id, partner_slug, source_platform, created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    setPartners((p as PartnerPerf[]) || []);
    setClicks((c as ClickEvent[]) || []);
    setLoading(false);
  };

  const totalDispatches = partners.reduce((s, p) => s + (p.total_dispatches || 0), 0);
  const totalClicks = clicks.length;
  const estMonthlyRev = partners.reduce((s, p) => {
    const ctr = p.total_dispatches > 0 ? p.total_conversions / p.total_dispatches : p.avg_conv_rate || 0;
    return s + (p.total_dispatches * ctr * p.commission_value_usd);
  }, 0);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary/20">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 mx-auto text-primary mb-4" />
            <CardTitle className="text-2xl">Performance Board</CardTitle>
            <CardDescription>Enter broker access code to view partner performance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input type="password" placeholder="Access Code" value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} />
            <Button className="w-full" onClick={handleAuth}>Unlock Board</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-primary" />
            <h1 className="text-xl font-bold">Performance Board</h1>
            <Badge variant="secondary">V4.2</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { localStorage.removeItem("broker_access"); setAuthenticated(false); }}>Logout</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2"><Zap className="w-4 h-4" /> Total Dispatches</CardDescription>
              <CardTitle className="text-3xl">{totalDispatches}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2"><Activity className="w-4 h-4" /> Tracked Clicks</CardDescription>
              <CardTitle className="text-3xl">{totalClicks}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-yellow-500" /> Est. Monthly Revenue</CardDescription>
              <CardTitle className="text-3xl text-yellow-500">${estMonthlyRev.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Partner Performance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Partner Performance (EV Routing)</CardTitle>
            <CardDescription>Greedy routing optimizes for highest Expected Value per lead.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-3 px-2">Partner</th>
                      <th className="text-right py-3 px-2">Commission</th>
                      <th className="text-right py-3 px-2">Dispatches</th>
                      <th className="text-right py-3 px-2">Conversions</th>
                      <th className="text-right py-3 px-2">CTR</th>
                      <th className="text-right py-3 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map(p => {
                      const ctr = p.total_dispatches > 0 ? ((p.total_conversions / p.total_dispatches) * 100).toFixed(1) : "—";
                      return (
                        <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3 px-2 font-medium flex items-center gap-2">
                            {p.name}
                            {p.niche_winner && <Badge className="bg-yellow-500 text-yellow-950 text-xs">Winner</Badge>}
                          </td>
                          <td className="text-right py-3 px-2 font-mono">${p.commission_value_usd}</td>
                          <td className="text-right py-3 px-2 font-mono">{p.total_dispatches}</td>
                          <td className="text-right py-3 px-2 font-mono">{p.total_conversions}</td>
                          <td className="text-right py-3 px-2 font-mono">{ctr}%</td>
                          <td className="text-right py-3 px-2">
                            {p.is_active ? (
                              <Badge variant="default" className="text-xs">Active</Badge>
                            ) : p.testing_phase ? (
                              <Badge variant="secondary" className="text-xs">Testing ({p.testing_leads_sent}/20)</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Inactive</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Click Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ArrowUpRight className="w-5 h-5 text-green-500" /> Live Click Feed</CardTitle>
            <CardDescription>Real-time affiliate redirect activity.</CardDescription>
          </CardHeader>
          <CardContent>
            {clicks.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">No clicks recorded yet. Dispatches are flowing — clicks will appear as users interact.</div>
            ) : (
              <div className="space-y-2">
                {clicks.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded bg-muted/30 text-sm">
                    <div className="flex items-center gap-3">
                      <Activity className="w-4 h-4 text-green-500" />
                      <span className="font-mono">{c.partner_slug}</span>
                      {c.source_platform && <Badge variant="outline" className="text-xs">{c.source_platform}</Badge>}
                    </div>
                    <span className="text-muted-foreground text-xs">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
