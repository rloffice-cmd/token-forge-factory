import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Globe, CheckCircle, XCircle, Copy, RefreshCw, Zap,
  AlertTriangle, ArrowRight, Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DnsRecord {
  record: string;
  name: string;
  type: string;
  ttl: string;
  status: string;
  value: string;
  priority?: number;
}

interface DomainState {
  domain_name: string;
  domain_id: string;
  status: string;
  records: DnsRecord[];
  region?: string;
  created_at?: string;
}

interface TestResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

const RECORD_INSTRUCTIONS: Record<string, string> = {
  MX: 'Add an MX record at your DNS provider. This routes email correctly.',
  TXT: 'Add a TXT record. This is used for SPF, DKIM, or domain verification.',
  CNAME: 'Add a CNAME record. This is required for DKIM signing.',
};

function StatusDot({ status }: { status: string }) {
  const isVerified = status === 'verified' || status === 'active';
  return (
    <Badge variant={isVerified ? 'default' : 'secondary'} className="text-xs gap-1">
      {isVerified ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {status}
    </Badge>
  );
}

export default function DomainManager() {
  const [domain, setDomain] = useState<DomainState | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callDomainFn = async (action: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    return supabase.functions.invoke('setup-resend-domain', {
      headers: { 'x-admin-token': session?.access_token || '' },
      body: { action },
    });
  };

  const registerAndFetch = async () => {
    setLoading(true);
    setError(null);
    try {
      // Register if needed
      const regRes = await callDomainFn('register');
      if (regRes.error) throw new Error(regRes.error.message);

      // Get records
      const recRes = await callDomainFn('get-records');
      if (recRes.error) throw new Error(recRes.error.message);
      setDomain(recRes.data as DomainState);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch domain');
    } finally {
      setLoading(false);
    }
  };

  const verifyDomain = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await callDomainFn('verify');
      if (res.error) throw new Error(res.error.message);

      const result = res.data as { status: string; records: DnsRecord[] };
      setDomain(prev => prev ? { ...prev, status: result.status, records: result.records } : prev);

      if (result.status === 'verified' || result.status === 'active') {
        toast({ title: '✅ Domain Verified!', description: 'Triggering test email...' });
        triggerTestEmail();
      } else {
        toast({
          title: '⏳ Not yet verified',
          description: `Status: ${result.status}. DNS may need more propagation time.`,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const triggerTestEmail = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await supabase.functions.invoke('automated-outreach', {
        body: {
          lead_email: 'test@truthtoken.io',
          lead_name: 'Domain Verify Test',
          lead_id: 'domain-verify-' + Date.now(),
          partner_name: 'AdTurbo AI',
          intent_topic: 'Domain verification success — automated test',
          affiliate_url: 'https://truthtoken.io/go/adturbo/test',
          batch_mode: false,
        },
      });
      if (res.error) {
        setTestResult({ success: false, error: res.error.message });
      } else {
        setTestResult({ success: true, data: res.data });
      }
    } catch (e) {
      setTestResult({ success: false, error: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setTestLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: text.slice(0, 60) + '...' });
  };

  const isActive = domain?.status === 'verified' || domain?.status === 'active';

  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Globe className="w-8 h-8 text-primary" />
              Domain Manager
            </h1>
            <p className="text-muted-foreground mt-1">
              Resend domain verification for <span className="font-mono font-semibold">truthtoken.io</span>
            </p>
          </div>
          <Button onClick={registerAndFetch} disabled={loading} size="lg" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : domain ? 'Refresh' : 'Setup Domain'}
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {!domain && !loading && (
          <Card>
            <CardContent className="py-16 text-center">
              <Shield className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg text-muted-foreground">Click "Setup Domain" to register and fetch DNS records</p>
            </CardContent>
          </Card>
        )}

        {loading && (
          <Card>
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        )}

        {domain && (
          <>
            {/* Domain Status */}
            <Card className={isActive ? 'border-green-500/30' : 'border-yellow-500/30'}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                      {domain.domain_name}
                      <StatusDot status={domain.status} />
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      ID: <span className="font-mono">{domain.domain_id}</span>
                      {domain.region && <> · Region: {domain.region}</>}
                    </p>
                  </div>
                  <Button
                    onClick={verifyDomain}
                    disabled={verifying || isActive}
                    variant={isActive ? 'secondary' : 'default'}
                    className="gap-2"
                  >
                    {verifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : isActive ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    {verifying ? 'Checking...' : isActive ? 'Verified ✓' : 'Verify Now'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* DNS Records */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  DNS Records — Copy-Paste Ready
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {domain.records.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No records returned. Domain may already be fully verified.
                  </p>
                )}
                {domain.records.map((rec, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg border border-border/50 bg-card/50 space-y-3"
                  >
                    {/* Instruction */}
                    <div className="flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        Go to your DNS provider and add a <strong>{rec.type}</strong> record with this Name and Value.
                        {RECORD_INSTRUCTIONS[rec.type] && (
                          <span className="block text-xs mt-0.5 opacity-70">
                            {RECORD_INSTRUCTIONS[rec.type]}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Record details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Type</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{rec.type}</Badge>
                          <StatusDot status={rec.status} />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Name</p>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                            {rec.name}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => copyToClipboard(rec.name)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Value</p>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all max-w-[300px]">
                            {rec.value}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={() => copyToClipboard(rec.value)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {rec.priority !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        Priority: <strong>{rec.priority}</strong> · TTL: {rec.ttl}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Test Email Result (auto-triggered on ACTIVE) */}
            {(testResult || testLoading) && (
              <Card className={testResult?.success ? 'border-green-500/30' : 'border-destructive/30'}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Auto-Test Email Result
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {testLoading && <Skeleton className="h-16 w-full" />}
                  {testResult?.success && (
                    <div className="space-y-2">
                      <p className="text-sm text-green-500 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> Test email dispatched successfully
                      </p>
                      <pre className="text-xs font-mono bg-muted p-3 rounded max-h-48 overflow-auto">
                        {JSON.stringify(testResult.data, null, 2)}
                      </pre>
                    </div>
                  )}
                  {testResult && !testResult.success && (
                    <div className="space-y-2">
                      <p className="text-sm text-destructive flex items-center gap-2">
                        <XCircle className="w-4 h-4" /> Test email failed
                      </p>
                      <pre className="text-xs font-mono text-destructive/80 bg-destructive/5 p-3 rounded">
                        {testResult.error}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
