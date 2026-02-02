/**
 * Purchase Page - Enhanced Crypto Payment Flow with Trust Elements
 * דף רכישה משופר עם אמצעי אמון ובטחון
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Coins, 
  Wallet, 
  Loader2, 
  CheckCircle, 
  ArrowLeft, 
  Shield, 
  Lock, 
  RefreshCw,
  Star,
  Clock,
  Users,
  Zap,
  BadgeCheck,
  HeartHandshake,
  CreditCard
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PaymentSecurityBadges } from '@/components/landing/TrustSignals';

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

// Quick testimonial for social proof
const QUICK_TESTIMONIAL = {
  quote: "Instant access, exactly as promised. Great value.",
  author: "Daniel K.",
  role: "Developer",
};

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

  const selectedPackData = packs?.find(p => p.id === selectedPack);

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
      <div className="p-4 md:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <Button 
            variant="ghost" 
            className="mb-4"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-4 h-4 ml-2" />
            חזרה
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">רכישת קרדיטים</h1>
          <p className="text-muted-foreground mt-1">
            בחר חבילה ושלם בבטחה
          </p>
        </div>

        {/* Trust Banner - Prominently placed */}
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-primary/10 border border-emerald-500/30">
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-500" />
              <span className="font-medium">החזר כספי מלא 7 ימים</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-500" />
              <span>תשלום מאובטח</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              <span>גישה מיידית</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Credit Packs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Email Input */}
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wallet className="w-5 h-5 text-primary" />
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
                    className="text-base"
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    הקרדיטים יזוכו לחשבון זה • המידע שלך מאובטח
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Credit Packs */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                בחר חבילה
              </h2>
              
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="pt-6 h-40" />
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {packs?.map((pack) => (
                    <Card
                      key={pack.id}
                      className={`cursor-pointer transition-all hover:scale-[1.02] relative overflow-hidden ${
                        selectedPack === pack.id 
                          ? 'ring-2 ring-primary border-primary shadow-lg' 
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedPack(pack.id)}
                    >
                      {pack.is_popular && (
                        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary to-emerald-500" />
                      )}
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">{pack.name_he}</CardTitle>
                          {pack.is_popular && (
                            <Badge className="bg-primary text-xs">
                              <Star className="w-3 h-3 ml-1" />
                              מומלץ
                            </Badge>
                          )}
                        </div>
                        {pack.description_he && (
                          <CardDescription className="text-xs">{pack.description_he}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="flex items-center gap-1 text-primary">
                              <Coins className="w-4 h-4" />
                              <span className="text-xl font-bold">
                                {pack.credits}
                              </span>
                              <span className="text-xs text-muted-foreground">קרדיטים</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              ${(pack.price_usd / pack.credits).toFixed(3)} לקרדיט
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="text-2xl font-bold">
                              ${pack.price_usd}
                            </div>
                          </div>
                        </div>
                        {selectedPack === pack.id && (
                          <div className="mt-3 flex items-center text-primary text-sm">
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
          </div>

          {/* Sidebar - Summary & Trust */}
          <div className="space-y-4">
            {/* Order Summary */}
            <Card className="border-2 border-primary/30 sticky top-4">
              <CardHeader className="pb-3 bg-primary/5">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  סיכום הזמנה
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {selectedPackData ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{selectedPackData.name_he}</span>
                      <span className="font-bold">${selectedPackData.price_usd}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">קרדיטים</span>
                      <span className="text-primary font-semibold">{selectedPackData.credits}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex justify-between items-center text-lg font-bold">
                        <span>סה"כ</span>
                        <span className="text-primary">${selectedPackData.price_usd}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    בחר חבילה להמשך
                  </p>
                )}

                {/* Purchase Button */}
                <Button
                  size="lg"
                  className="w-full text-base"
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
                      <Lock className="w-4 h-4 ml-2" />
                      לתשלום מאובטח
                    </>
                  )}
                </Button>

                {/* Security badges under button */}
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <Badge variant="outline" className="text-xs gap-1">
                    <Shield className="w-3 h-3 text-emerald-500" />
                    מאובטח
                  </Badge>
                  <Badge variant="outline" className="text-xs gap-1">
                    <RefreshCw className="w-3 h-3 text-blue-500" />
                    החזר כספי
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Trust Elements */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-4">
                {/* Guarantee */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Shield className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">100% החזר כספי</h4>
                    <p className="text-xs text-muted-foreground">
                      לא מרוצה? קבל החזר מלא תוך 7 ימים. בלי שאלות.
                    </p>
                  </div>
                </div>

                {/* Instant Access */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Zap className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">גישה מיידית</h4>
                    <p className="text-xs text-muted-foreground">
                      הקרדיטים מופיעים בחשבון שלך מיד אחרי התשלום.
                    </p>
                  </div>
                </div>

                {/* Secure Payment */}
                <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <Lock className="w-6 h-6 text-purple-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-sm">תשלום מאובטח</h4>
                    <p className="text-xs text-muted-foreground">
                      Coinbase Commerce • הצפנת 256-bit • GDPR Compliant
                    </p>
                  </div>
                </div>

                {/* Quick Testimonial */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-xs italic text-muted-foreground mb-2" dir="ltr">
                    "{QUICK_TESTIMONIAL.quote}"
                  </p>
                  <p className="text-xs text-muted-foreground">
                    — {QUICK_TESTIMONIAL.author}, {QUICK_TESTIMONIAL.role}
                  </p>
                </div>

                {/* Support */}
                <div className="border-t pt-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <HeartHandshake className="w-4 h-4" />
                    <span>תמיכה 24/7 בטלגרם</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Accepted Payments */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">אמצעי תשלום נתמכים</p>
              <div className="flex justify-center gap-3 text-xs font-medium text-muted-foreground">
                <span>ETH</span>
                <span>•</span>
                <span>USDC</span>
                <span>•</span>
                <span>BTC</span>
                <span>•</span>
                <span>DAI</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
