/**
 * Activation Checklist Component
 * רשימת הפעלה - 7 צעדים להפעלת המערכת
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  Circle, 
  ExternalLink,
  ArrowLeft,
  Key,
  Webhook,
  Wallet,
  Send,
  Cpu,
  TestTube,
  Rocket
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ChecklistItem {
  step: number;
  title: string;
  titleHe: string;
  description: string;
  link?: string;
  externalLink?: string;
  isComplete: boolean;
  icon: React.ReactNode;
}

interface ActivationChecklistProps {
  // Props for dynamic status checking
  hasCoinbaseKey?: boolean;
  hasCoinbaseWebhook?: boolean;
  hasPayoutWallet?: boolean;
  hasTelegram?: boolean;
  hasZeroDev?: boolean;
  hasTestPassed?: boolean;
  hasFirstPayment?: boolean;
}

export function ActivationChecklist({
  hasCoinbaseKey = true, // Assume configured since we have the secret
  hasCoinbaseWebhook = true,
  hasPayoutWallet = false,
  hasTelegram = true,
  hasZeroDev = false,
  hasTestPassed = false,
  hasFirstPayment = false,
}: ActivationChecklistProps) {
  
  const items: ChecklistItem[] = [
    {
      step: 1,
      title: 'Coinbase Commerce API Key',
      titleHe: 'מפתח API של קוינבייס קומרס',
      description: 'הגדר את COINBASE_COMMERCE_API_KEY בסודות',
      link: '/settings',
      isComplete: hasCoinbaseKey,
      icon: <Key className="w-5 h-5" />,
    },
    {
      step: 2,
      title: 'Webhook Configuration',
      titleHe: 'הגדרת Webhook (ווב-הוק)',
      description: 'הגדר את Webhook URL ב-Coinbase Commerce Dashboard',
      externalLink: 'https://commerce.coinbase.com/dashboard/settings',
      isComplete: hasCoinbaseWebhook,
      icon: <Webhook className="w-5 h-5" />,
    },
    {
      step: 3,
      title: 'Payout Wallet',
      titleHe: 'ארנק יעד למשיכות',
      description: 'הגדר כתובת ארנק EOA לקבלת משיכות',
      link: '/settings',
      isComplete: hasPayoutWallet,
      icon: <Wallet className="w-5 h-5" />,
    },
    {
      step: 4,
      title: 'Telegram Alerts',
      titleHe: 'התראות טלגרם',
      description: 'הגדר TELEGRAM_BOT_TOKEN ו-TELEGRAM_CHAT_ID',
      link: '/system',
      isComplete: hasTelegram,
      icon: <Send className="w-5 h-5" />,
    },
    {
      step: 5,
      title: 'ZeroDev (Optional)',
      titleHe: 'ZeroDev - אופציונלי',
      description: 'הגדר ZERODEV_PROJECT_ID להפעלת Account Abstraction',
      externalLink: 'https://zerodev.app',
      isComplete: hasZeroDev,
      icon: <Cpu className="w-5 h-5" />,
    },
    {
      step: 6,
      title: 'Test Telegram',
      titleHe: 'בדיקת התראות',
      description: 'שלח הודעת בדיקה לאימות האינטגרציה',
      link: '/system',
      isComplete: hasTestPassed,
      icon: <TestTube className="w-5 h-5" />,
    },
    {
      step: 7,
      title: 'First Real Payment',
      titleHe: 'תשלום אמיתי ראשון',
      description: 'בצע תשלום אמיתי לאימות הזרימה המלאה',
      link: '/purchase',
      isComplete: hasFirstPayment,
      icon: <Rocket className="w-5 h-5" />,
    },
  ];

  const completedCount = items.filter(i => i.isComplete).length;
  const progress = Math.round((completedCount / items.length) * 100);

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              Checklist הפעלה
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              7 צעדים להפעלת מערכת התשלומים
            </p>
          </div>
          <Badge variant={progress === 100 ? 'default' : 'secondary'}>
            {completedCount}/{items.length} הושלמו
          </Badge>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 mt-4">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item) => (
            <div 
              key={item.step}
              className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                item.isComplete 
                  ? 'bg-success/10 border border-success/20' 
                  : 'bg-muted/30 hover:bg-muted/50'
              }`}
            >
              {/* Status icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                item.isComplete ? 'bg-success/20' : 'bg-muted'
              }`}>
                {item.isComplete ? (
                  <CheckCircle className="w-5 h-5 text-success" />
                ) : (
                  <Circle className="w-5 h-5 text-muted-foreground" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {item.icon}
                  <span className="font-medium">{item.titleHe}</span>
                  <span className="text-xs text-muted-foreground">({item.title})</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {item.description}
                </p>
              </div>

              {/* Action */}
              {!item.isComplete && (
                <>
                  {item.link ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to={item.link}>
                        <ArrowLeft className="w-4 h-4 ml-1" />
                        הגדר
                      </Link>
                    </Button>
                  ) : item.externalLink ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={item.externalLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 ml-1" />
                        פתח
                      </a>
                    </Button>
                  ) : null}
                </>
              )}

              {/* Step number */}
              <div className="text-xs text-muted-foreground">
                #{item.step}
              </div>
            </div>
          ))}
        </div>

        {progress === 100 && (
          <div className="mt-6 p-4 bg-success/10 rounded-lg border border-success/20 text-center">
            <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
            <p className="font-semibold text-success">המערכת מוכנה לפעולה! 🚀</p>
            <p className="text-sm text-muted-foreground mt-1">
              כל הצעדים הושלמו - אתה מוכן לקבל תשלומים אמיתיים
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
