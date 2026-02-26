import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BarChart2, ExternalLink, Database, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const RMINT_SUPABASE_URL = 'https://flsdahpijdvkohwiinqm.supabase.co';

export default function Rmint() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${RMINT_SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { apikey: 'public' },
    })
      .then((res) => setStatus(res.status === 401 || res.ok ? 'connected' : 'error'))
      .catch(() => setStatus('error'));
    return () => controller.abort();
  }, []);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center">
            <BarChart2 className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">RMINT – מערכת ניהול קרן</h1>
            <p className="text-muted-foreground text-sm">TCG Fund Operating System • Command Center</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Launch Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Command Center</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                גש למערכת הניהול המרכזית של RMINT — צ'אט עם Agent 7.4, ניהול מלאי, הערכות, ופורטפוליו.
              </p>
              <Button asChild className="w-full">
                <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 ml-2" />
                  פתח Command Center
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Database className="w-5 h-5" />
                סטטוס Supabase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">RMINT Supabase</span>
                {status === 'checking' && (
                  <Badge variant="outline" className="gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    בודק...
                  </Badge>
                )}
                {status === 'connected' && (
                  <Badge className="gap-1.5 bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/30">
                    <CheckCircle className="w-3 h-3" />
                    מחובר
                  </Badge>
                )}
                {status === 'error' && (
                  <Badge variant="destructive" className="gap-1.5">
                    <XCircle className="w-3 h-3" />
                    לא מחובר
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground break-all font-mono">{RMINT_SUPABASE_URL}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
