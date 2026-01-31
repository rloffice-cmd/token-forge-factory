/**
 * Purchase Page - Crypto Payment Flow
 * דף רכישה עם תשלום בקריפטו
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Coins, Wallet, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreditPack {
  id: string;
  name: string;
  name_he: string;
  description: string | null;
  description_he: string | null;
  credits: number;
  price_usd: number;
  is_popular: boolean | null;
  features: any;
}

export default function Purchase() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch credit packs
  const { data: packs, isLoading } = useQuery({
    queryKey: ['credit-packs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_packs')
        .select('*')
        .eq('is_active', true)
        .order('price_usd', { ascending: true });

      if (error) throw error;
      return data as CreditPack[];
    },
  });

  const handlePurchase = async () => {
    if (!email || !selectedPack) {
      toast.error('נא למלא אימייל ולבחור חבילה');
      return;
    }

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      toast.error('כתובת אימייל לא תקינה');
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-coinbase-checkout', {
        body: {
          pack_id: selectedPack,
          customer_email: email,
        },
      });

      if (error) throw error;

      if (data.hosted_url) {
        // Store charge info for success page
        sessionStorage.setItem('pending_charge_id', data.charge_id);
        sessionStorage.setItem('pending_email', email);
        
        // Redirect to Coinbase Commerce
        window.location.href = data.hosted_url;
      } else {
        throw new Error('No hosted URL returned');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('שגיאה ביצירת תשלום. נסה שוב.');
      setIsProcessing(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            className="mb-4"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-4 h-4 ml-2" />
            חזרה לדשבורד
          </Button>
          <h1 className="text-3xl font-bold">רכישת קרדיטים</h1>
          <p className="text-muted-foreground mt-1">
            תשלום מאובטח בקריפטו דרך Coinbase Commerce
          </p>
        </div>

        {/* Email Input */}
        <Card className="glass-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              פרטי לקוח
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="email">כתובת אימייל</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="max-w-md"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground">
                הקרדיטים יזוכו לחשבון המשויך לאימייל זה
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Credit Packs */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">בחר חבילה</h2>
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="glass-card animate-pulse">
                  <CardContent className="pt-6 h-48" />
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {packs?.map((pack) => (
                <Card
                  key={pack.id}
                  className={`glass-card cursor-pointer transition-all hover:scale-105 ${
                    selectedPack === pack.id 
                      ? 'ring-2 ring-primary glow-border' 
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedPack(pack.id)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{pack.name_he}</CardTitle>
                      {pack.is_popular && (
                        <Badge variant="default" className="bg-primary">
                          פופולרי
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{pack.description_he}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-primary" />
                        <span className="text-2xl font-bold text-primary">
                          {pack.credits}
                        </span>
                        <span className="text-muted-foreground">קרדיטים</span>
                      </div>
                    </div>
                    <div className="text-2xl font-bold">
                      ${pack.price_usd}
                      <span className="text-sm text-muted-foreground mr-1">USD</span>
                    </div>
                    {selectedPack === pack.id && (
                      <div className="mt-3 flex items-center text-primary">
                        <CheckCircle className="w-4 h-4 ml-1" />
                        נבחר
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Purchase Button */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <Button
              size="lg"
              className="w-full"
              disabled={!email || !selectedPack || isProcessing}
              onClick={handlePurchase}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  מעבד...
                </>
              ) : (
                <>
                  <Wallet className="w-4 h-4 ml-2" />
                  לתשלום בקריפטו
                </>
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4">
              תשלום מאובטח דרך Coinbase Commerce • ETH, USDC, BTC ועוד
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
