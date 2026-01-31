/**
 * Payment Success Page
 * דף הצלחת תשלום
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, Loader2, Home, Receipt } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

type PaymentStatus = 'checking' | 'confirmed' | 'pending' | 'failed' | 'not_found';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>('checking');
  
  // Get charge_id from URL or session storage
  const chargeId = searchParams.get('charge_id') || sessionStorage.getItem('pending_charge_id');
  const email = sessionStorage.getItem('pending_email');

  // Poll for payment status
  const { data: payment, isLoading, refetch } = useQuery({
    queryKey: ['payment-status', chargeId],
    queryFn: async () => {
      if (!chargeId) return null;

      const { data, error } = await supabase
        .from('payments')
        .select('id, status, amount_usd, credits_purchased, confirmed_at')
        .eq('charge_id', chargeId)
        .single();

      if (error) {
        console.error('Payment lookup error:', error);
        return null;
      }

      return data;
    },
    enabled: !!chargeId,
    refetchInterval: (query) => {
      // Keep polling while pending
      const data = query.state.data;
      if (!data || data.status === 'pending' || data.status === 'created') {
        return 5000; // Poll every 5 seconds
      }
      return false; // Stop polling
    },
  });

  // Update status based on payment data
  useEffect(() => {
    if (isLoading) {
      setStatus('checking');
    } else if (!payment) {
      setStatus('not_found');
    } else if (payment.status === 'confirmed') {
      setStatus('confirmed');
      // Clear session storage
      sessionStorage.removeItem('pending_charge_id');
      sessionStorage.removeItem('pending_email');
    } else if (payment.status === 'failed') {
      setStatus('failed');
    } else {
      setStatus('pending');
    }
  }, [payment, isLoading]);

  const getStatusDisplay = () => {
    switch (status) {
      case 'checking':
        return {
          icon: <Loader2 className="w-16 h-16 text-primary animate-spin" />,
          title: 'בודק סטטוס תשלום...',
          description: 'ממתין לאישור מהרשת',
          badge: <Badge variant="secondary">בבדיקה</Badge>,
        };
      case 'confirmed':
        return {
          icon: <CheckCircle className="w-16 h-16 text-success" />,
          title: 'התשלום אושר!',
          description: `${payment?.credits_purchased} קרדיטים נוספו לחשבונך`,
          badge: <Badge variant="default" className="bg-success">מאושר</Badge>,
        };
      case 'pending':
        return {
          icon: <Clock className="w-16 h-16 text-warning" />,
          title: 'ממתין לאישור',
          description: 'העסקה בתהליך אישור ברשת. זה יכול לקחת כמה דקות.',
          badge: <Badge variant="secondary" className="bg-warning/20 text-warning">ממתין</Badge>,
        };
      case 'failed':
        return {
          icon: <XCircle className="w-16 h-16 text-destructive" />,
          title: 'התשלום נכשל',
          description: 'משהו השתבש. נסה שוב או פנה לתמיכה.',
          badge: <Badge variant="destructive">נכשל</Badge>,
        };
      case 'not_found':
        return {
          icon: <XCircle className="w-16 h-16 text-muted-foreground" />,
          title: 'לא נמצא תשלום',
          description: 'לא הצלחנו לאתר את התשלום. ייתכן שהוא עדיין בעיבוד.',
          badge: <Badge variant="outline">לא נמצא</Badge>,
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <AppLayout>
      <div className="p-8 max-w-2xl mx-auto">
        <Card className="glass-card">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              {statusDisplay.icon}
            </div>
            <CardTitle className="text-2xl">{statusDisplay.title}</CardTitle>
            <div className="flex justify-center mt-2">
              {statusDisplay.badge}
            </div>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <p className="text-muted-foreground">{statusDisplay.description}</p>

            {status === 'confirmed' && payment && (
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סכום:</span>
                  <span className="font-bold">${payment.amount_usd} USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">קרדיטים:</span>
                  <span className="font-bold text-primary">+{payment.credits_purchased}</span>
                </div>
                {chargeId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">מזהה עסקה:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {chargeId.substring(0, 16)}...
                    </code>
                  </div>
                )}
              </div>
            )}

            {status === 'pending' && (
              <div className="text-sm text-muted-foreground">
                <p>העמוד מתעדכן אוטומטית...</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => refetch()}
                >
                  <Loader2 className="w-4 h-4 ml-2" />
                  בדוק שוב
                </Button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button onClick={() => navigate('/')}>
                <Home className="w-4 h-4 ml-2" />
                לדשבורד
              </Button>
              <Button variant="outline" onClick={() => navigate('/treasury')}>
                <Receipt className="w-4 h-4 ml-2" />
                לקופה
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
