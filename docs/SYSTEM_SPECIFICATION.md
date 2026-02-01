# 📋 איפיון מערכת Token Forge - Money Machine
## מסמך בקרה חיצונית | גרסה 1.0 | 1 בפברואר 2026

---

## 🎯 תקציר מנהלים

**Token Forge** היא מערכת אוטונומית לייצור הכנסות מ-API-י אבטחה לעולם ה-Web3/Blockchain. המערכת פועלת במודל **"Zero Touch"** - ללא צורך במגע אנושי לביצוע מכירות, אספקה או תמיכה.

### מצב נוכחי (1/2/2026)
| מדד | ערך | הערה |
|-----|-----|------|
| **הכנסות כוללות** | $29 | עסקת בדיקה בלבד |
| **עסקאות אמיתיות** | 0 | טרם בוצעה עסקה אמיתית |
| **לידים שנאספו** | 37 | 34 נפגשו בפנייה |
| **סיגנלים שזוהו** | 63 | 29 עובדו להזדמנויות |
| **הודעות Outreach** | 14 | נשלחו בהצלחה |
| **מקורות סריקה** | 27 | כולם פעילים (health=1.0) |
| **Edge Functions** | 53 | פועלות 24/7 |

---

## 🏗️ ארכיטקטורת המערכת

### שכבות המערכת

```
┌─────────────────────────────────────────────────────────────┐
│                    🎨 FRONTEND LAYER                        │
│  Landing Pages | Dashboard | Customer Portal | API Docs    │
├─────────────────────────────────────────────────────────────┤
│                    🧠 BRAIN LAYER                           │
│  Brain Scanner | Scorer | Closer | Fulfill | Outreach      │
├─────────────────────────────────────────────────────────────┤
│                    📡 SIGNAL LAYER                          │
│  Demand Scanner | Intent Scanner | Opportunity Scorer      │
├─────────────────────────────────────────────────────────────┤
│                    💰 TRANSACTION LAYER                     │
│  Coinbase Webhook | Fulfillment | Credit System            │
├─────────────────────────────────────────────────────────────┤
│                    🔐 TREASURY LAYER                        │
│  Safe Wallet | Daily Sweep | Cashout Requests              │
├─────────────────────────────────────────────────────────────┤
│                    📊 INTELLIGENCE LAYER                    │
│  Self-Improvement | Expansion Engine | Marketing AI        │
└─────────────────────────────────────────────────────────────┘
```

### רשת ותשתית
| רכיב | פרטים |
|------|-------|
| **Blockchain** | Base (Ethereum L2) |
| **Backend** | Supabase + Lovable Cloud |
| **Database** | PostgreSQL |
| **Edge Functions** | Deno Runtime |
| **Safe Wallet** | `0xA3A10bf24FE60f1733CC77E6D00763E9C12a9d0C` |
| **Payout Wallet** | `0x7CA4D6216CC1674E4c9dD86167cF828a22F04eAc` |
| **Payment Gateway** | Coinbase Commerce |

---

## 📦 קטלוג מוצרים ושירותים

### 🔬 מוצרי Micro (Pay-per-Use)

| מוצר | מחיר | תיאור | Endpoint |
|------|------|-------|----------|
| **Wallet Risk Ping** | $0.02 | בדיקת סיכון ארנק | `/micro-wallet-risk` |
| **Webhook Health Check** | $0.25 | בדיקת תקינות Webhook | `/micro-webhook-check` |
| **Payment Drift Detector** | $2.00 | זיהוי פערי תשלומים | `/micro-payment-drift` |

### 📦 חבילות קרדיטים

| חבילה | קרדיטים | מחיר | מחיר/קרדיט |
|-------|---------|------|-----------|
| **Starter** | 100 | $29 | $0.29 |
| **Pro** ⭐ | 500 | $99 | $0.20 |
| **Business** | 2,000 | $299 | $0.15 |
| **Enterprise** | 10,000 | $999 | $0.10 |
| **Security Audit** | 50 | $199 | $3.98 |
| **Monitoring** | 500 | $149 | $0.30 |

### 🛡️ שירותי Premium

| שירות | מחיר | תיאור | סוג אספקה |
|-------|------|-------|-----------|
| **On-chain Risk API** | מ-$5 | API לבדיקת סיכון ארנקים/חוזים | API Key |
| **Webhook Monitor** | מ-$9 | ניטור ו-Replay של Webhooks | Webhook URL |
| **Monitoring Dashboard** | $75+ | דשבורד ניטור בזמן אמת | API Key |
| **Security Audit** | $100+ | דוח ביקורת אבטחה | Manual |
| **Enterprise Suite** | $500+ | חבילה ארגונית מלאה | API Key |
| **Guardian Tier** | $499/חודש | הגנה אוטונומית 24/7 | Subscription |

---

## ⚙️ 53 Edge Functions

### 🧠 Brain Functions (Core Logic)
| פונקציה | תפקיד | תדירות |
|---------|-------|--------|
| `brain-scan` | סריקת מקורות ואיתור סיגנלים | כל 10 דקות |
| `brain-score` | ניקוד וסינון הזדמנויות | כל 10 דקות |
| `brain-close` | יצירת Checkout links | כל 10 דקות |
| `brain-fulfill` | אספקה אוטומטית לאחר תשלום | כל דקה |
| `brain-discover-sources` | גילוי מקורות סריקה חדשים | כל 6 שעות |
| `brain-daily-metrics` | חישוב מטריקות יומיות | פעם ביום |

### 📡 Signal & Demand Functions
| פונקציה | תפקיד |
|---------|-------|
| `demand-scanner` | סריקת ביקוש מ-RSS/API |
| `ai-intent-scanner` | ניתוח כוונות רכישה |
| `opportunity-scorer` | ניקוד הזדמנויות |

### 💬 Outreach Functions
| פונקציה | תפקיד |
|---------|-------|
| `ai-outreach` | יצירת הודעות מותאמות |
| `outreach-queue` | ניהול תור פניות |
| `outreach-sender` | שליחת הודעות |
| `outreach-retry-worker` | ניסיון חוזר לכשלונות |
| `follow-up-engine` | מעקב אוטומטי |
| `auto-closer` | סגירת עסקאות |

### 💰 Transaction Functions
| פונקציה | תפקיד |
|---------|-------|
| `coinbase-webhook` | קבלת התראות תשלום |
| `create-coinbase-checkout` | יצירת עמוד תשלום |
| `fulfillment-provisioner` | הקצאת שירותים |
| `provision-api-key` | יצירת מפתחות API |

### 🏦 Treasury Functions
| פונקציה | תפקיד |
|---------|-------|
| `daily-sweep` | העברת יתרות יומית |
| `create-withdrawal-request` | יצירת בקשת משיכה |
| `confirm-payout` | אישור משיכה |
| `safe-tx-tracker` | מעקב עסקאות Safe |

### 🔬 Micro API Functions
| פונקציה | תפקיד |
|---------|-------|
| `micro-wallet-risk` | בדיקת סיכון ארנק |
| `micro-webhook-check` | בדיקת Webhook |
| `micro-payment-drift` | זיהוי פערי תשלומים |
| `micro-brain-evaluate` | הערכת Upsell לGuardian |
| `micro-dashboard-value` | חישוב ערך דשבורד |
| `guardian-offer` | יצירת הצעת Guardian |

### 🤖 AI & Content Functions
| פונקציה | תפקיד |
|---------|-------|
| `ai-content-engine` | יצירת תוכן שיווקי |
| `ai-job-processor` | עיבוד משימות AI |
| `marketing-optimizer` | אופטימיזציה שיווקית |
| `landing-ab-test` | ניסויי A/B |

### 📊 Intelligence Functions
| פונקציה | תפקיד |
|---------|-------|
| `self-improvement` | שיפור עצמי |
| `expansion-engine` | גילוי שירותים חדשים |
| `dynamic-pricing` | תמחור דינמי |

### 🔔 Notification Functions
| פונקציה | תפקיד |
|---------|-------|
| `telegram-notify` | שליחת התראות טלגרם |
| `send-test-telegram` | בדיקת טלגרם |
| `daily-report` | דו"ח יומי |
| `daily-signal-report` | דו"ח סיגנלים |

### 🌐 Public API Functions
| פונקציה | תפקיד |
|---------|-------|
| `public-api` | API ציבורי ללקוחות |
| `signal-wallet` | בדיקת סיכון ארנק |
| `signal-contract` | בדיקת סיכון חוזה |
| `ingest-webhook` | קבלת נתונים חיצוניים |

### 🔧 Utility Functions
| פונקציה | תפקיד |
|---------|-------|
| `auto-pipeline` | תזמור Pipeline |
| `system-health` | בדיקת תקינות מערכת |
| `revenue-report` | דו"ח הכנסות |
| `sandbox-runner` | הרצת קוד מבודד |
| `distribution-orchestrator` | תזמור הפצה |

---

## 📊 27 מקורות סריקה פעילים

### RSS Feeds (11)
| מקור | סוג | תדירות סריקה |
|------|-----|--------------|
| Hacker News - Show HN | RSS | כל שעה |
| Hacker News - Newest | RSS | כל שעה |
| Reddit r/cryptocurrency | RSS | כל 30 דקות |
| Reddit r/ethdev | RSS | כל 30 דקות |
| Reddit r/solidity | RSS | כל 30 דקות |
| Reddit r/cryptodevs | RSS | כל 30 דקות |
| Reddit r/webdev | RSS | כל 30 דקות |
| Reddit r/SaaS | RSS | כל 30 דקות |
| Dev.to - Webhooks | RSS | כל שעה |
| Dev.to - Blockchain | RSS | כל שעה |
| Dev.to - Security | RSS | כל שעה |

### API Sources (8)
| מקור | סוג | תדירות סריקה |
|------|-----|--------------|
| Stack Overflow - Smart Contracts | API | כל 30 דקות |
| Stack Overflow - Web3 | API | כל 30 דקות |
| GitHub - Trending Blockchain | API | כל שעה |
| GitHub - Web3 Security Discussions | API | כל שעה |
| Crypto Twitter Signals | API | כל שעה |
| Twitter - Web3 Security | API | כל שעה |
| Product Hunt - Dev Tools | RSS | כל שעה |
| Indie Hackers - Products | RSS | כל שעה |

### GitHub Issue Searches (6)
| מקור | חיפוש |
|------|-------|
| Webhook Retry Issues | `webhook retry failed` |
| Signature Invalid Issues | `signature invalid verification` |
| Malicious Contract Issues | `malicious contract wallet` |
| Coinbase Webhook Issues | `coinbase webhook` |
| Replay Webhook Issues | `replay webhook events` |
| Wallet Risk Issues | `wallet risk score` |

**סטטוס בריאות**: 100% מהמקורות עם `health_score = 1.0`

---

## 🔄 לוח זמני אוטומציה (Cron Schedule)

### כל דקה
- `auto-pipeline` - Pipeline ראשי
- `brain-fulfill` - אספקה אוטומטית
- `safe-tx-tracker` - מעקב עסקאות

### כל 10 דקות
- `brain-scan` - סריקת מקורות
- `brain-score` - ניקוד הזדמנויות
- `brain-close` - סגירת עסקאות

### כל 15 דקות
- `outreach-sender` - שליחת פניות
- `opportunity-scorer` - ניקוד

### כל 30 דקות
- `demand-scanner` - סריקת ביקוש

### כל שעה
- `lead-hunter` - ציד לידים
- `auto-closer` - סגירה אוטומטית
- `ai-intent-scanner` - ניתוח כוונות

### כל שעתיים
- `distribution-orchestrator` - הפצה

### 3 פעמים ביום (08:00, 14:00, 20:00)
- `ai-content-engine` - יצירת תוכן

### כל 6 שעות
- `brain-discover-sources` - גילוי מקורות

### פעם ביום (07:00 ישראל)
- `daily-report` - דו"ח יומי
- `daily-sweep` - העברת יתרות
- `self-improvement` - שיפור עצמי
- `expansion-engine` - הרחבה

---

## 📈 ניתוח ביצועים ותחזית

### מטריקות משפך (Funnel Metrics)

```
סיגנלים (63) → הזדמנויות (29) → לידים (37) → פניות (14) → Checkouts (248) → תשלומים (1)
    ↓              ↓               ↓            ↓              ↓              ↓
  100%           46%             59%          38%            ∞%            0.4%
```

### זיהוי צווארי בקבוק (AI Analysis)

1. **Checkout → Payment (0.4%)**
   - 248 Checkouts נוצרו, רק 1 הושלם (ובדיקה)
   - **סיבות אפשריות**: חיכוך בתהליך התשלום, חוסר אמון, תמחור

2. **Outreach → Checkout (0%)**
   - 14 פניות נשלחו, 0 הובילו ל-Checkout ישיר
   - **סיבות אפשריות**: מסרים לא ממירים, ערוץ לא נכון

### המלצות AI לשיפור

#### עדיפות גבוהה
1. **Secret Shopper** - בדיקת תהליך התשלום מקצה לקצה
2. **Free Trial** - הוספת אפשרות לניסיון ללא תשלום
3. **שינוי CTA** - מ"Buy Now" ל-"Get API Key"
4. **Web3 Payments** - הוספת תשלום ישיר ב-ETH/USDC

#### עדיפות בינונית
1. **Social Proof** - הוספת עדויות לקוחות
2. **Security Badges** - תגי אמון בעמוד התשלום
3. **Bundle Pricing** - אריזת $0.02 לקריאה ל-$29 Starter

### תחזית

| תרחיש | עסקאות/חודש | הכנסה/חודש | סבירות |
|-------|-------------|------------|---------|
| **פסימי** | 0-2 | $0-60 | 40% |
| **מציאותי** | 5-10 | $150-300 | 35% |
| **אופטימי** | 20-50 | $600-1,500 | 20% |
| **אידיאלי** | 100+ | $3,000+ | 5% |

**יעד**: $10,000/חודש = ~340 עסקאות Starter או 100 Pro

---

## 🔐 אבטחה ובקרות

### Kill Switches
| מתג | מצב | תפקיד |
|-----|-----|-------|
| `brain_enabled` | ✅ ON | הפעלת/כיבוי כללי |
| `emergency_stop` | ❌ OFF | עצירת חירום |
| `scan_enabled` | ✅ ON | סריקת מקורות |
| `outreach_enabled` | ✅ ON | פניות אוטומטיות |
| `auto_closing_enabled` | ✅ ON | סגירת עסקאות |
| `fulfillment_enabled` | ✅ ON | אספקה אוטומטית |

### מגבלות בטיחות
| פרמטר | ערך |
|--------|-----|
| `max_daily_outreach` | 20 הודעות |
| `max_daily_txs` | 20 עסקאות |
| `max_daily_value_usd` | $200 |
| `max_value_per_tx_usd` | $50 |
| `auto_approve_threshold` | 0.5 |
| `min_opportunity_value_usd` | $20 |

### אימות והרשאות
- **Admin API Token** - נדרש לכל פעולה רגישה
- **Webhook Signature** - אימות Coinbase Commerce
- **API Key Hashing** - SHA-256 + Pepper
- **RLS Policies** - הגבלת גישה ברמת שורה
- **Service Role Only** - טבלאות רגישות

---

## 🗄️ סכמת מסד הנתונים

### טבלאות עיקריות (40+)

| טבלה | רשומות | תפקיד |
|------|--------|-------|
| `brain_settings` | 1 | הגדרות מוח |
| `brain_metrics_daily` | 1 | מטריקות יומיות |
| `payments` | 3 | תשלומים |
| `leads` | 37 | לידים |
| `opportunities` | 29 | הזדמנויות |
| `demand_signals` | 63 | סיגנלים |
| `outreach_jobs` | 14 | פניות |
| `offer_sources` | 27+ | מקורות סריקה |
| `offers` | 5 | הצעות מוצרים |
| `credit_packs` | 6 | חבילות קרדיטים |
| `credit_wallets` | 2 | ארנקי לקוחות |
| `api_keys` | 2 | מפתחות API |
| `closing_attempts` | 248 | ניסיונות סגירה |
| `fulfillment_jobs` | 1 | עבודות אספקה |
| `content_queue` | 14 | תוכן שיווקי |
| `audit_logs` | 2,300+ | יומן ביקורת |

---

## 📱 נתיבי האפליקציה

| נתיב | תפקיד | גישה |
|------|-------|------|
| `/brain` | דשבורד המוח | Admin |
| `/sources` | ניהול מקורות | Admin |
| `/treasury` | ניהול קופה | Admin |
| `/intelligence` | סיגנלים והזדמנויות | Admin |
| `/discovery` | גילוי שירותים | Admin |
| `/system` | סטטוס מערכת | Admin |
| `/admin/security` | אבטחה | Admin |
| `/admin/api-keys` | מפתחות API | Admin |
| `/landing` | דף נחיתה ראשי | Public |
| `/micro` | דף Micro APIs | Public |
| `/micro/admin` | ניהול Micro | Admin |
| `/api-docs` | תיעוד API | Public |
| `/purchase` | רכישה | Public |
| `/api` | פורטל לקוחות | Authenticated |

---

## 🚀 פעולות נדרשות (Next Steps)

### מיידי (השבוע)
1. [ ] ביצוע Secret Shopper לתהליך התשלום
2. [ ] בדיקת לוגים ב-Coinbase Commerce
3. [ ] הוספת Free Tier/Sandbox
4. [ ] שינוי CTAs בדפי הנחיתה

### קצר טווח (חודש)
1. [ ] קמפיין Outreach ידני ל-50 פרויקטי DeFi
2. [ ] הוספת תשלום ישיר בקריפטו
3. [ ] יצירת Case Studies/Social Proof
4. [ ] השקת A/B Tests

### ארוך טווח (רבעון)
1. [ ] הרחבת קטלוג מוצרים
2. [ ] אינטגרציות עם פלטפורמות נוספות
3. [ ] Guardian Tier לסגירות גדולות
4. [ ] תוכנית שותפים (Affiliates)

---

## 📞 קישורים וגישה

| משאב | כתובת |
|------|-------|
| **Preview** | https://id-preview--c789e62a-6c80-4817-af6a-864347682163.lovable.app |
| **Landing Page** | `/landing` |
| **Micro Landing** | `/micro` |
| **API Docs** | `/api-docs` |
| **Brain Dashboard** | `/brain` |
| **Treasury** | `/treasury` |
| **Supabase Project** | `flsdahpijdvkohwiinqm` |

---

## 📋 סיכום סטטוס

| קטגוריה | סטטוס | פירוט |
|---------|-------|-------|
| **תשתית** | ✅ פעילה | 53 Edge Functions, 27 מקורות |
| **סריקה** | ✅ פעילה | 63 סיגנלים, 100% health |
| **Outreach** | ✅ פעילה | 14 הודעות נשלחו |
| **המרות** | ⚠️ בעיה | 0.4% checkout→payment |
| **הכנסות** | ❌ אפס | $29 בדיקה בלבד |
| **אבטחה** | ✅ תקינה | RLS, Admin Token, Hashing |

---

*מסמך זה נוצר אוטומטית ב-1 בפברואר 2026 ומשקף את מצב המערכת נכון לרגע זה.*
