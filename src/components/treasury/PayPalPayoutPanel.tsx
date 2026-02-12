/**
 * PayPal Payout Panel
 * Manual payout trigger from Treasury page
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function PayPalPayoutPanel() {
  const [email, setEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; correlation_id?: string; error?: string } | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit = isValidEmail && numAmount > 0 && !isProcessing;

  const handlePayout = async () => {
    if (!canSubmit) return;
    setIsProcessing(true);
    setLastResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('paypal-payout', {
        body: { email, amount_usd: numAmount, note: note || undefined },
      });

      if (error) throw error;

      setLastResult(data);
      if (data.success) {
        toast.success(`שולם $${numAmount.toFixed(2)} ל-${email}`);
        setEmail('');
        setAmount('');
        setNote('');
      } else {
        toast.error(data.error || 'שגיאה בתשלום PayPal');
      }
    } catch (err) {
      console.error('PayPal payout failed:', err);
      toast.error('שגיאה בביצוע תשלום PayPal');
      setLastResult({ success: false, error: String(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          תשלום PayPal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="pp-email">כתובת אימייל PayPal</Label>
          <Input
            id="pp-email"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pp-amount">סכום (USD)</Label>
          <Input
            id="pp-amount"
            type="number"
            placeholder="0.00"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="pp-note">הערה (אופציונלי)</Label>
          <Input
            id="pp-note"
            placeholder="Lead-Forge Payout"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <Button
          onClick={handlePayout}
          disabled={!canSubmit}
          size="lg"
          className="w-full gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              מעבד תשלום...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              שלח תשלום PayPal – ${numAmount.toFixed(2)}
            </>
          )}
        </Button>

        {lastResult?.success && (
          <Alert>
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <AlertDescription>
              תשלום נשלח בהצלחה! Correlation ID: <code className="text-xs">{lastResult.correlation_id}</code>
            </AlertDescription>
          </Alert>
        )}

        {lastResult && !lastResult.success && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{lastResult.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
