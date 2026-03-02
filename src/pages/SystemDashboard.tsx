/**
 * System Dashboard
 * דשבורד מערכת - סטטוס אינטגרציות
 */

import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { ForensicHealthCard } from '@/components/ForensicHealthCard';
import { AutonomousActivityLog } from '@/components/AutonomousActivityLog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Webhook,
  Wallet,
  Cpu,
  Send,
  Loader2,
  RefreshCw,
  Key,
  Eye,
  EyeOff
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

type ZeroDevStatusType = 'not_configured' | 'pending' | 'active' | 'error';

interface ZeroDevStatusResponse {
  configured: boolean;
  status: ZeroDevStatusType;
  message: string;
  network: string;
  bundlerRpc: string | null;
}

interface SystemStatus {
  name: string;
  nameHe: string;
  status: 'ok' | 'warning' | 'error' | 'pending';
  message: string;
  lastCheck?: string;
  icon: React.ReactNode;
}

export default function SystemDashboard() {
  const queryClient = useQueryClient();
  const [adminToken, setAdminToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Fetch last webhook notification
  const { data: lastWebhook, isLoading: webhookLoading, refetch: refetchWebhook } = useQuery({
    queryKey: ['last-webhook'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('source', 'webhook')
        .eq('is_test', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch last test notification
  const { data: lastTest } = useQuery({
    queryKey: ['last-test-notification'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_test', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  // Fetch ZeroDev status from Edge Function
  const { data: zerodevConfig, isLoading: zerodevLoading } = useQuery({
    queryKey: ['zerodev-status'],
    queryFn: async (): Promise<ZeroDevStatusResponse> => {
      const { data, error } = await supabase.functions.invoke('zerodev-status');
      if (error) throw error;
      return data as ZeroDevStatusResponse;
    },
    staleTime: 60000, // Cache for 1 minute
  });

  // Send test telegram mutation - uses REAL admin token
  const sendTestMutation = useMutation({
    mutationFn: async () => {
      if (!adminToken || adminToken.trim() === '') {
        throw new Error('נא להזין Admin API Token');
      }

      const { data, error } = await supabase.functions.invoke('send-test-telegram', {
        headers: {
          'x-admin-token': adminToken.trim(),
        },
      });

      if (error) throw error;
      if (!data.success) {
        throw new Error(data.message || 'השליחה נכשלה');
      }
      return data;
    },
    onSuccess: (data) => {
      toast.success('הודעת בדיקה [TEST] נשלחה לטלגרם');
      queryClient.invalidateQueries({ queryKey: ['last-test-notification'] });
    },
    onError: (error: Error) => {
      console.error('Test telegram error:', error);
      toast.error(error.message || 'שגיאה בשליחת הודעת בדיקה');
    },
  });

  // Build system statuses
  const getWebhookStatus = (): SystemStatus => {
    if (webhookLoading) {
      return {
        name: 'Coinbase Webhook',
        nameHe: 'ווב-הוק קוינבייס',
        status: 'pending',
        message: 'טוען...',
        icon: <Loader2 className="w-5 h-5 animate-spin" />,
      };
    }

    if (!lastWebhook) {
      return {
        name: 'Coinbase Webhook',
        nameHe: 'ווב-הוק קוינבייס',
        status: 'warning',
        message: 'לא התקבלו אירועים עדיין',
        icon: <Webhook className="w-5 h-5" />,
      };
    }

    const isError = lastWebhook.event_type === 'error' || lastWebhook.event_type === 'security_alert';
    
    return {
      name: 'Coinbase Webhook',
      nameHe: 'ווב-הוק קוינבייס',
      status: isError ? 'error' : 'ok',
      message: isError 
        ? `שגיאה אחרונה: ${lastWebhook.message}`
        : `אירוע אחרון: ${lastWebhook.event_type}`,
      lastCheck: lastWebhook.created_at,
      icon: <Webhook className="w-5 h-5" />,
    };
  };

  const getZeroDevStatusDisplay = (): SystemStatus => {
    if (zerodevLoading || !zerodevConfig) {
      return {
        name: 'ZeroDev Kernel',
        nameHe: 'קרנל זירו-דב (Account Abstraction)',
        status: 'pending',
        message: 'בודק סטטוס...',
        icon: <Cpu className="w-5 h-5" />,
      };
    }

    const statusMap: Record<ZeroDevStatusType, 'ok' | 'warning' | 'error' | 'pending'> = {
      'active': 'ok',
      'pending': 'warning',
      'not_configured': 'pending',
      'error': 'error',
    };

    return {
      name: 'ZeroDev Kernel',
      nameHe: 'קרנל זירו-דב (Account Abstraction)',
      status: statusMap[zerodevConfig.status],
      message: zerodevConfig.message,
      icon: <Cpu className="w-5 h-5" />,
    };
  };

  const statuses: SystemStatus[] = [
    getWebhookStatus(),
    {
      name: 'WalletConnect',
      nameHe: 'חיבור ארנק',
      status: 'pending',
      message: 'לא נדרש כרגע - מצב Watch-Only',
      icon: <Wallet className="w-5 h-5" />,
    },
    getZeroDevStatusDisplay(),
    {
      name: 'Telegram Alerts',
      nameHe: 'התראות טלגרם',
      status: 'ok',
      message: 'מוכן - שולח רק על אירועים אמיתיים',
      icon: <Send className="w-5 h-5" />,
    },
  ];

  const getStatusBadge = (status: 'ok' | 'warning' | 'error' | 'pending') => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-success text-success-foreground">פעיל</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-warning/20 text-warning">אזהרה</Badge>;
      case 'error':
        return <Badge variant="destructive">שגיאה</Badge>;
      case 'pending':
        return <Badge variant="outline">ממתין</Badge>;
    }
  };

  const getStatusIcon = (status: 'ok' | 'warning' | 'error' | 'pending') => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-destructive" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">סטטוס מערכת</h1>
            <p className="text-muted-foreground mt-1">
              מעקב אחר אינטגרציות ושירותים
            </p>
          </div>
          <Button 
            variant="outline"
            onClick={() => {
              refetchWebhook();
              toast.success('מרענן סטטוסים...');
            }}
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            רענן
          </Button>
        </div>

        {/* Forensic Health Card */}
        <div className="mb-6">
          <ForensicHealthCard />
        </div>

        {/* Autonomous Activity Log */}
        <div className="mb-8">
          <AutonomousActivityLog />
        </div>

        {/* Status Cards */}
        <div className="grid gap-4 mb-8">
          {statuses.map((item, index) => (
            <Card key={index} className="glass-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      item.status === 'ok' ? 'bg-success/20' :
                      item.status === 'warning' ? 'bg-warning/20' :
                      item.status === 'error' ? 'bg-destructive/20' :
                      'bg-muted'
                    }`}>
                      {item.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{item.nameHe}</h3>
                        <span className="text-xs text-muted-foreground">({item.name})</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.message}</p>
                      {item.lastCheck && (
                        <p className="text-xs text-muted-foreground mt-1">
                          עדכון אחרון: {format(new Date(item.lastCheck), 'dd/MM/yyyy HH:mm', { locale: he })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusIcon(item.status)}
                    {getStatusBadge(item.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Test Telegram Section - Requires REAL Admin Token */}
        <Card className="glass-card border-info/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              בדיקת התראות טלגרם
            </CardTitle>
            <CardDescription>
              שלח הודעת בדיקה מסומנת כ-[TEST] - לא נכנסת לדוחות הכנסות
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Admin Token Input */}
            <div className="space-y-2">
              <Label htmlFor="admin-token" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                Admin API Token
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="admin-token"
                    type={showToken ? 'text' : 'password'}
                    placeholder="הזן את ה-ADMIN_API_TOKEN שלך"
                    value={adminToken}
                    onChange={(e) => setAdminToken(e.target.value)}
                    className="pr-10"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                הטוקן מוגדר בסודות המערכת כ-ADMIN_API_TOKEN
              </p>
            </div>

            <Button
              onClick={() => sendTestMutation.mutate()}
              disabled={sendTestMutation.isPending || !adminToken}
            >
              {sendTestMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שולח...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 ml-2" />
                  שלח הודעת בדיקה [TEST]
                </>
              )}
            </Button>

            {/* Last test result */}
            {lastTest && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg text-sm">
                <p className="font-medium">בדיקה אחרונה:</p>
                <p className="text-muted-foreground">
                  {format(new Date(lastTest.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: he })}
                  {' - '}
                  {lastTest.was_sent ? (
                    <span className="text-success">נשלח בהצלחה ✓</span>
                  ) : (
                    <span className="text-destructive">נכשל ✗</span>
                  )}
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              ⚠️ הודעה זו מסומנת כ-[TEST] ולא נספרת כהכנסה אמיתית
            </p>
          </CardContent>
        </Card>

        {/* ZeroDev Setup Info */}
        {zerodevConfig?.status === 'not_configured' && (
          <Card className="glass-card border-warning/30 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-warning" />
                ZeroDev - ממתין להגדרה
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                להפעלת Account Abstraction על Base, יש להגדיר:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>צור חשבון ב-<code className="bg-muted px-1 rounded">zerodev.app</code></li>
                <li>צור פרויקט חדש על רשת Base</li>
                <li>העתק את ה-Project ID</li>
                <li>הגדר את הסוד <code className="bg-muted px-1 rounded">ZERODEV_PROJECT_ID</code></li>
              </ol>
              <p className="text-xs text-muted-foreground mt-4">
                עד להגדרה, אין ביצוע אוטומטי של Quest-ים
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
