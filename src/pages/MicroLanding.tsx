/**
 * Micro Landing Page - Sensor Products Showcase
 * דף נחיתה Premium למוצרי ה-Micro Sensors
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Shield, 
  Wallet, 
  Webhook, 
  DollarSign, 
  ArrowRight,
  CheckCircle,
  Zap,
  Code,
  Lock,
  AlertTriangle,
  Bot,
  TrendingDown,
  Activity,
  Eye,
  ChevronDown,
  Star,
  Clock,
  Terminal
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Product configurations
const PRODUCTS = [
  {
    id: 'wallet-risk',
    name: 'בדיקת סיכון ארנק',
    nameHe: 'בדיקת סיכון ארנק',
    price: 0.02,
    priceDisplay: '$0.02',
    description: 'האם הארנק הזה בטוח? קבל תשובה מיידית',
    longDescription: 'בדיקה מקיפה של היסטוריית ארנק, קשרים לגופים מסוכנים, ודפוסי פעילות חשודה.',
    icon: Wallet,
    gradient: 'from-orange-500 to-amber-500',
    bgGlow: 'bg-orange-500/20',
    features: [
      'Risk Score 0-100',
      'Flags: Mixer, Sanctioned, Phishing',
      'תגובה תוך 50ms',
      'היסטוריית 90 יום',
    ],
    apiExample: `curl -X POST /v1/wallet-risk \\
  -d '{"address": "0x..."}'
  
// Response: { "risk_score": 78, "flags": ["mixer"] }`,
    useCase: 'לפני כל אינטראקציה עם ארנק חדש',
  },
  {
    id: 'webhook-check',
    name: 'בדיקת תקינות Webhook',
    nameHe: 'בדיקת תקינות Webhook',
    price: 0.25,
    priceDisplay: '$0.25',
    description: 'האם ה-Webhook שלך באמת עובד? בדוק עכשיו',
    longDescription: 'בדיקת זמינות, מדידת זמני תגובה, ואבחון שגיאות בנקודת הקצה שלך.',
    icon: Webhook,
    gradient: 'from-blue-500 to-cyan-500',
    bgGlow: 'bg-blue-500/20',
    features: [
      'בדיקת זמינות (UP/DOWN)',
      'מדידת Response Time',
      'בדיקת SSL/TLS',
      'ניתוח קוד סטטוס',
    ],
    apiExample: `curl -X POST /v1/webhook-check \\
  -d '{"url": "https://your-endpoint.com/webhook"}'
  
// Response: { "status": "healthy", "latency_ms": 45 }`,
    useCase: 'אחרי כל שינוי בתשתית',
  },
  {
    id: 'payment-drift',
    name: 'גלאי סטייה תשלום',
    nameHe: 'גלאי פער בתשלומים',
    price: 2.00,
    priceDisplay: '$2.00',
    description: 'מצא את הכסף שהלך לאיבוד',
    longDescription: 'השוואה בין תשלומים צפויים לכסף שהתקבל בפועל. מזהה פערים ואנומליות.',
    icon: DollarSign,
    gradient: 'from-emerald-500 to-green-500',
    bgGlow: 'bg-emerald-500/20',
    features: [
      'Drift % בין צפוי לבפועל',
      'זיהוי סכומים חסרים',
      'התראות אנומליה',
      'היסטוריית 30 יום',
    ],
    apiExample: `curl -X POST /v1/payment-drift \\
  -d '{"expected": 1000, "received": 970}'
  
// Response: { "drift_percent": 3.0, "missing": 30 }`,
    useCase: 'בסוף כל יום עבודה',
  },
];

const COMPARISON = [
  { feature: 'מחיר לקריאה', sensor: 'סנטים', guardian: 'כלול במנוי' },
  { feature: 'תיקון אוטומטי', sensor: '❌', guardian: '✅' },
  { feature: 'התראות', sensor: '❌', guardian: '✅ 24/7' },
  { feature: 'Retry Logic', sensor: '❌', guardian: '✅ אוטומטי' },
  { feature: 'חסימת איומים', sensor: 'רק זיהוי', guardian: 'זיהוי + חסימה' },
];

const FAQ = [
  {
    q: 'מה ההבדל בין Sensors ל-Guardian?',
    a: 'Sensors מגלים בעיות, Guardian מתקן אותן. Sensors הם למי שרוצה לטפל בעצמו, Guardian למי שרוצה אוטומציה מלאה.',
  },
  {
    q: 'יש Free Tier?',
    a: 'לא. אפילו $0.02 לקריאה מסנן ספאם ומוכיח כוונה אמיתית. אנחנו מעדיפים לקוחות שמשלמים על לקוחות שמנסים.',
  },
  {
    q: 'מה קורה אם אגמור קרדיטים?',
    a: 'הקריאות יעצרו ותקבל התראה. בלי חיובים נסתרים, בלי הפתעות.',
  },
  {
    q: 'האם אפשר לשלב עם המערכת שלי?',
    a: 'כן. REST API סטנדרטי, תיעוד מלא, ודוגמאות קוד. שורה אחת של קוד.',
  },
];

export default function MicroLanding() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [activeProduct, setActiveProduct] = useState(0);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handlePurchase = async () => {
    if (!email) {
      toast.error('הזן אימייל כדי להמשיך');
      return;
    }
    
    setIsLoading(true);
    try {
      const { data: packs } = await supabase
        .from('credit_packs')
        .select('id')
        .eq('is_active', true)
        .order('price_usd', { ascending: true })
        .limit(1)
        .single();

      if (!packs) {
        navigate('/purchase');
        return;
      }

      const { data, error } = await supabase.functions.invoke('create-coinbase-checkout', {
        body: { pack_id: packs.id, customer_email: email },
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
    <div className="min-h-screen bg-background overflow-hidden" dir="rtl">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.1),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(38,92%,50%,0.08),transparent_50%)]" />
          
          {/* Animated Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.03)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
          
          {/* Floating Elements */}
          <div className="absolute top-20 right-20 w-64 h-64 bg-orange-500/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-20 left-20 w-80 h-80 bg-blue-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />
        </div>

        <div className={`relative z-10 max-w-6xl mx-auto px-6 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Content */}
            <div>
              <Badge variant="outline" className="mb-6 px-4 py-2 text-base">
                <Activity className="w-4 h-4 ml-2 text-primary" />
                Micro Sensors
              </Badge>

              <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  שלושה סנסורים.
                </span>
                <br />
                <span className="bg-gradient-to-r from-orange-500 via-primary to-blue-500 bg-clip-text text-transparent">
                  אלף תובנות.
                </span>
              </h1>

              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                API-ים זעירים שמגלים בעיות לפני שהן עולות לך כסף.
                <br />
                <span className="font-semibold text-foreground">לא מתקנים. לא מבטיחים. רק מראים את האמת.</span>
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-14 text-lg"
                  dir="ltr"
                />
                <Button 
                  size="lg" 
                  className="h-14 px-8 gap-2"
                  onClick={handlePurchase}
                  disabled={isLoading}
                >
                  {isLoading ? '...' : <>קבל מפתח API<ArrowRight className="w-5 h-5 mr-1" /></>}
                </Button>
              </div>

              <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  בלי מנויים
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  שלם לפי שימוש
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  תוצאות מיידיות
                </div>
              </div>
            </div>

            {/* Visual */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent rounded-3xl blur-3xl" />
              <Card className="relative overflow-hidden border-2 border-border/50 bg-card/80 backdrop-blur-xl">
                <CardContent className="p-0">
                  {/* Terminal Header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
                    <div className="w-3 h-3 rounded-full bg-destructive" />
                    <div className="w-3 h-3 rounded-full bg-warning" />
                    <div className="w-3 h-3 rounded-full bg-success" />
                    <span className="text-xs text-muted-foreground mr-4 font-mono">api-demo.sh</span>
                  </div>
                  
                  <div className="p-6 font-mono text-sm space-y-4" dir="ltr">
                    <div className="text-muted-foreground">
                      <span className="text-primary">$</span> curl /v1/wallet-risk
                    </div>
                    <div className="bg-muted/30 rounded-lg p-4">
                      <pre className="text-xs overflow-x-auto">
{`{
  "risk_score": 82,
  "decision": "HIGH_RISK",
  "flags": [
    "mixer_interaction",
    "rapid_movements"
  ],
  "confidence": 0.94
}`}
                      </pre>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      Response time: 47ms
                      <span className="text-primary">• $0.02</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Products Deep Dive */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              שלושה מוצרים, שלוש בעיות נפתרות
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              כל קריאה = תובנה. אין מינימום. אין התחייבות.
            </p>
          </div>

          {/* Product Tabs */}
          <div className="flex justify-center gap-4 mb-12">
            {PRODUCTS.map((product, i) => (
              <button
                key={i}
                onClick={() => setActiveProduct(i)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full transition-all ${
                  activeProduct === i
                    ? `bg-gradient-to-r ${product.gradient} text-background shadow-lg`
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                <product.icon className="w-5 h-5" />
                <span className="hidden sm:inline">{product.nameHe}</span>
              </button>
            ))}
          </div>

          {/* Active Product */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <Card className="overflow-hidden border-2 border-border/50">
              <CardContent className="p-8">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${PRODUCTS[activeProduct].gradient} p-0.5 mb-6`}>
                  <div className="w-full h-full rounded-2xl bg-card flex items-center justify-center">
                    {(() => {
                      const IconComponent = PRODUCTS[activeProduct].icon;
                      return <IconComponent className="w-8 h-8" />;
                    })()}
                  </div>
                </div>

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-2xl font-bold mb-1">{PRODUCTS[activeProduct].nameHe}</h3>
                    <p className="text-muted-foreground">{PRODUCTS[activeProduct].name}</p>
                  </div>
                  <Badge variant="secondary" className="text-2xl font-bold px-4 py-2">
                    {PRODUCTS[activeProduct].priceDisplay}
                  </Badge>
                </div>

                <p className="text-lg mb-6">{PRODUCTS[activeProduct].longDescription}</p>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  {PRODUCTS[activeProduct].features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      {feature}
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Eye className="w-4 h-4" />
                    מתי להשתמש:
                  </div>
                  <p className="font-medium">{PRODUCTS[activeProduct].useCase}</p>
                </div>
              </CardContent>
            </Card>

            {/* Code Example */}
            <Card className="overflow-hidden border-2 border-border/50 bg-muted/20">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/30">
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">דוגמת קוד</span>
              </div>
              <CardContent className="p-6">
                <pre className="text-sm font-mono overflow-x-auto whitespace-pre-wrap" dir="ltr">
                  {PRODUCTS[activeProduct].apiExample}
                </pre>
                <Button 
                  className="w-full mt-6" 
                  onClick={() => navigate('/purchase')}
                >
                  <Code className="w-4 h-4 ml-2" />
                  נסה עכשיו
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Guardian Upsell */}
      <section className="py-24 bg-gradient-to-br from-primary/5 via-background to-warning/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <div>
              <Badge className="mb-6 bg-primary text-primary-foreground">
                <Shield className="w-4 h-4 ml-1" />
                Guardian Tier
              </Badge>
              <h2 className="text-4xl font-bold mb-6">
                מוצא את אותן בעיות שוב ושוב?
                <br />
                <span className="text-primary">Guardian יתקן אותן.</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                כשהסנסורים מגלים דפוסים בעייתיים חוזרים, Guardian נכנס לפעולה אוטומטית.
                חוסם ארנקים, מתקן Webhooks, מאזן תשלומים. 24/7.
              </p>

              <div className="flex items-baseline gap-3 mb-8">
                <span className="text-5xl font-bold text-primary">$499</span>
                <span className="text-xl text-muted-foreground">/חודש</span>
              </div>

              <Button size="lg" onClick={() => navigate('/purchase')}>
                <Shield className="w-5 h-5 ml-2" />
                הפעל Guardian
              </Button>
            </div>

            {/* Comparison Table */}
            <Card className="overflow-hidden border-2 border-primary/20">
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-right p-4 font-medium">תכונה</th>
                      <th className="text-center p-4 font-medium">חיישנים</th>
                      <th className="text-center p-4 font-medium text-primary">שומר</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-4">{row.feature}</td>
                        <td className="text-center p-4 text-muted-foreground">{row.sensor}</td>
                        <td className="text-center p-4 font-medium text-primary">{row.guardian}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16">שאלות נפוצות</h2>
          
          <div className="space-y-6">
            {FAQ.map((item, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-3">{item.q}</h3>
                  <p className="text-muted-foreground">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            מוכן לגלות מה מתחמק ממך?
          </h2>
          <p className="text-xl text-muted-foreground mb-12">
            שתי דקות להגדרה. תוצאות מיידיות.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-72 h-14 text-lg"
              dir="ltr"
            />
            <Button 
              size="lg" 
              className="h-14 px-8 gap-2"
              onClick={handlePurchase}
              disabled={isLoading}
            >
              <Zap className="w-5 h-5" />
              התחל עכשיו
            </Button>
          </div>

          <div className="flex justify-center gap-8 mt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              תשלום מאובטח
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              הפעלה מיידית
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold">מיקרו חיישנים</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <Link to="/api-docs" className="hover:text-foreground transition-colors">
                תיעוד API
              </Link>
              <Link to="/purchase" className="hover:text-foreground transition-colors">
                תמחור
              </Link>
              <Link to="/landing" className="hover:text-foreground transition-colors">
                דף הבית
              </Link>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2024 Token Forge
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
