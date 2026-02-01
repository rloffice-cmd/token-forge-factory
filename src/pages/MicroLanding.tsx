import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertTriangle
} from 'lucide-react';

export default function MicroLanding() {
  const [email, setEmail] = useState('');

  const products = [
    {
      id: 'wallet-risk',
      name: 'Wallet Risk Ping',
      nameHe: 'בדיקת סיכון ארנק',
      price: '$0.02',
      description: 'בדיקה מהירה: האם הארנק הזה מסוכן?',
      icon: Wallet,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      features: ['תשובה תוך מילישניות', 'Score + Flags', 'בלי התחייבות'],
    },
    {
      id: 'webhook-check',
      name: 'Webhook Health Check',
      nameHe: 'בדיקת תקינות Webhook',
      price: '$0.25',
      description: 'בדוק אם ה-Webhook שלך באמת עובד',
      icon: Webhook,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      features: ['בדיקת זמינות', 'מדידת Response Time', 'אין Retry - רק אבחון'],
    },
    {
      id: 'payment-drift',
      name: 'Payment Drift Detector',
      nameHe: 'גלאי פער בתשלומים',
      price: '$2.00',
      description: 'זיהוי פער בין תשלומים צפויים לכסף שהגיע',
      icon: DollarSign,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      features: ['Snapshot מיידי', 'אחוז סטייה', 'בלי תיקון - רק גילוי'],
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-orange-500/5" />
        <div className="relative max-w-7xl mx-auto px-6 py-24">
          <div className="text-center space-y-6">
            <Badge variant="outline" className="text-lg px-4 py-2">
              <Zap className="h-4 w-4 ml-2 text-yellow-500" />
              Micro Products - Sensor Layer
            </Badge>
            
            <h1 className="text-5xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
              גלה בעיות לפני שהן גולשות
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              מוצרי אבחון זולים במיוחד (סנטים-דולרים).
              <br />
              לא מתקנים. לא מבטיחים. רק מראים לך את האמת.
            </p>

            <div className="flex items-center justify-center gap-4 pt-4">
              <Link to="/purchase">
                <Button size="lg" className="gap-2">
                  <Code className="h-5 w-5" />
                  קבל מפתח API
                </Button>
              </Link>
              <Link to="/api-docs">
                <Button variant="outline" size="lg" className="gap-2">
                  קרא תיעוד
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">שלושה מוצרי סנסור</h2>
          <p className="text-muted-foreground">
            כל קריאה = תובנה. אין מינימום. אין התחייבות.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="relative overflow-hidden hover:shadow-lg transition-shadow">
              <div className={`absolute top-0 left-0 right-0 h-1 ${product.bgColor.replace('/10', '')}`} />
              <CardHeader>
                <div className={`w-12 h-12 rounded-lg ${product.bgColor} flex items-center justify-center mb-4`}>
                  <product.icon className={`h-6 w-6 ${product.color}`} />
                </div>
                <CardTitle className="flex items-center justify-between">
                  <span>{product.nameHe}</span>
                  <Badge variant="secondary" className="text-lg font-bold">
                    {product.price}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-base">
                  {product.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {product.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-muted/30 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">איך זה עובד?</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: 1, title: 'רכוש קרדיטים', desc: 'תשלום קריפטו מהיר', icon: Lock },
              { step: 2, title: 'קבל מפתח API', desc: 'מיידי לאחר תשלום', icon: Code },
              { step: 3, title: 'בצע בדיקות', desc: 'כל קריאה = סנטים', icon: Zap },
              { step: 4, title: 'גלה בעיות', desc: 'ותקבל פתרון אוטומטי', icon: Shield },
            ].map((item) => (
              <div key={item.step} className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <item.icon className="h-8 w-8 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary">{item.step}</div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Guardian Upsell Section */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <Card className="bg-gradient-to-r from-primary/5 to-orange-500/5 border-2 border-primary/20">
          <CardContent className="p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <Badge className="bg-primary text-primary-foreground">
                  <Shield className="h-4 w-4 ml-1" />
                  Guardian Tier
                </Badge>
                <h2 className="text-3xl font-bold">
                  זיהינו בעיה?
                  <br />
                  <span className="text-primary">Guardian מתקן אותה.</span>
                </h2>
                <p className="text-muted-foreground">
                  כשהמוצרים הזולים מגלים בעיות חוזרות, המערכת מציעה לך שדרוג אוטומטי ל-Guardian - 
                  פתרון אוטונומי מלא שמתקן ומגן עליך 24/7.
                </p>
                <div className="flex items-center gap-4 pt-4">
                  <div className="text-4xl font-bold text-primary">$499</div>
                  <div className="text-muted-foreground">/חודש</div>
                </div>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    תיקון אוטומטי של Webhooks
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    חסימת ארנקים מסוכנים
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Reconciliation אוטומטי
                  </li>
                </ul>
              </div>
              <div className="bg-card rounded-lg p-6 border">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="h-6 w-6 text-orange-500 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="font-semibold">דוגמה להצעה אוטומטית:</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      "זיהינו 3 בדיקות ארנק עם סיכון גבוה ב-24 שעות אחרונות.
                      הפסד משוער: <span className="text-orange-500 font-bold">$3,000/חודש</span>.
                      Guardian מונע את זה אוטונומית."
                    </p>
                  </div>
                </div>
                <Button className="w-full gap-2">
                  <Shield className="h-4 w-4" />
                  הפעל Guardian עכשיו
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rate Limit Notice */}
      <div className="bg-muted/30 py-8">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            <Lock className="inline h-4 w-4 ml-1" />
            תקרת שימוש יומית: $20 למשתמש. אין Free Tier. 
            אפילו $0.01 חשוב - מסנן רעש ומוכיח Intent.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Micro Stack v0 - Sensor Layer
          </p>
          <div className="flex gap-4">
            <Link to="/api-docs" className="text-sm text-muted-foreground hover:text-foreground">
              תיעוד API
            </Link>
            <Link to="/purchase" className="text-sm text-muted-foreground hover:text-foreground">
              רכישת קרדיטים
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
