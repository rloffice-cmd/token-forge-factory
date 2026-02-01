/**
 * Free Trial Form - טופס הרשמה ל-Free Trial
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Gift, 
  Copy, 
  CheckCircle2, 
  ArrowRight,
  Key,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FreeTrialFormProps {
  onSuccess?: () => void;
}

export function FreeTrialForm({ onSuccess }: FreeTrialFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('הזן כתובת אימייל תקינה');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('provision-free-trial', {
        body: { email },
      });

      if (error) throw error;

      if (data.already_used) {
        toast.error(data.error);
        return;
      }

      if (data.api_key) {
        setApiKey(data.api_key);
        toast.success('מזל טוב! קיבלת 10 קריאות API בחינם 🎉');
        onSuccess?.();
      }
    } catch (error) {
      console.error('Free trial error:', error);
      toast.error('שגיאה - נסה שוב מאוחר יותר');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success('הועתק!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (apiKey) {
    return (
      <Card className="overflow-hidden border-2 border-emerald-500/50 bg-emerald-500/5">
        <CardContent className="p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2">הנה ה-API Key שלך!</h3>
            <p className="text-muted-foreground">
              שמור אותו במקום בטוח - לא תראה אותו שוב
            </p>
          </div>

          <div className="relative mb-6">
            <Input 
              value={apiKey} 
              readOnly 
              className="font-mono text-sm pr-12 bg-card"
              dir="ltr"
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute left-1 top-1/2 -translate-y-1/2"
              onClick={copyToClipboard}
            >
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-card text-center">
              <div className="text-2xl font-bold text-primary">10</div>
              <div className="text-sm text-muted-foreground">קרדיטים</div>
            </div>
            <div className="p-4 rounded-lg bg-card text-center">
              <div className="text-2xl font-bold text-primary">∞</div>
              <div className="text-sm text-muted-foreground">תוקף</div>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Wallet Risk Ping = 1 קרדיט</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Webhook Health = 1 קרדיט</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Payment Drift = 1 קרדיט</span>
            </div>
          </div>

          <Button className="w-full mt-6" variant="outline" asChild>
            <a href="/api-docs">
              קרא את התיעוד
              <ArrowRight className="w-4 h-4 mr-2" />
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-2 border-primary/30">
      <CardContent className="p-8">
        <div className="text-center mb-6">
          <Badge className="mb-4 bg-gradient-to-r from-primary to-emerald-500 text-primary-foreground">
            <Gift className="w-4 h-4 ml-1" />
            Free Trial
          </Badge>
          <h3 className="text-2xl font-bold mb-2">נסה בחינם</h3>
          <p className="text-muted-foreground">
            קבל 10 קריאות API בחינם. בלי כרטיס אשראי.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 text-center"
            dir="ltr"
            required
          />
          
          <Button 
            type="submit" 
            className="w-full h-12 gap-2 bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <>
                <Key className="w-5 h-5" />
                קבל API Key בחינם
                <Sparkles className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-border/50">
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              בלי כרטיס אשראי
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              בלי התחייבות
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              לא פג תוקף
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FreeTrialCTA() {
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return (
      <div className="max-w-md mx-auto">
        <FreeTrialForm />
      </div>
    );
  }

  return (
    <div className="text-center">
      <Button 
        size="lg" 
        className="h-14 px-8 gap-2 bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 shadow-lg shadow-primary/25"
        onClick={() => setShowForm(true)}
      >
        <Gift className="w-5 h-5" />
        קבל 10 קריאות בחינם
        <ArrowRight className="w-5 h-5" />
      </Button>
      <p className="mt-3 text-sm text-muted-foreground">
        בלי כרטיס אשראי. בלי התחייבות.
      </p>
    </div>
  );
}
