/**
 * System Audit Dashboard
 * Full infrastructure, financial, and readiness report
 */

import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ShieldCheck, Database, Key, Zap, DollarSign, Brain,
  AlertTriangle, CheckCircle, XCircle, RefreshCw, ExternalLink,
  Server, Lock, TrendingUp, Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface AuditData {
  success: boolean;
  timestamp: string;
  readiness_score: number;
  infrastructure: {
    tables: Record<string, { connected: boolean; count: number }>;
    secrets: Record<string, boolean>;
  };
  partners: Array<{
    id: string;
    name: string;
    affiliate_base_url: string;
    commission_rate: number;
    category_tags: string[];
    is_active: boolean;
  }>;
  activity: {
    clicks_30d: number;
    outreach_7d: number;
    confirmed_payments: number;
  };
  missing_components: string[];
}

const PARTNER_LOGIC: Record<string, string> = {
  'AdTurbo AI': 'Marketing & Advertising signals → Facebook Ads, Google Ads, PPC, ROAS optimization',
  'Lucro CRM': 'CRM & Sales signals → Pipeline management, lead tracking, deal closing',
  'EasyFund': 'Fundraising & Nonprofit signals → Donations, crowdfunding, NGO operations',
  'EmailListVerify': 'Email Validation signals → Bounce rate, list cleaning, deliverability',
  'Compass': 'eCommerce Analytics signals → Scaling, B2B growth, revenue optimization',
  'Woodpecker': 'Cold Email signals → Outreach sequences, deliverability, follow-ups',
};

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle className="w-4 h-4 text-success" />
    : <XCircle className="w-4 h-4 text-destructive" />;
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'text-success' : score >= 50 ? 'text-warning' : 'text-destructive';
  const bg = score >= 80 ? 'bg-success/20' : score >= 50 ? 'bg-warning/20' : 'bg-destructive/20';
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${bg}`}>
      <span className={`text-3xl font-bold ${color}`}>{score}</span>
      <span className="text-sm text-muted-foreground">/100</span>
    </div>
  );
}

export default function SystemAudit() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('system-audit', {
        headers: { 'x-admin-token': session?.access_token || '' },
      });
      if (res.error) throw new Error(res.error.message);
      setData(res.data as AuditData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-primary" />
              System Audit
            </h1>
            <p className="text-muted-foreground mt-1">
              Full infrastructure & readiness scan
            </p>
          </div>
          <Button onClick={runAudit} disabled={loading} size="lg" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Scanning...' : 'Run Audit'}
          </Button>
        </div>

        {error && (
          <Card className="glass-card border-destructive/50">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {!data && !loading && (
          <Card className="glass-card">
            <CardContent className="py-16 text-center">
              <Server className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg text-muted-foreground">Press "Run Audit" to scan system</p>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="glass-card">
                <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {data && (
          <>
            {/* Readiness Score */}
            <Card className="glass-card glow-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Readiness Score</h2>
                    <p className="text-sm text-muted-foreground">
                      Last scan: {new Date(data.timestamp).toLocaleString('he-IL')}
                    </p>
                  </div>
                  <ScoreBadge score={data.readiness_score} />
                </div>
                <Progress value={data.readiness_score} className="mt-4 h-3" />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. Infrastructure */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Database className="w-5 h-5 text-primary" />
                    Infrastructure
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(data.infrastructure.tables).map(([name, info]) => (
                    <div key={name} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2">
                        <StatusIcon ok={info.connected} />
                        <span className="text-sm font-mono">{name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {info.count} rows
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 2. Security / Secrets */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Lock className="w-5 h-5 text-primary" />
                    Security & Secrets
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(data.infrastructure.secrets).map(([name, set]) => (
                    <div key={name} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2">
                        <StatusIcon ok={set} />
                        <span className="text-sm font-mono">{name}</span>
                      </div>
                      <Badge variant={set ? 'default' : 'destructive'} className="text-xs">
                        {set ? '••••••' : 'MISSING'}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* 3. Partners Registry */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5 text-primary" />
                    Active Partners ({data.partners.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.partners.map((p) => {
                    const commPct = p.commission_rate <= 1
                      ? (p.commission_rate * 100).toFixed(0)
                      : p.commission_rate.toFixed(0);
                    return (
                      <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-success shrink-0" />
                            <span className="font-medium truncate">{p.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate pl-6">
                            {p.affiliate_base_url.replace(/\?.*/, '...')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary">{commPct}%</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => window.open(p.affiliate_base_url, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {data.partners.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No active partners</p>
                  )}
                </CardContent>
              </Card>

              {/* 4. Activity Stats */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    Activity Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Clicks (30d)', value: data.activity.clicks_30d, icon: Zap },
                      { label: 'Outreach (7d)', value: data.activity.outreach_7d, icon: Brain },
                      { label: 'Payments', value: data.activity.confirmed_payments, icon: DollarSign },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center p-3 rounded-lg bg-card/50 border border-border/30">
                        <stat.icon className="w-5 h-5 mx-auto text-primary mb-1" />
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 5. AI Recommendation Logic */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="w-5 h-5 text-primary" />
                  AI Recommendation Logic
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.partners.map((p) => (
                    <div key={p.id} className="p-3 rounded-lg bg-card/50 border border-border/30">
                      <p className="font-medium text-sm mb-1">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {PARTNER_LOGIC[p.name] || `Matched via keyword triggers: ${(p.category_tags || []).join(', ')}`}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 6. Missing Components */}
            {data.missing_components.length > 0 && (
              <Card className="glass-card border-warning/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    Missing Components ({data.missing_components.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {data.missing_components.map((item) => (
                      <div key={item} className="flex items-center gap-2 p-2 rounded bg-warning/10 border border-warning/20">
                        <Key className="w-4 h-4 text-warning shrink-0" />
                        <span className="text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
