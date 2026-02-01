/**
 * Activation Checklist Component
 * רשימת הפעלה - 7 צעדים להפעלת המערכת
 * Mobile-optimized version
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
  Rocket,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

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
  const [isExpanded, setIsExpanded] = useState(false);
  
  const items: ChecklistItem[] = [
    {
      step: 1,
      title: 'Coinbase Commerce API Key',
      titleHe: 'מפתח API קוינבייס',
      description: 'הגדר את COINBASE_COMMERCE_API_KEY',
      link: '/settings',
      isComplete: hasCoinbaseKey,
      icon: <Key className="w-4 h-4 lg:w-5 lg:h-5" />,
    },
    {
      step: 2,
      title: 'Webhook Configuration',
      titleHe: 'הגדרת Webhook',
      description: 'הגדר Webhook ב-Coinbase',
      externalLink: 'https://commerce.coinbase.com/dashboard/settings',
      isComplete: hasCoinbaseWebhook,
      icon: <Webhook className="w-4 h-4 lg:w-5 lg:h-5" />,
    },
    {
      step: 3,
      title: 'Payout Wallet',
      titleHe: 'ארנק יעד',
      description: 'הגדר כתובת ארנק לקבלת משיכות',
      link: '/settings',
      isComplete: hasPayoutWallet,
      icon: <Wallet className="w-4 h-4 lg:w-5 lg:h-5" />,
    },
    {
      step: 4,
      title: 'Telegram Alerts',
      titleHe: 'התראות טלגרם',
      description: 'הגדר BOT_TOKEN ו-CHAT_ID',
      link: '/system',
      isComplete: hasTelegram,
      icon: <Send className="w-4 h-4 lg:w-5 lg:h-5" />,
    },
    {
      step: 5,
      title: 'ZeroDev (Optional)',
      titleHe: 'ZeroDev',
      description: 'הגדר Account Abstraction',
      externalLink: 'https://zerodev.app',
      isComplete: hasZeroDev,
      icon: <Cpu className="w-4 h-4 lg:w-5 lg:h-5" />,
    },
    {
      step: 6,
      title: 'Test Telegram',
      titleHe: 'בדיקת התראות',
      description: 'שלח הודעת בדיקה',
      link: '/system',
      isComplete: hasTestPassed,
      icon: <TestTube className="w-4 h-4 lg:w-5 lg:h-5" />,
    },
    {
      step: 7,
      title: 'First Real Payment',
      titleHe: 'תשלום ראשון',
      description: 'בצע תשלום אמיתי לאימות',
      link: '/purchase',
      isComplete: hasFirstPayment,
      icon: <Rocket className="w-4 h-4 lg:w-5 lg:h-5" />,
    },
  ];

  const completedCount = items.filter(i => i.isComplete).length;
  const progress = Math.round((completedCount / items.length) * 100);
  const incompleteItems = items.filter(i => !i.isComplete);
  const displayItems = isExpanded ? items : incompleteItems.slice(0, 3);

  return (
    <Card className="glass-card">
      <CardHeader className="p-4 lg:p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base lg:text-lg">
              <Rocket className="w-4 h-4 lg:w-5 lg:h-5 text-primary flex-shrink-0" />
              <span className="truncate">Checklist הפעלה</span>
            </CardTitle>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1">
              7 צעדים להפעלת מערכת התשלומים
            </p>
          </div>
          <Badge variant={progress === 100 ? 'default' : 'secondary'} className="flex-shrink-0">
            {completedCount}/{items.length}
          </Badge>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-muted rounded-full h-2 mt-3 lg:mt-4">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
        <div className="space-y-2 lg:space-y-3">
          {displayItems.map((item) => (
            <div 
              key={item.step}
              className={`flex items-center gap-2 lg:gap-4 p-2 lg:p-3 rounded-lg transition-colors ${
                item.isComplete 
                  ? 'bg-success/10 border border-success/20' 
                  : 'bg-muted/30 hover:bg-muted/50'
              }`}
            >
              {/* Status icon */}
              <div className={`w-6 h-6 lg:w-8 lg:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                item.isComplete ? 'bg-success/20' : 'bg-muted'
              }`}>
                {item.isComplete ? (
                  <CheckCircle className="w-4 h-4 lg:w-5 lg:h-5 text-success" />
                ) : (
                  <Circle className="w-4 h-4 lg:w-5 lg:h-5 text-muted-foreground" />
                )}
              </div>

              {/* Content - simplified for mobile */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 lg:gap-2">
                  {item.icon}
                  <span className="font-medium text-sm lg:text-base truncate">{item.titleHe}</span>
                </div>
                <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 truncate hidden sm:block">
                  {item.description}
                </p>
              </div>

              {/* Action - compact on mobile */}
              {!item.isComplete && (
                <>
                  {item.link ? (
                    <Button asChild size="sm" variant="outline" className="h-7 lg:h-9 px-2 lg:px-3 flex-shrink-0">
                      <Link to={item.link}>
                        <ArrowLeft className="w-3 h-3 lg:w-4 lg:h-4 lg:ml-1" />
                        <span className="hidden lg:inline">הגדר</span>
                      </Link>
                    </Button>
                  ) : item.externalLink ? (
                    <Button asChild size="sm" variant="outline" className="h-7 lg:h-9 px-2 lg:px-3 flex-shrink-0">
                      <a href={item.externalLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3 h-3 lg:w-4 lg:h-4 lg:ml-1" />
                        <span className="hidden lg:inline">פתח</span>
                      </a>
                    </Button>
                  ) : null}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Expand/collapse button */}
        {items.length > 3 && (
          <Button 
            variant="ghost" 
            className="w-full mt-3 text-muted-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 ml-2" />
                הצג פחות
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 ml-2" />
                הצג הכל ({items.length - 3} נוספים)
              </>
            )}
          </Button>
        )}

        {progress === 100 && (
          <div className="mt-4 lg:mt-6 p-3 lg:p-4 bg-success/10 rounded-lg border border-success/20 text-center">
            <CheckCircle className="w-6 h-6 lg:w-8 lg:h-8 text-success mx-auto mb-2" />
            <p className="font-semibold text-success text-sm lg:text-base">המערכת מוכנה! 🚀</p>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1">
              כל הצעדים הושלמו
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
