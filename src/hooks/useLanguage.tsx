/**
 * Language Hook - Simple i18n for Landing Pages
 * Supports English (default) and Hebrew
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

export type Language = 'en' | 'he';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

// Translation dictionary
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Hero
    'hero.badge': 'שכבת אבטחה אוטונומית',
    'hero.headline1': 'Discover Issues',
    'hero.headline2': 'Before They Cost You Money',
    'hero.subtitle': 'Smart APIs that detect risky wallets, broken webhooks, and payment discrepancies — for pennies per check',
    'hero.cta': 'Get 10 Free API Calls',
    'hero.trust1': 'Secure Crypto Payments',
    'hero.trust2': 'No Subscriptions - Pay Per Use',
    'hero.trust3': 'Instant Results',
    
    // API Key Modal
    'apikey.title': "Here's Your API Key!",
    'apikey.subtitle': 'Save it - you won\'t see it again',
    'apikey.credits': 'Credits',
    'apikey.validity': 'Validity',
    'apikey.unlimited': '∞',
    
    // Stats
    'stats.calls': 'קריאות API',
    'stats.uptime': 'זמינות',
    'stats.response': 'תגובה',
    'stats.support': 'תמיכה',
    
    // Products
    'products.badge': 'Micro APIs',
    'products.title': 'Three Products, Million Insights',
    'products.subtitle': 'Each call costs cents. Each insight is worth thousands.',
    'products.cta': 'Try Now',
    
    // Product 1 - Wallet Risk
    'product.wallet.name': 'Wallet Risk API',
    'product.wallet.desc': 'Identify risky wallets before they hurt you',
    
    // Product 2 - Webhook
    'product.webhook.name': 'Webhook Health',
    'product.webhook.desc': 'Is your webhook actually working? Check now',
    
    // Product 3 - Payment
    'product.payment.name': 'Payment Drift',
    'product.payment.desc': 'Find the money that got lost between expected and received',
    
    // Use Cases
    'usecases.title': 'When to Use?',
    'usecases.subtitle': 'Three critical moments when a small check prevents a big loss',
    'usecase1.title': 'Before interacting with a new wallet',
    'usecase1.desc': 'Check if the wallet is risky, linked to hacks, or problematic',
    'usecase2.title': 'After setting up a webhook',
    'usecase2.desc': 'Verify messages are arriving and the server responds on time',
    'usecase3.title': 'At the end of each workday',
    'usecase3.desc': 'Check if the money received matches what you expected',
    
    // Testimonials
    'testimonials.badge': 'ביקורות מאומתות',
    'testimonials.title': 'What They Say About Us',
    'testimonials.subtitle': 'Real reviews from Web3 and DeFi teams',
    
    // Guardian Upsell
    'guardian.badge': 'רמת שומר',
    'guardian.title1': 'Finding recurring issues?',
    'guardian.title2': 'Guardian fixes them.',
    'guardian.desc': 'When sensors detect problematic patterns, Guardian takes action — blocks risky wallets, fixes webhooks, and balances payments. Automatically.',
    'guardian.cta': 'Activate Guardian',
    'guardian.alert1.title': 'Alert: 5 risky wallets',
    'guardian.alert1.desc': 'Detected in the last 24 hours',
    'guardian.alert2.title': 'Guardian Acted',
    'guardian.alert2.desc': '5 wallets blocked automatically',
    'guardian.alert3.title': 'Estimated Savings: $12,500',
    'guardian.alert3.desc': 'Loss prevented this month',
    
    // API Section
    'api.badge': 'ידידותי למפתחים',
    'api.title': 'Simple API, Instant Results',
    'api.subtitle': 'One line of code. Response in milliseconds.',
    'api.docs': 'View Full Documentation',
    
    // Final CTA
    'cta.title': 'Ready to discover what\'s slipping by?',
    'cta.subtitle': 'Start with 10 free calls. No credit card required.',
    'cta.button': 'Get Free Access',
    
    // Footer
    'footer.docs': 'API Docs',
    'footer.pricing': 'Pricing',
    'footer.micro': 'Micro APIs',
    'footer.admin': 'ניהול',
    
    // Errors
    'error.email': 'Enter your email to get free access',
    'error.generic': 'Error - Please try again',
    'success.trial': 'Congratulations! You got 10 free API calls 🎉',
    'success.copied': 'Copied!',
  },
  he: {
    // Hero
    'hero.badge': 'שכבת אבטחה אוטונומית',
    'hero.headline1': 'גלה בעיות',
    'hero.headline2': 'לפני שהן עולות לך כסף',
    'hero.subtitle': 'API-ים חכמים שמזהים ארנקים מסוכנים, Webhooks תקולים, ופערים בתשלומים — בסנטים בודדים לבדיקה',
    'hero.cta': 'קבל 10 קריאות בחינם',
    'hero.trust1': 'תשלום מאובטח בקריפטו',
    'hero.trust2': 'בלי מנויים - שלם לפי שימוש',
    'hero.trust3': 'תוצאות מיידיות',
    
    // API Key Modal
    'apikey.title': 'הנה ה-API Key שלך!',
    'apikey.subtitle': 'שמור אותו - לא תראה אותו שוב',
    'apikey.credits': 'קרדיטים',
    'apikey.validity': 'תוקף',
    'apikey.unlimited': '∞',
    
    // Stats
    'stats.calls': 'קריאות API',
    'stats.uptime': 'זמינות',
    'stats.response': 'תגובה',
    'stats.support': 'תמיכה',
    
    // Products
    'products.badge': 'Micro APIs',
    'products.title': 'שלושה מוצרים, מיליון תובנות',
    'products.subtitle': 'כל קריאה עולה סנטים. כל תובנה שווה אלפים.',
    'products.cta': 'נסה עכשיו',
    
    // Product 1 - Wallet Risk
    'product.wallet.name': 'בדיקת סיכון ארנק',
    'product.wallet.desc': 'זהה ארנקים מסוכנים לפני שהם פוגעים בך',
    
    // Product 2 - Webhook
    'product.webhook.name': 'בריאות Webhook',
    'product.webhook.desc': 'האם ה-Webhook שלך באמת עובד? בדוק עכשיו',
    
    // Product 3 - Payment
    'product.payment.name': 'גלאי פער תשלומים',
    'product.payment.desc': 'מצא כסף שהלך לאיבוד בין מה שציפית למה שקיבלת',
    
    // Use Cases
    'usecases.title': 'מתי להשתמש?',
    'usecases.subtitle': 'שלושה רגעים קריטיים שבהם בדיקה קטנה חוסכת הפסד גדול',
    'usecase1.title': 'לפני אינטראקציה עם ארנק חדש',
    'usecase1.desc': 'בדוק אם הארנק מסוכן, קשור להאקים, או בעייתי',
    'usecase2.title': 'אחרי הגדרת Webhook',
    'usecase2.desc': 'וודא שההודעות מגיעות ושהשרת עונה בזמן',
    'usecase3.title': 'בסוף כל יום עבודה',
    'usecase3.desc': 'בדוק אם הכסף שהגיע תואם למה שציפית',
    
    // Testimonials
    'testimonials.badge': 'ביקורות מאומתות',
    'testimonials.title': 'מה אומרים עלינו',
    'testimonials.subtitle': 'ביקורות אמיתיות מצוותי Web3 ו-DeFi',
    
    // Guardian Upsell
    'guardian.badge': 'רמת שומר',
    'guardian.title1': 'מוצא בעיות חוזרות?',
    'guardian.title2': 'Guardian מתקן אותן.',
    'guardian.desc': 'כשהסנסורים מזהים דפוסים בעייתיים, Guardian נכנס לפעולה — חוסם ארנקים מסוכנים, מתקן Webhooks, ומאזן תשלומים. אוטומטית.',
    'guardian.cta': 'הפעל Guardian',
    'guardian.alert1.title': 'התראה: 5 ארנקים מסוכנים',
    'guardian.alert1.desc': 'זוהו ב-24 שעות אחרונות',
    'guardian.alert2.title': 'Guardian פעל',
    'guardian.alert2.desc': '5 ארנקים נחסמו אוטומטית',
    'guardian.alert3.title': 'חסכון משוער: $12,500',
    'guardian.alert3.desc': 'הפסד שנמנע החודש',
    
    // API Section
    'api.badge': 'ידידותי למפתחים',
    'api.title': 'API פשוט, תוצאות מיידיות',
    'api.subtitle': 'קו אחד של קוד. תשובה תוך מילישניות.',
    'api.docs': 'צפה בתיעוד המלא',
    
    // Final CTA
    'cta.title': 'מוכן לגלות מה מתחמק ממך?',
    'cta.subtitle': 'התחל עם 10 קריאות בחינם. בלי כרטיס אשראי.',
    'cta.button': 'קבל גישה חינם',
    
    // Footer
    'footer.docs': 'תיעוד API',
    'footer.pricing': 'תמחור',
    'footer.micro': 'Micro APIs',
    'footer.admin': 'ניהול',
    
    // Errors
    'error.email': 'הזן אימייל כדי לקבל גישה חינם',
    'error.generic': 'שגיאה - נסה שוב',
    'success.trial': 'מזל טוב! קיבלת 10 קריאות API בחינם 🎉',
    'success.copied': 'הועתק!',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    // Check localStorage first
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('preferred_lang');
      if (saved === 'en' || saved === 'he') return saved;
    }
    // Default to English
    return 'en';
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('preferred_lang', newLang);
  };

  const t = (key: string): string => {
    return translations[lang][key] || key;
  };

  const isRTL = lang === 'he';

  useEffect(() => {
    // Update document direction
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isRTL]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

// Language Switcher Component
export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
      className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 hover:bg-card transition-colors text-sm font-medium"
    >
      {lang === 'en' ? (
        <>
          <span>🇮🇱</span>
          <span>עברית</span>
        </>
      ) : (
        <>
          <span>🇺🇸</span>
          <span>English</span>
        </>
      )}
    </button>
  );
}
