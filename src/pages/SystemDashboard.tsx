/**
 * System Dashboard
 * דשבורד מערכת - סטטוס אינטגרציות
 */

import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  RefreshCw
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getZeroDevConfig, type ZeroDevStatus } from '@/lib/zerodev';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

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

  // Get ZeroDev config
  const zerodevConfig = getZeroDevConfig();

  // Send test telegram mutation
  const sendTestMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-test-telegram', {
        headers: {
          'x-admin-token': 'demo-token', // In production, use real admin token
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('הודעת בדיקה נשלחה לטלגרם');
      } else {
        toast.error('שליחה נכשלה');
      }
      queryClient.invalidateQueries({ queryKey: ['last-webhook'] });
    },
    onError: (error) => {
      console.error('Test telegram error:', error);
      toast.error('שגיאה בשליחת הודעת בדיקה');
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
    const statusMap: Record<ZeroDevStatus, 'ok' | 'warning' | 'error' | 'pending'> = {
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

        {/* Test Telegram Section */}
        <Card className="glass-card border-info/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              בדיקת התראות טלגרם
            </CardTitle>
            <CardDescription>
              שלח הודעת בדיקה - תסומן כ-[TEST] ולא תיכנס לדוחות
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => sendTestMutation.mutate()}
              disabled={sendTestMutation.isPending}
            >
              {sendTestMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  שולח...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 ml-2" />
                  שלח הודעת בדיקה
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ הודעה זו מסומנת כ-TEST ולא נספרת כהכנסה אמיתית
            </p>
          </CardContent>
        </Card>

        {/* ZeroDev Setup Info */}
        {zerodevConfig.status === 'not_configured' && (
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
