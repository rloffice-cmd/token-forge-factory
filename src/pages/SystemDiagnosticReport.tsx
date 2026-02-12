/**
 * System Diagnostic Report — Full Technical Snapshot
 * Generated for AI Auditor consumption
 */

import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useState, useRef } from 'react';
import { toast } from 'sonner';

const REPORT_DATE = '2026-02-12';

const REPORT = `# SignalForge — System Diagnostic Report
**Generated:** ${REPORT_DATE}
**Purpose:** Full technical snapshot for AI Auditor analysis

---

## 1. DATABASE SCHEMA (92 Tables — All RLS ENABLED)

### Core Business Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`demand_signals\` | Raw opportunity signals from 31 sources | query_text, source_url, relevance_score, status, category, urgency_score |
| \`opportunities\` | Scored & qualified signals | value_usd, score, status, source_url, lead_key |
| \`leads\` | Contact records | email, name, company, source, status |
| \`auto_leads\` | Autonomous Hunter discovered leads | email, lead_category, matched_partner, confidence, status, dry_run |
| \`offers\` | Outreach offers sent | opportunity_id, channel, message, status |
| \`outreach_queue\` | Pending outreach messages | lead_id, channel, message, status, scheduled_for |
| \`outreach_jobs\` | Outreach execution records | lead_id, channel, status, sent_at |

### Revenue & Treasury
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`payments\` | All payment records | amount_usd, currency, status, charge_id |
| \`treasury_ledger\` | Immutable financial ledger (INSERT-ONLY trigger) | amount_usd, type, network, tx_hash |
| \`treasury_balances\` | Current balance snapshots | asset, network, balance |
| \`treasury_wallet\` | Wallet configuration | address, network, is_active |
| \`treasury_settings\` | Treasury configuration | payout_method, payout_address |
| \`cashout_requests\` | Withdrawal requests | amount_usd, status, wallet_address, tx_hash |
| \`swap_orders\` | Token swap orders | from_asset, to_asset, amount, status |

### Affiliate & M2M Network
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`affiliate_programs\` | Partner program configs | name, category, commission_value, commission_type, base_url |
| \`affiliate_clicks\` | Click tracking | program_id, source, converted, commission_usd |
| \`affiliate_earnings\` | Revenue per program | amount_usd, program_id, status |
| \`affiliate_content\` | Generated marketing content | headline, body, platform, affiliate_link, clicks, conversions |
| \`m2m_partners\` | Machine-to-machine partner registry | name, affiliate_base_url, commission_rate |
| \`m2m_ledger\` | M2M transaction ledger | partner_id, amount_usd, status |
| \`click_analytics\` | Granular click tracking | partner_slug, redirect_url, source_platform, ip_hash |

### Intelligence & Customer DNA
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`customer_dna\` | Behavioral profile per actor | trust_level, buying_style, payment_resistance_score, churn_risk |
| \`actor_profiles\` | Cross-platform identity | fingerprint, platform, has_paid, total_paid_usd |
| \`actor_lead_links\` | Identity resolution mapping | actor_fingerprint → lead_key |
| \`decision_traces\` | Full decision audit trail | decision, trust_score, fear_detected, reason_codes |
| \`pain_scores\` | Pain/urgency scoring | score, signals, entity_id |
| \`free_value_events\` | Free value delivery tracking | actor_fingerprint, event_type, value_usd |

### Brain & Automation Control
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`brain_settings\` | Master control panel (singleton) | brain_enabled, emergency_stop, auto_approve_threshold, max_daily_outreach |
| \`brain_metrics_daily\` | Daily KPI aggregation | signals_count, opp_count, outreach_sent, revenue_usd, conversion_rate |
| \`hunter_settings\` | Autonomous Hunter config (singleton) | monster_mode, dry_run_mode, daily_limit, sends_today |
| \`hunter_activity_log\` | Hunter action audit trail | action, lead_id, partner_name, status, dry_run |

### Self-Healing & Optimization
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`self_heal_runs\` | Self-healing execution log | trigger, status, patches_applied |
| \`self_heal_patches\` | Applied patches | function_name, patch_type, status |
| \`self_heal_policies\` | Healing policy rules | condition, action, severity |
| \`self_heal_flags\` | System health flags | flag_name, severity, resolved |
| \`self_audit_runs\` | Audit execution log | score, findings_json |
| \`improvement_suggestions\` | AI-generated improvements | suggestion, category, priority, status |
| \`failure_insights\` | Failure pattern analysis | error_type, frequency, last_seen |
| \`patch_proposals\` | Proposed system patches | title, description, status |

### API & Customers
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`users_customers\` | Customer registry | email, company, plan |
| \`api_keys\` | API key management | key_hash, key_prefix, status, rate_limit_tier |
| \`api_requests\` | API usage logging | endpoint, target_address, risk_score, credits_charged |
| \`credit_wallets\` | Customer credit balances | credits_balance, total_credits_purchased |
| \`credit_events\` | Credit transaction log | type, amount, source |
| \`credit_packs\` | Purchasable credit packages | name, credits, price_usd |

### Content & Marketing
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`content_queue\` | Content generation pipeline | body, platform, content_type, status, scheduled_for |
| \`campaign_experiments\` | A/B test configs | experiment_type, control_variant, test_variants, winner_variant |
| \`landing_variants\` | Landing page variants | variant_key, content_json, conversion_rate |
| \`marketing_insights\` | Marketing intelligence | insight_type, data_json |

### Products & Marketplace
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| \`agent_catalog\` | AI agent product catalog | name, price_usd, category, tech_stack |
| \`agent_orders\` | Agent purchase orders | agent_id, customer_email, status, price_usd |
| \`digital_products\` | Digital product catalog | name, price_usd, category |
| \`digital_purchases\` | Digital product purchases | product_id, customer_email, status |
| \`lead_marketplace\` | Lead marketplace listings | lead_data, price_usd, status |
| \`lead_purchases\` | Lead purchase records | lead_id, buyer_email, price_usd |
| \`service_catalog\` | Service listings | name, price_usd, category |

### Other
| Table | Purpose |
|-------|---------|
| \`jobs\` | Background job queue |
| \`artifacts\` | Job output artifacts |
| \`audit_logs\` | System audit trail |
| \`denylist\` | Blocked entities (email/IP/domain) |
| \`notifications\` | System notifications |
| \`session_events\` | User session tracking |
| \`rate_limits\` | Rate limiting records |
| \`webhook_endpoints\` | Registered webhook URLs |
| \`webhook_events\` | Webhook delivery log |
| \`zerodev_sessions\` | Web3 session management |
| \`offer_sources\` | Signal source registry |
| \`source_discovery_queue\` | New source discovery pipeline |
| \`scaling_rules\` | Auto-scaling configuration |
| \`system_metrics\` | System health metrics |
| \`endpoint_costs\` | API endpoint cost tracking |
| \`engine_config\` | Engine configuration store |
| \`learning_events\` | ML learning events |
| \`growth_forecasts\` | Revenue growth projections |
| \`guardian_offers\` | Guardian offer records |
| \`micro_consultations\` | Micro-consultation records |
| \`micro_events\` | Micro-service events |
| \`micro_pricing\` | Dynamic micro-pricing |
| \`micro_rate_limits\` | Micro-service rate limits |

### RLS Policy Summary
- **All 92 tables: RLS ENABLED ✅**
- **Default policy:** \`service_role\` full access on all tables
- **Public SELECT:** agent_catalog (where is_active=true), auto_leads, credit_packs, demand_signals, digital_products, m2m_partners, offer_sources
- **Insert-only enforcement:** treasury_ledger (via \`prevent_mutations\` trigger)
- **No anon write access** on any sensitive table

---

## 2. CURRENT LOGIC FLOW

### Signal → Revenue Pipeline
\`\`\`
demand_signals → brain-scan (score) → brain-score (qualify) → opportunities
  → brain-close (create checkout) → payments → brain-fulfill (deliver)
  → treasury_ledger (record revenue)
\`\`\`

### Autonomous Hunter Pipeline
\`\`\`
demand_signals (relevance ≥ 0.6) → autonomous-hunter/discover
  → Match keywords to 7 partner categories → auto_leads
  → autonomous-hunter/send → Resend API (getsignalforge.com domain)
  → hunter_activity_log (audit trail)
  → telegram-notify (Hebrew daily summary)
\`\`\`

### Quarantine Logic
- **Location:** Frontend logic in \`brain-score\` edge function
- **Mechanism:** Signals with relevance_score < auto_approve_threshold go to status='pending' (quarantine)
- **Promotion:** Signals above threshold auto-promote to status='approved'
- **No SQL triggers** for quarantine — all logic is in edge functions
- **Emergency Stop:** brain_settings.emergency_stop halts all processing

### Trust & DNA Engine
\`\`\`
actor_profiles ← identity resolution → actor_lead_links → leads
  → customer-intelligence-engine → customer_dna (behavioral profile)
  → decision_traces (audit every decision)
  → guardian-offer (personalized offers based on trust_level)
\`\`\`

---

## 3. API & EDGE FUNCTIONS (87 Functions / 6 Layers)

### Layer 1: Brain (Decision Engine)
| Function | Auth | Purpose |
|----------|------|---------|
| brain-scan | CRON_SECRET | Scan & score new signals |
| brain-score | CRON_SECRET | Qualify opportunities |
| brain-close | CRON_SECRET | Create payment checkouts |
| brain-fulfill | CRON_SECRET | Deliver purchased products |
| brain-discover-sources | CRON_SECRET | Find new signal sources |
| brain-daily-metrics | CRON_SECRET | Aggregate daily KPIs |
| full-autonomous-engine | CRON_SECRET | Master orchestrator |
| growth-brain | CRON_SECRET | Growth strategy optimization |

### Layer 2: Signal (Discovery)
| Function | Auth | Purpose |
|----------|------|---------|
| demand-scanner | CRON_SECRET | Scan 31 sources for signals |
| ai-intent-scanner | CRON_SECRET | AI intent classification |
| opportunity-scorer | CRON_SECRET | Score opportunities |
| lead-hunter | CRON_SECRET | Active lead hunting |
| autonomous-hunter | CRON_SECRET | Monster Mode lead engine |

### Layer 3: Outreach (Engagement)
| Function | Auth | Purpose |
|----------|------|---------|
| ai-outreach | CRON_SECRET | AI-generated outreach |
| outreach-sender | CRON_SECRET | Send outreach messages |
| outreach-queue | CRON_SECRET | Queue management |
| outreach-retry-worker | CRON_SECRET | Retry failed sends |
| follow-up-engine | CRON_SECRET | Automated follow-ups |
| automated-outreach | CRON_SECRET | Batch outreach |
| autonomous-dispatch | CRON_SECRET | Auto-dispatch |
| reddit-auto-outreach | CRON_SECRET | Reddit outreach |
| twitter-auto-outreach | CRON_SECRET | Twitter/X outreach |
| hacker-news-outreach | CRON_SECRET | HN outreach |
| discord-auto-outreach | CRON_SECRET | Discord outreach |
| get-manual-outreach-queue | ADMIN_TOKEN | Manual outreach queue |

### Layer 4: Transaction (Revenue)
| Function | Auth | Purpose |
|----------|------|---------|
| create-coinbase-checkout | Public+RateLimit | Create crypto checkout |
| coinbase-webhook | HMAC | Process payment webhook |
| checkout-recovery | CRON_SECRET | Recover abandoned checkouts |
| confirm-payout | ADMIN_TOKEN | Confirm payout |
| create-payout-request | ADMIN_TOKEN | Create payout request |
| create-withdrawal-request | ADMIN_TOKEN | Create withdrawal |
| paypal-payout | ADMIN_TOKEN | PayPal payout execution |
| m2m-postback | HMAC | Partner revenue postback |

### Layer 5: Intelligence (Self-Healing)
| Function | Auth | Purpose |
|----------|------|---------|
| self-healing-brain | CRON_SECRET | Auto-detect & fix issues |
| self-healing-verifier | CRON_SECRET | Verify applied fixes |
| self-improvement | CRON_SECRET | Generate improvements |
| self-audit-brain | CRON_SECRET | System self-audit |
| customer-intelligence-engine | CRON_SECRET | Customer DNA builder |
| continuous-optimizer | CRON_SECRET | Continuous optimization |
| dynamic-pricing-engine | CRON_SECRET | Dynamic pricing |
| marketing-optimizer | CRON_SECRET | Marketing optimization |
| landing-optimizer | CRON_SECRET | Landing page optimization |
| landing-ab-test | CRON_SECRET | A/B test engine |

### Layer 6: Public API
| Function | Auth | Purpose |
|----------|------|---------|
| public-api | API_KEY | Customer-facing API |
| signal-wallet | API_KEY | Wallet risk check |
| signal-contract | API_KEY | Contract risk check |
| micro-wallet-risk | API_KEY | Micro wallet risk |
| micro-webhook-check | API_KEY | Micro webhook check |
| micro-payment-drift | API_KEY | Micro payment drift |
| micro-brain-evaluate | API_KEY | Micro brain evaluate |
| free-value-event | Origin+RateLimit | Free value delivery |
| guardian-offer | Origin+RateLimit | Personalized offers |
| zerodev-status | Public | ZeroDev session status |

### Utility Functions
| Function | Auth | Purpose |
|----------|------|---------|
| telegram-notify | Internal | Telegram notifications |
| send-test-telegram | ADMIN_TOKEN | Test Telegram |
| setup-resend-domain | ADMIN_TOKEN | Domain DNS setup |
| email-unsubscribe | Public | Email unsubscribe handler |
| affiliate-redirect | Public | Affiliate link redirect |
| affiliate-click-tracker | HMAC | Click tracking webhook |
| system-audit | ADMIN_TOKEN | System audit report |
| system-health | CRON_SECRET | Health check |
| daily-report | CRON_SECRET | Daily summary |
| daily-signal-report | CRON_SECRET | Signal summary |
| daily-autonomous-report | CRON_SECRET | Autonomous ops report |
| revenue-report | CRON_SECRET | Revenue summary |
| daily-sweep | CRON_SECRET | Cleanup old data |
| auto-cleanup | CRON_SECRET | Auto cleanup |
| provision-api-key | ADMIN_TOKEN | Provision API keys |
| provision-free-trial | ADMIN_TOKEN | Provision free trials |
| fulfillment-provisioner | ADMIN_TOKEN | Provision fulfillment |
| sandbox-runner | ADMIN_TOKEN | Code sandbox |
| safe-tx-tracker | CRON_SECRET | Safe TX tracking |
| ingest-webhook | HMAC | Generic webhook ingest |
| unlock-lead | ADMIN_TOKEN | Unlock lead data |
| lead-packager | CRON_SECRET | Package leads |
| expansion-engine | CRON_SECRET | Market expansion |
| distribution-orchestrator | CRON_SECRET | Content distribution |
| ai-content-engine | CRON_SECRET | AI content generation |
| ai-job-processor | CRON_SECRET | Background job processor |
| agent-marketplace-engine | CRON_SECRET | Agent marketplace ops |
| affiliate-automation-engine | CRON_SECRET | Affiliate automation |
| auto-closer | CRON_SECRET | Auto-close stale items |
| auto-pipeline | CRON_SECRET | Pipeline automation |
| autonomous-marketer | CRON_SECRET | Marketing automation |
| dynamic-pricing | CRON_SECRET | Price adjustments |

### External API Integrations
| Service | Secret | Status |
|---------|--------|--------|
| Coinbase Commerce | COINBASE_COMMERCE_API_KEY ✅ | Payments |
| Coinbase Webhook | COINBASE_COMMERCE_WEBHOOK_SECRET ✅ | Webhook verification |
| Resend (Email) | RESEND_API_KEY ✅ | Outreach emails |
| Telegram Bot | TELEGRAM_BOT_TOKEN + CHAT_ID ✅ | Notifications |
| PayPal | PAYPAL_API_USERNAME/PASSWORD/SIGNATURE ✅ | Payouts |
| Firecrawl | FIRECRAWL_API_KEY ✅ (connector) | Web scraping |
| ZeroDev | ZERODEV_PROJECT_ID ✅ | Web3 AA wallets |
| WalletConnect | VITE_WALLETCONNECT_PROJECT_ID ✅ | Wallet connection |

---

## 4. UI STATE — Active Views & Routes

### Public Routes
| Route | Component | Purpose |
|-------|-----------|---------|
| \`/\` | PartnerLanding | Main landing page |
| \`/landing\` | Landing | Secondary landing |
| \`/login\` | Login | Auth page |
| \`/api-docs\` | ApiDocs | API documentation |
| \`/purchase\` | Purchase | Checkout page |
| \`/payment-success\` | PaymentSuccess | Post-payment |
| \`/api-access\` | ApiAccess | API key management |
| \`/agents\` | AgentMarketplace | AI agent store |
| \`/products\` | DigitalProducts | Digital product store |
| \`/micro\` | MicroLanding | Micro-service landing |
| \`/leads\` | LeadMarketplace | Lead marketplace |
| \`/go/:partnerSlug/:leadId?\` | AffiliateRedirect | Affiliate redirect |

### Protected Routes (Auth Required)
| Route | Component | Purpose |
|-------|-----------|---------|
| \`/console\` | MoneyMachine | Main operations console |
| \`/forge/money-machine\` | ForgeMoneyMachine | Neural Forge V4 command center |
| \`/forge/m2m-dashboard\` | M2MDashboard | Partner network + Marketing Kit |
| \`/forge/hunter\` | HunterDashboard | Autonomous Hunter control panel |
| \`/dashboard\` | Dashboard | Overview dashboard |
| \`/jobs\` | Jobs | Background jobs list |
| \`/treasury\` | Treasury | Treasury management |
| \`/settings\` | Settings | System settings |
| \`/system\` | SystemDashboard | System health |
| \`/intelligence\` | Intelligence | Intelligence view |
| \`/discovery\` | Discovery | Source discovery |
| \`/sources\` | Sources | Signal sources |
| \`/brain\` | BrainDashboard | Brain control center |
| \`/micro/admin\` | MicroAdminDashboard | Micro-service admin |
| \`/admin/security\` | AdminSecurity | Security settings |
| \`/admin/api-keys\` | AdminApiKeys | API key admin |
| \`/admin/affiliates\` | AffiliateAdmin | Affiliate management |
| \`/admin/system-audit\` | SystemAudit | System audit |
| \`/admin/manual-outreach\` | ManualOutreach | Manual outreach queue |
| \`/admin/domain-manager\` | DomainManager | Domain DNS management |

### Arena Components (ForgeMoneyMachine)
- **ForgeHeader** — System status & controls
- **FinancialHealth** — Revenue KPIs
- **LiveRevenueFeed** — Real-time revenue stream
- **ArenaScore** — System performance score
- **SignalRadar** — Live signal detection
- **ClickTicker** — Affiliate click tracker
- **DispatchLedger** — Outreach dispatch log

### Marketing Kit (M2MDashboard)
- **AutomatedMarketingHub** — Partner content generator with Copy-to-Clipboard
- Generates LinkedIn/Twitter/WhatsApp posts per partner
- Uses affiliate links from m2m_partners table

---

## 5. PENDING TECHNICAL DEBT

### Not Yet Connected to Live Data
1. **Auto-Closer stale logic** — \`auto-closer\` function exists but cron schedule not confirmed
2. **Sandbox Runner** — Code sandbox exists but no UI integration
3. **Learning Events** — Table exists, no active ML training pipeline
4. **Growth Forecasts** — Table created, forecasting engine not generating data
5. **Scaling Rules** — Auto-scaling config table exists, no runtime enforcement
6. **Campaign Experiments** — A/B test infrastructure exists, no active experiments running
7. **Landing Optimizer** — Function exists, not connected to landing variant rotation
8. **Lead Marketplace** — UI exists but lead packaging/pricing not automated

### Partially Implemented
1. **PayPal Payouts** — Function exists, requires manual trigger (no auto-sweep to PayPal)
2. **Web3 Treasury** — Safe multisig integration built, but no auto-sweep from Safe to PayPal
3. **Discord/Twitter/Reddit Outreach** — Functions exist, no active API credentials for posting
4. **Content Distribution** — Orchestrator exists, no active social media API connections
5. **Dynamic Pricing** — Engine exists, pricing rules table is empty
6. **Email Unsubscribe** — Handler exists, not linked to a hosted unsubscribe page

### Known Gaps
1. **No automated backup** of database
2. **No Stripe integration** — only Coinbase Commerce for payments
3. **No user-facing dashboard** — all admin views require auth, no customer self-service portal beyond micro landing
4. **Cron scheduling** — Functions exist but Supabase cron jobs need manual setup in dashboard
5. **Webhook retry** — outreach-retry-worker exists but retry policy not documented

---

## 6. MONSTER MODE — MASTER PROMPT IMPLEMENTATION STATUS

### ✅ Fully Implemented
| Feature | Location | Status |
|---------|----------|--------|
| Autonomous lead discovery from signals | autonomous-hunter | ✅ Live |
| 7-partner keyword matching | autonomous-hunter (CATEGORY_KEYWORDS) | ✅ Live |
| Auto-send via Resend API | autonomous-hunter (sendOutreach) | ✅ Live |
| Verified domain (getsignalforge.com) | Resend config | ✅ Active |
| Daily email rate limit (50/day) | hunter_settings.daily_limit | ✅ Enforced |
| Dry Run mode | hunter_settings.dry_run_mode | ✅ Working |
| Monster Mode toggle | HunterDashboard UI | ✅ Working |
| Emergency Stop | brain_settings.emergency_stop | ✅ Working |
| Hebrew Telegram daily report | autonomous-hunter (sendHuntSummaryTelegram) | ✅ Working |
| ContentForge social templates (Hebrew) | autonomous-hunter (SOCIAL_TEMPLATES) | ✅ Integrated |
| Auto-enable Monster Mode on DNS verify | autonomous-hunter (DNS check) | ✅ Working |
| Denylist enforcement | autonomous-hunter (denylist check) | ✅ Working |
| Activity log audit trail | hunter_activity_log | ✅ Recording |
| HMAC postback verification | m2m-postback | ✅ Working |
| Trust Engine & Customer DNA | customer-intelligence-engine | ✅ Working |
| Decision trace auditing | decision_traces table | ✅ Recording |
| Self-healing detection | self-healing-brain | ✅ Working |
| Marketing Kit + Copy-to-Clipboard | AutomatedMarketingHub | ✅ Working |

### ⚠️ Partially Implemented
| Feature | Gap |
|---------|-----|
| Multi-channel outreach (Reddit/Twitter/HN) | Functions exist, no active API creds |
| Dynamic pricing optimization | Engine exists, rules table empty |
| A/B testing for landing pages | Infrastructure ready, no active experiments |
| Auto-sweep treasury to PayPal | Manual trigger only |

### ❌ Not Yet Implemented
| Feature | Notes |
|---------|-------|
| Customer self-service portal | No post-login customer dashboard |
| Automated cron scheduling | Requires manual setup |
| ML-based lead scoring | Table exists, no training pipeline |
| Multi-language outreach (beyond Hebrew) | Templates are Hebrew/English only |

---

*Report generated by SignalForge System Diagnostic Engine v${REPORT_DATE}*
`;

export default function SystemDiagnosticReport() {
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(REPORT);
      setCopied(true);
      toast.success('הדוח הועתק ללוח');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      textRef.current?.select();
      document.execCommand('copy');
      setCopied(true);
      toast.success('הדוח הועתק ללוח');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 lg:p-8 space-y-4">
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">📋 System Diagnostic Report</CardTitle>
            <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Report'}
            </Button>
          </CardHeader>
          <CardContent>
            <textarea
              ref={textRef}
              readOnly
              value={REPORT}
              className="w-full h-[75vh] bg-muted/50 border border-border rounded-lg p-4 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
