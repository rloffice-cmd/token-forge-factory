/**
 * Landing Page - Enterprise Grade Customer Acquisition
 * דף נחיתה Premium עם Free Trial, Trust Signals ו-UX מושלם
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Shield, 
  Clock, 
  Wallet,
  CheckCircle2, 
  Sparkles,
  Lock,
  ArrowRight,
  Terminal,
  Globe,
  TrendingUp,
  AlertTriangle,
  Code2,
  Webhook,
  DollarSign,
  Bot,
  Star,
  ChevronDown,
  Gift,
  Key,
  Copy,
  Users,
  Award
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  TechPartners, 
  TrustBadges, 
  CaseStudyCards, 
  TestimonialSection,
  GuaranteeBadge,
  LiveActivityFeed 
} from '@/components/landing/TrustSignals';

// Animated counter hook
function useCounter(end: number, duration: number = 2000, delay: number = 0) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    const timeout = setTimeout(() => {
      let startTime: number;
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        setCount(Math.floor(progress * end));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timeout);
  }, [end, duration, delay]);
  
  return count;
}

const STATS = [
  { value: 50000, label: 'API Calls', suffix: '+' },
  { value: 99.9, label: 'Uptime', suffix: '%', decimals: 1 },
  { value: 15, label: 'ms Response', suffix: 'ms' },
  { value: 24, label: 'Support', suffix: '/7' },
];

const PRODUCTS = [
  {
    icon: Wallet,
    name: 'Wallet Risk API',
    nameHe: 'בדיקת סיכון ארנק',
    price: '$0.02',
    description: 'זהה ארנקים מסוכנים לפני שהם פוגעים בך',
    color: 'from-orange-500 to-amber-500',
    features: ['Risk Score 0-100', 'Flags & Labels', 'Real-time'],
  },
  {
    icon: Webhook,
    name: 'Webhook Health',
    nameHe: 'בריאות Webhook',
    price: '$0.25',
    description: 'האם ה-Webhook שלך באמת עובד? בדוק עכשיו',
    color: 'from-blue-500 to-cyan-500',
    features: ['Status Check', 'Response Time', 'Error Detection'],
  },
  {
    icon: DollarSign,
    name: 'Payment Drift',
    nameHe: 'גלאי פער תשלומים',
    price: '$2.00',
    description: 'מצא כסף שהלך לאיבוד בין מה שציפית למה שקיבלת',
    color: 'from-emerald-500 to-green-500',
    features: ['Drift %', 'Missing Amount', 'Reconciliation'],
  },
];

const TESTIMONIALS = [
  {
    quote: "Found a $3,000 discrepancy in our payment flow within 2 minutes. ROI on day one.",
    author: "DeFi Protocol Lead",
    company: "Anonymous",
    rating: 5,
  },
  {
    quote: "The wallet risk API caught 3 high-risk addresses before they could interact with our contracts.",
    author: "Security Engineer",
    company: "Web3 Startup",
    rating: 5,
  },
];

const USE_CASES = [
  {
    title: 'לפני אינטראקציה עם ארנק חדש',
    description: 'בדוק אם הארנק מסוכן, קשור להאקים, או בעייתי',
    icon: Shield,
  },
  {
    title: 'אחרי הגדרת Webhook',
    description: 'וודא שההודעות מגיעות ושהשרת עונה בזמן',
    icon: Webhook,
  },
  {
    title: 'בסוף כל יום עבודה',
    description: 'בדוק אם הכסף שהגיע תואם למה שציפית',
    icon: TrendingUp,
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Free Trial handler
  const handleFreeTrial = async () => {
    if (!email) {
      toast.error('הזן אימייל כדי לקבל גישה חינם');
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
        setShowApiKey(true);
        toast.success('מזל טוב! קיבלת 10 קריאות API בחינם 🎉');
      }
    } catch (error) {
      console.error('Free trial error:', error);
      toast.error('שגיאה - נסה שוב');
    } finally {
      setIsLoading(false);
    }
  };

  const copyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      toast.success('הועתק!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden" dir="rtl">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(var(--warning)/0.1),transparent_50%)]" />
          <div className="absolute inset-0 bg-grid-white/[0.02] [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]" />
          
          {/* Floating Orbs */}
          <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-warning/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className={`relative z-10 max-w-6xl mx-auto px-6 text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 backdrop-blur-sm mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-sm text-primary font-medium">Autonomous Security Layer</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              גלה בעיות
            </span>
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-emerald-400 bg-clip-text text-transparent">
              לפני שהן עולות לך כסף
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            API-ים חכמים שמזהים ארנקים מסוכנים, Webhooks תקולים, 
            <br className="hidden md:block" />
            ופערים בתשלומים — <span className="text-primary font-semibold">בסנטים בודדים לבדיקה</span>
          </p>

          {/* CTA - Free Trial */}
          {showApiKey && apiKey ? (
            <Card className="max-w-md mx-auto mb-16 border-2 border-primary/50 bg-primary/5">
              <CardContent className="p-6">
                <div className="text-center mb-4">
                  <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-2" />
                  <h3 className="text-xl font-bold">הנה ה-API Key שלך!</h3>
                  <p className="text-sm text-muted-foreground">שמור אותו - לא תראה אותו שוב</p>
                </div>
                <div className="relative mb-4">
                  <Input value={apiKey} readOnly className="font-mono text-sm pr-12" dir="ltr" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute left-1 top-1/2 -translate-y-1/2"
                    onClick={copyApiKey}
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex justify-center gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">10</div>
                    <div className="text-muted-foreground">קרדיטים</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">∞</div>
                    <div className="text-muted-foreground">תוקף</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-primary/60 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-500" />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="relative w-72 h-14 text-center text-lg bg-background border-2 border-primary/30 focus:border-primary"
                  dir="ltr"
                />
              </div>
              <Button 
                size="lg" 
                className="h-14 px-8 text-lg gap-2 shadow-lg"
                onClick={handleFreeTrial}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <>
                    <Gift className="w-5 h-5" />
                    קבל 10 קריאות בחינם
                    <ArrowRight className="w-5 h-5 mr-1" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Trust Signals */}
          <div className="flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            {[
              { icon: Lock, text: 'תשלום מאובטח בקריפטו' },
              { icon: CheckCircle2, text: 'בלי מנויים - שלם לפי שימוש' },
              { icon: Sparkles, text: 'תוצאות מיידיות' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <item.icon className="w-4 h-4 text-primary" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          {/* Scroll Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <ChevronDown className="w-8 h-8 text-muted-foreground" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-border/50 bg-muted/20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-primary mb-2">
                  {stat.decimals ? stat.value.toFixed(stat.decimals) : useCounter(stat.value, 2000, i * 200)}
                  <span className="text-2xl">{stat.suffix}</span>
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Partners / Trust Signals */}
      <TechPartners />

      {/* Products Section */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              <Terminal className="w-4 h-4 ml-2" />
              Micro APIs
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              שלושה מוצרים, מיליון תובנות
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              כל קריאה עולה סנטים. כל תובנה שווה אלפים.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PRODUCTS.map((product, i) => (
              <Card 
                key={i} 
                className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-500"
              >
                {/* Gradient Top Bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${product.color}`} />
                
                <CardContent className="p-8">
                  {/* Icon */}
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${product.color} p-0.5 mb-6`}>
                    <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center">
                      <product.icon className="w-8 h-8 text-foreground" />
                    </div>
                  </div>

                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{product.nameHe}</h3>
                      <p className="text-sm text-muted-foreground">{product.name}</p>
                    </div>
                    <Badge variant="secondary" className="text-lg font-bold">
                      {product.price}
                    </Badge>
                  </div>

                  <p className="text-muted-foreground mb-6">
                    {product.description}
                  </p>

                  {/* Features */}
                  <ul className="space-y-3">
                    {product.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm">
                        <div className={`w-5 h-5 rounded-full bg-gradient-to-r ${product.color} flex items-center justify-center`}>
                          <CheckCircle2 className="w-3 h-3 text-background" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button 
                    className="w-full mt-8 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    variant="outline"
                    onClick={() => navigate('/purchase')}
                  >
                    נסה עכשיו
                    <ArrowRight className="w-4 h-4 mr-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              מתי להשתמש?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              שלושה רגעים קריטיים שבהם בדיקה קטנה חוסכת הפסד גדול
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {USE_CASES.map((useCase, i) => (
              <div key={i} className="text-center p-8 rounded-2xl bg-card/50 border border-border/50">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <useCase.icon className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{useCase.title}</h3>
                <p className="text-muted-foreground">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              מה אומרים עלינו
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {TESTIMONIALS.map((testimonial, i) => (
              <Card key={i} className="p-8 bg-card/50 border-border/50">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, j) => (
                    <Star key={j} className="w-5 h-5 fill-warning text-warning" />
                  ))}
                </div>
                <blockquote className="text-lg mb-6" dir="ltr">
                  "{testimonial.quote}"
                </blockquote>
                <div>
                  <div className="font-semibold">{testimonial.author}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.company}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Guardian Upsell */}
      <section className="py-24 bg-gradient-to-br from-primary/5 to-warning/5">
        <div className="max-w-6xl mx-auto px-6">
          <Card className="overflow-hidden border-2 border-primary/20">
            <CardContent className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                {/* Content */}
                <div className="p-12">
                  <Badge className="mb-6 bg-primary text-primary-foreground">
                    <Shield className="w-4 h-4 ml-1" />
                    Guardian Tier
                  </Badge>
                  <h2 className="text-4xl font-bold mb-6">
                    מוצא בעיות חוזרות?
                    <br />
                    <span className="text-primary">Guardian מתקן אותן.</span>
                  </h2>
                  <p className="text-lg text-muted-foreground mb-8">
                    כשהסנסורים מזהים דפוסים בעייתיים, Guardian נכנס לפעולה — 
                    חוסם ארנקים מסוכנים, מתקן Webhooks, ומאזן תשלומים. אוטומטית.
                  </p>
                  <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-5xl font-bold text-primary">$499</span>
                    <span className="text-xl text-muted-foreground">/חודש</span>
                  </div>
                  <Button size="lg" onClick={() => navigate('/purchase')}>
                    <Shield className="w-5 h-5 ml-2" />
                    הפעל Guardian
                  </Button>
                </div>

                {/* Visual */}
                <div className="bg-card/50 p-12 flex items-center">
                  <div className="w-full space-y-4">
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-warning/10 border border-warning/20">
                      <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-1" />
                      <div>
                        <div className="font-semibold mb-1">התראה: 5 ארנקים מסוכנים</div>
                        <div className="text-sm text-muted-foreground">זוהו ב-24 שעות אחרונות</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <Bot className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                      <div>
                        <div className="font-semibold mb-1">Guardian פעל</div>
                        <div className="text-sm text-muted-foreground">5 ארנקים נחסמו אוטומטית</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-4 rounded-lg bg-success/10 border border-success/20">
                      <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0 mt-1" />
                      <div>
                        <div className="font-semibold mb-1">חסכון משוער: $12,500</div>
                        <div className="text-sm text-muted-foreground">הפסד שנמנע החודש</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* API Section */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <Badge variant="outline" className="mb-6 px-4 py-2">
            <Code2 className="w-4 h-4 ml-2" />
            Developer Friendly
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            API פשוט, תוצאות מיידיות
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            קו אחד של קוד. תשובה תוך מילישניות.
          </p>

          <div className="code-block text-left max-w-3xl mx-auto mb-8">
            <pre className="text-sm md:text-base overflow-x-auto">
{`curl -X POST https://api.tokenforge.io/v1/wallet-risk \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"address": "0x..."}'

// Response:
{
  "risk_score": 78,
  "decision": "HIGH_RISK",
  "flags": ["mixer_interaction", "sanctioned_entity"]
}`}
            </pre>
          </div>

          <Button size="lg" variant="outline" onClick={() => navigate('/api-docs')}>
            <Code2 className="w-5 h-5 ml-2" />
            צפה בתיעוד המלא
          </Button>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-gradient-to-br from-primary/10 via-background to-muted/30">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            מוכן לגלות מה מתחמק ממך?
          </h2>
          <p className="text-xl text-muted-foreground mb-12">
            התחל עם 10 קריאות בחינם. בלי כרטיס אשראי.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-72 h-14 text-center text-lg"
              dir="ltr"
            />
            <Button 
              size="lg" 
              className="h-14 px-8 text-lg gap-2"
              onClick={handleFreeTrial}
              disabled={isLoading}
            >
              <Gift className="w-5 h-5" />
              קבל גישה חינם
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold">Token Forge</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <button onClick={() => navigate('/api-docs')} className="hover:text-foreground transition-colors">
                תיעוד API
              </button>
              <button onClick={() => navigate('/purchase')} className="hover:text-foreground transition-colors">
                תמחור
              </button>
              <button onClick={() => navigate('/micro')} className="hover:text-foreground transition-colors">
                Micro APIs
              </button>
              <button onClick={() => navigate('/')} className="hover:text-foreground transition-colors">
                Admin
              </button>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2024 Token Forge. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
