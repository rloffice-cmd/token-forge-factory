/**
 * Landing Page - Customer Acquisition & Conversion
 * דף נחיתה אוטומטי להמרת מבקרים ללקוחות משלמים
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Shield, 
  Clock, 
  Coins, 
  ArrowLeft, 
  CheckCircle2, 
  Bot,
  Sparkles,
  TrendingUp,
  Lock,
  Code2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const FEATURES = [
  {
    icon: Bot,
    title: 'AI-Powered Services',
    titleHe: 'שירותי AI מתקדמים',
    description: 'סיכום, תרגום, ניתוח, חילוץ מידע ועוד',
  },
  {
    icon: Shield,
    title: 'Quality Guaranteed',
    titleHe: 'איכות מובטחת',
    description: 'אימות אוטומטי עם Proof Pack לכל תוצאה',
  },
  {
    icon: Clock,
    title: 'Instant Delivery',
    titleHe: 'משלוח מיידי',
    description: 'תוצאות תוך שניות, לא שעות',
  },
  {
    icon: Lock,
    title: 'Crypto Payments',
    titleHe: 'תשלום בקריפטו',
    description: 'ETH, USDC, BTC - אנונימי ומאובטח',
  },
];

const AI_SERVICES = [
  { name: 'סיכום טקסטים', icon: '📝', desc: 'סיכום מסמכים ארוכים לנקודות מפתח' },
  { name: 'תרגום', icon: '🌍', desc: 'תרגום מקצועי לעשרות שפות' },
  { name: 'ניתוח נתונים', icon: '📊', desc: 'ניתוח וחילוץ תובנות מטקסט' },
  { name: 'יצירת תוכן', icon: '✨', desc: 'יצירת תוכן מקורי ואיכותי' },
  { name: 'כתיבת קוד', icon: '💻', desc: 'כתיבת ותיקון קוד בכל שפה' },
  { name: 'חילוץ מידע', icon: '🔍', desc: 'חילוץ נתונים מובנים מטקסט' },
];

const PRICING = [
  { credits: 25, price: 9, popular: false },
  { credits: 100, price: 29, popular: true },
  { credits: 500, price: 99, popular: false },
];

export default function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGetStarted = async (packCredits: number) => {
    if (!email) {
      toast.error('הזן אימייל כדי להתחיל');
      return;
    }

    setIsLoading(true);

    try {
      // Find pack by credits
      const { data: packs } = await supabase
        .from('credit_packs')
        .select('id')
        .eq('credits', packCredits)
        .eq('is_active', true)
        .single();

      if (!packs) {
        navigate('/purchase');
        return;
      }

      // Create checkout
      const { data, error } = await supabase.functions.invoke('create-coinbase-checkout', {
        body: {
          pack_id: packs.id,
          customer_email: email,
        },
      });

      if (error) throw error;

      if (data.hosted_url) {
        sessionStorage.setItem('pending_charge_id', data.charge_id);
        sessionStorage.setItem('pending_email', email);
        window.location.href = data.hosted_url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('שגיאה - נסה שוב');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(white,transparent_70%)]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-3xl opacity-20" />
        
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <Badge className="mb-6 py-2 px-4 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="w-4 h-4 mr-2" />
              AI Proof Factory - 24/7 Autonomous
            </Badge>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent">
              הוכחות מתמטיות
              <br />
              <span className="text-primary">אוטומטיות לחלוטין</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              מערכת AI שמייצרת הוכחות פורמליות, מאמתת אותן אוטומטית, 
              ומספקת תוצאות מושלמות - 24 שעות ביממה, 7 ימים בשבוע.
            </p>

            {/* Quick CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="max-w-xs text-center"
                dir="ltr"
              />
              <Button 
                size="lg" 
                className="gap-2 px-8"
                onClick={() => handleGetStarted(100)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Zap className="w-5 h-5" />
                )}
                התחל עכשיו - $29
              </Button>
            </div>

            {/* Trust Signals */}
            <div className="flex justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>אפס תוצאות שגויות</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>תשלום מאובטח בקריפטו</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <span>תמיכה 24/7</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            למה לבחור ב-Token Forge?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((feature, i) => (
              <Card key={i} className="glass-card hover:scale-105 transition-transform">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.titleHe}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* AI Services Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            שירותי AI זמינים
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            מגוון שירותים מונעי בינה מלאכותית
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {AI_SERVICES.map((service, i) => (
              <Card key={i} className="glass-card text-center hover:scale-105 transition-transform">
                <CardContent className="pt-6">
                  <div className="text-4xl mb-3">{service.icon}</div>
                  <h3 className="font-semibold text-sm mb-1">{service.name}</h3>
                  <p className="text-xs text-muted-foreground">{service.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            תמחור פשוט ושקוף
          </h2>
          <p className="text-center text-muted-foreground mb-12">
            קנה קרדיטים, השתמש מתי שתרצה. בלי מנויים.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {PRICING.map((tier, i) => (
              <Card 
                key={i} 
                className={`glass-card relative overflow-hidden ${
                  tier.popular ? 'ring-2 ring-primary scale-105' : ''
                }`}
              >
                {tier.popular && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-primary">הכי פופולרי</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-primary" />
                    {tier.credits} קרדיטים
                  </CardTitle>
                  <CardDescription>
                    ${(tier.price / tier.credits).toFixed(2)} לקרדיט
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold mb-4">
                    ${tier.price}
                    <span className="text-sm text-muted-foreground font-normal"> USD</span>
                  </div>
                  <Button 
                    className="w-full" 
                    variant={tier.popular ? 'default' : 'outline'}
                    onClick={() => handleGetStarted(tier.credits)}
                    disabled={isLoading || !email}
                  >
                    קנה עכשיו
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            איך זה עובד?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="font-semibold mb-2">רכוש קרדיטים</h3>
              <p className="text-sm text-muted-foreground">
                תשלום מהיר ומאובטח בקריפטו
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="font-semibold mb-2">שלח משימה</h3>
              <p className="text-sm text-muted-foreground">
                תאר את ההוכחה שאתה צריך
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="font-semibold mb-2">קבל תוצאות</h3>
              <p className="text-sm text-muted-foreground">
                הוכחה מאומתת תוך דקות
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* API Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-4 py-2 px-4 bg-primary/10 text-primary border-primary/20">
            <Code2 className="w-4 h-4 mr-2" />
            B2B Integration
          </Badge>
          <h2 className="text-3xl font-bold mb-4">
            שילוב ב-API
          </h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            לקוחות עסקיים יכולים לשלב את השירות ישירות באפליקציה שלהם
          </p>
          <Button variant="outline" onClick={() => navigate('/api-docs')}>
            <Code2 className="w-4 h-4 mr-2" />
            צפה בתיעוד API
          </Button>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="glass-card max-w-2xl mx-auto text-center p-8">
            <h2 className="text-2xl font-bold mb-4">
              מוכן להתחיל?
            </h2>
            <p className="text-muted-foreground mb-6">
              הצטרף לאלפי משתמשים שכבר נהנים מהוכחות אוטומטיות
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="max-w-xs"
                dir="ltr"
              />
              <Button onClick={() => handleGetStarted(100)} disabled={isLoading}>
                <Zap className="w-4 h-4 mr-2" />
                התחל עכשיו
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Token Forge Factory. All rights reserved.</p>
          <p className="mt-2">
            <button 
              onClick={() => navigate('/')}
              className="underline hover:text-primary"
            >
              Admin Dashboard
            </button>
          </p>
        </div>
      </footer>
    </div>
  );
}
