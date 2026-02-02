# 🔐 TOKEN FORGE FACTORY — SECURITY AUDIT EXPORT
## External Audit Package | Generated: 2026-02-02

---

# SECTION 1: CONFIG AUDIT — supabase/config.toml

## Full Config File

```toml
project_id = "flsdahpijdvkohwiinqm"

[functions.daily-sweep]
verify_jwt = false

[functions.public-api]
verify_jwt = false

[functions.ai-job-processor]
verify_jwt = false

[functions.provision-api-key]
verify_jwt = false

[functions.signal-wallet]
verify_jwt = false

[functions.signal-contract]
verify_jwt = false

[functions.daily-signal-report]
verify_jwt = false

[functions.system-health]
verify_jwt = false

[functions.coinbase-webhook]
verify_jwt = false

[functions.expansion-engine]
verify_jwt = false

[functions.self-improvement]
verify_jwt = false

[functions.lead-hunter]
verify_jwt = false

[functions.ai-outreach]
verify_jwt = false

[functions.outreach-sender]
verify_jwt = false

[functions.auto-closer]
verify_jwt = false

[functions.demand-scanner]
verify_jwt = false

[functions.opportunity-scorer]
verify_jwt = false

[functions.fulfillment-provisioner]
verify_jwt = false

[functions.brain-scan]
verify_jwt = false

[functions.brain-score]
verify_jwt = false

[functions.brain-close]
verify_jwt = false

[functions.brain-fulfill]
verify_jwt = false

[functions.brain-discover-sources]
verify_jwt = false

[functions.ingest-webhook]
verify_jwt = false

[functions.micro-wallet-risk]
verify_jwt = false

[functions.micro-webhook-check]
verify_jwt = false

[functions.micro-payment-drift]
verify_jwt = false

[functions.micro-brain-evaluate]
verify_jwt = false

[functions.guardian-offer]
verify_jwt = false

[functions.micro-dashboard-value]
verify_jwt = false

[functions.ai-content-engine]
verify_jwt = false

[functions.ai-intent-scanner]
verify_jwt = false

[functions.distribution-orchestrator]
verify_jwt = false

[functions.outreach-queue]
verify_jwt = false

[functions.outreach-retry-worker]
verify_jwt = false

[functions.brain-daily-metrics]
verify_jwt = false

[functions.marketing-optimizer]
verify_jwt = false

[functions.landing-ab-test]
verify_jwt = false

[functions.continuous-optimizer]
verify_jwt = false

[functions.landing-optimizer]
verify_jwt = false

[functions.growth-brain]
verify_jwt = false

[functions.provision-free-trial]
verify_jwt = false

[functions.reddit-auto-outreach]
verify_jwt = false

[functions.twitter-auto-outreach]
verify_jwt = false

[functions.autonomous-marketer]
verify_jwt = false

[functions.hacker-news-outreach]
verify_jwt = false

[functions.discord-auto-outreach]
verify_jwt = false

[functions.full-autonomous-engine]
verify_jwt = false

[functions.daily-autonomous-report]
verify_jwt = false

[functions.agent-marketplace-engine]
verify_jwt = false

[functions.affiliate-automation-engine]
verify_jwt = false

[functions.affiliate-click-tracker]
verify_jwt = false

[functions.dynamic-pricing-engine]
verify_jwt = false

[functions.free-value-event]
verify_jwt = false

[functions.self-healing-brain]
verify_jwt = false

[functions.self-healing-verifier]
verify_jwt = false
```

## Function Security Classification Table

| Function | Current verify_jwt | Category | Risk Level | Recommended verify_jwt | Required Guard |
|----------|-------------------|----------|------------|----------------------|----------------|
| **coinbase-webhook** | false | WEBHOOK_EXTERNAL | 🟡 MEDIUM | false | HMAC Signature ✅ |
| **ingest-webhook** | false | WEBHOOK_EXTERNAL | 🔴 HIGH | false | Token/HMAC ❌ |
| **free-value-event** | false | PUBLIC_EVENT | 🟡 MEDIUM | false | Rate Limit + Dedup ✅ |
| **affiliate-click-tracker** | false | PUBLIC_EVENT | 🟢 LOW | false | Rate Limit |
| **public-api** | false | PUBLIC_READONLY | 🟡 MEDIUM | false | API Key Auth |
| **signal-wallet** | false | PUBLIC_READONLY | 🟢 LOW | false | API Key Auth |
| **signal-contract** | false | PUBLIC_READONLY | 🟢 LOW | false | API Key Auth |
| **micro-wallet-risk** | false | PUBLIC_READONLY | 🟢 LOW | false | API Key Auth |
| **micro-webhook-check** | false | PUBLIC_READONLY | 🟢 LOW | false | API Key Auth |
| **micro-payment-drift** | false | PUBLIC_READONLY | 🟢 LOW | false | API Key Auth |
| **provision-api-key** | false | ADMIN_ONLY | 🔴 CRITICAL | true | ADMIN_API_TOKEN ❌ |
| **provision-free-trial** | false | ADMIN_ONLY | 🔴 HIGH | true | ADMIN_API_TOKEN ❌ |
| **fulfillment-provisioner** | false | ADMIN_ONLY | 🔴 CRITICAL | true | ADMIN_API_TOKEN ❌ |
| **daily-sweep** | false | ADMIN_ONLY | 🔴 CRITICAL | true | CRON_SECRET ❌ |
| **brain-scan** | false | INTERNAL_ENGINE | 🔴 HIGH | true | CRON_SECRET ❌ |
| **brain-score** | false | INTERNAL_ENGINE | 🔴 HIGH | true | CRON_SECRET ❌ |
| **brain-close** | false | INTERNAL_ENGINE | 🔴 HIGH | true | CRON_SECRET ❌ |
| **brain-fulfill** | false | INTERNAL_ENGINE | 🔴 HIGH | true | CRON_SECRET ❌ |
| **brain-discover-sources** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **brain-daily-metrics** | false | INTERNAL_CRON | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **full-autonomous-engine** | false | INTERNAL_ENGINE | 🔴 CRITICAL | true | CRON_SECRET ❌ |
| **self-healing-brain** | false | INTERNAL_ENGINE | 🔴 CRITICAL | true | CRON_SECRET ❌ |
| **self-healing-verifier** | false | INTERNAL_ENGINE | 🔴 CRITICAL | true | CRON_SECRET ❌ |
| **outreach-sender** | false | INTERNAL_ENGINE | 🔴 HIGH | true | CRON_SECRET ❌ |
| **outreach-queue** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **outreach-retry-worker** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **ai-outreach** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **ai-content-engine** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **ai-intent-scanner** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **ai-job-processor** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **demand-scanner** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **opportunity-scorer** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **lead-hunter** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **auto-closer** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **expansion-engine** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **self-improvement** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **distribution-orchestrator** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **marketing-optimizer** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **landing-ab-test** | false | INTERNAL_ENGINE | 🟢 LOW | true | CRON_SECRET |
| **landing-optimizer** | false | INTERNAL_ENGINE | 🟢 LOW | true | CRON_SECRET |
| **continuous-optimizer** | false | INTERNAL_ENGINE | 🟢 LOW | true | CRON_SECRET |
| **growth-brain** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **dynamic-pricing-engine** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **micro-brain-evaluate** | false | INTERNAL_ENGINE | 🟢 LOW | true | CRON_SECRET |
| **micro-dashboard-value** | false | INTERNAL_ENGINE | 🟢 LOW | true | CRON_SECRET |
| **guardian-offer** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **reddit-auto-outreach** | false | INTERNAL_ENGINE | 🔴 HIGH | true | CRON_SECRET ❌ |
| **twitter-auto-outreach** | false | INTERNAL_ENGINE | 🔴 HIGH | true | CRON_SECRET ❌ |
| **hacker-news-outreach** | false | INTERNAL_ENGINE | 🔴 HIGH | true | CRON_SECRET ❌ |
| **discord-auto-outreach** | false | INTERNAL_ENGINE | 🔴 HIGH | true | CRON_SECRET ❌ |
| **autonomous-marketer** | false | INTERNAL_ENGINE | 🔴 HIGH | true | CRON_SECRET ❌ |
| **agent-marketplace-engine** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **affiliate-automation-engine** | false | INTERNAL_ENGINE | 🟡 MEDIUM | true | CRON_SECRET ❌ |
| **daily-signal-report** | false | INTERNAL_CRON | 🟢 LOW | true | CRON_SECRET |
| **daily-autonomous-report** | false | INTERNAL_CRON | 🟢 LOW | true | CRON_SECRET |
| **system-health** | false | INTERNAL_CRON | 🟢 LOW | true | CRON_SECRET |

---

# SECTION 2: SECURITY POLICY (CORE)

## Default Deny Policy

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEFAULT DENY POLICY                          │
├─────────────────────────────────────────────────────────────────┤
│  Default: verify_jwt = true                                     │
│                                                                 │
│  Exceptions (verify_jwt = false) ONLY for:                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. coinbase-webhook    → HMAC Signature Required        │   │
│  │ 2. ingest-webhook      → Token/HMAC Required            │   │
│  │ 3. free-value-event    → Rate Limit + Dedup Required    │   │
│  │ 4. affiliate-click-tracker → Rate Limit Required        │   │
│  │ 5. public-api          → API Key Auth Required          │   │
│  │ 6. signal-wallet       → API Key Auth Required          │   │
│  │ 7. signal-contract     → API Key Auth Required          │   │
│  │ 8. micro-*             → API Key Auth Required          │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Exception Guard Requirements

### coinbase-webhook (WEBHOOK_EXTERNAL)
```typescript
// REQUIRED GUARD: HMAC Signature Verification
const signature = req.headers.get("X-CC-Webhook-Signature");
const webhookSecret = Deno.env.get("COINBASE_WEBHOOK_SECRET");
const isValid = await verifyHmacSignature(body, signature, webhookSecret);
if (!isValid) {
  console.error("Invalid Coinbase webhook signature");
  return new Response("Unauthorized", { status: 401 });
}
```

### ingest-webhook (WEBHOOK_EXTERNAL)
```typescript
// REQUIRED GUARD: Token/HMAC Verification
const authHeader = req.headers.get("Authorization");
const ingestToken = Deno.env.get("INGEST_WEBHOOK_TOKEN");
if (authHeader !== `Bearer ${ingestToken}`) {
  console.error("Invalid ingest webhook token");
  return new Response("Unauthorized", { status: 401 });
}
```

### free-value-event (PUBLIC_EVENT)
```typescript
// REQUIRED GUARDS: Origin Allowlist + Rate Limit + Anti-Replay
const origin = req.headers.get("Origin");
const allowedOrigins = [
  "https://id-preview--c789e62a-6c80-4817-af6a-864347682163.lovable.app",
  "https://tokenforge.factory" // production domain
];
if (!allowedOrigins.includes(origin)) {
  return new Response("Forbidden", { status: 403 });
}
// + Rate limit by IP hash
// + Dedup by dedup_key in DB
```

### public-api, signal-*, micro-* (PUBLIC_READONLY)
```typescript
// REQUIRED GUARD: API Key Verification
const apiKey = req.headers.get("X-API-Key");
if (!apiKey) {
  return new Response("API key required", { status: 401 });
}
const keyHash = await hashWithPepper(apiKey);
const { data: keyRecord } = await supabase
  .from("api_keys")
  .select("*")
  .eq("key_hash", keyHash)
  .eq("status", "active")
  .single();
if (!keyRecord) {
  return new Response("Invalid API key", { status: 401 });
}
```

---

# SECTION 3: CODE AUDIT — Guards in Practice

## Guard Checklist by Function

### coinbase-webhook
| Guard | Status | Evidence |
|-------|--------|----------|
| HMAC Signature | ✅ | Uses `X-CC-Webhook-Signature` header |
| Webhook Secret | ✅ | `COINBASE_WEBHOOK_SECRET` from env |
| 401 on Failure | ✅ | Returns 401 with error log |
| Replay Protection | ✅ | Checks `charge_id` uniqueness |

### ingest-webhook
| Guard | Status | Evidence |
|-------|--------|----------|
| Token Auth | ❌ | No auth header check found |
| HMAC Signature | ❌ | No signature verification |
| 401 on Failure | ❌ | Accepts all requests |
| Rate Limit | ❌ | No rate limiting |

### free-value-event
| Guard | Status | Evidence |
|-------|--------|----------|
| Origin Allowlist | ⚠️ | Partial - needs explicit list |
| Rate Limit | ✅ | IP-based throttling |
| Anti-Replay | ✅ | `dedup_key` uniqueness |
| CORS Headers | ✅ | Proper CORS response |

### provision-api-key
| Guard | Status | Evidence |
|-------|--------|----------|
| Admin Auth | ❌ | **CRITICAL: No auth check** |
| JWT Verification | ❌ | `verify_jwt = false` |
| ADMIN_API_TOKEN | ❌ | Not implemented |
| Rate Limit | ❌ | No rate limiting |

### fulfillment-provisioner
| Guard | Status | Evidence |
|-------|--------|----------|
| Admin Auth | ❌ | **CRITICAL: No auth check** |
| JWT Verification | ❌ | `verify_jwt = false` |
| ADMIN_API_TOKEN | ❌ | Not implemented |
| Payment Verification | ⚠️ | Checks payment_id exists |

### full-autonomous-engine
| Guard | Status | Evidence |
|-------|--------|----------|
| CRON_SECRET | ❌ | **No cron secret check** |
| JWT Verification | ❌ | `verify_jwt = false` |
| Emergency Stop | ✅ | Checks `brain_settings.emergency_stop` |
| Throttle Check | ✅ | Respects throttle_until |

### brain-scan, brain-score, brain-close, brain-fulfill
| Guard | Status | Evidence |
|-------|--------|----------|
| CRON_SECRET | ❌ | **No cron secret check** |
| JWT Verification | ❌ | `verify_jwt = false` |
| Brain Enabled | ✅ | Checks `brain_settings.brain_enabled` |
| Scan Enabled | ✅ | Checks `brain_settings.scan_enabled` |

### self-healing-brain, self-healing-verifier
| Guard | Status | Evidence |
|-------|--------|----------|
| CRON_SECRET | ❌ | **No cron secret check** |
| JWT Verification | ❌ | `verify_jwt = false` |
| Patch Limit | ✅ | Max 1 patch per 24h |
| Rollback Trigger | ✅ | Revenue drop detection |

### daily-sweep
| Guard | Status | Evidence |
|-------|--------|----------|
| CRON_SECRET | ❌ | **CRITICAL: No auth on treasury** |
| JWT Verification | ❌ | `verify_jwt = false` |
| Safe Multisig | ✅ | Requires Safe signatures |
| Value Limits | ✅ | Respects max_daily_value_usd |

---

# SECTION 4: PATCH PLAN (DO NOT EXECUTE)

## A) Config Changes — supabase/config.toml

### Functions to change to verify_jwt = true:
```toml
# INTERNAL_ENGINE functions (38 total)
[functions.brain-scan]
verify_jwt = true

[functions.brain-score]
verify_jwt = true

[functions.brain-close]
verify_jwt = true

[functions.brain-fulfill]
verify_jwt = true

[functions.brain-discover-sources]
verify_jwt = true

[functions.brain-daily-metrics]
verify_jwt = true

[functions.full-autonomous-engine]
verify_jwt = true

[functions.self-healing-brain]
verify_jwt = true

[functions.self-healing-verifier]
verify_jwt = true

[functions.outreach-sender]
verify_jwt = true

[functions.outreach-queue]
verify_jwt = true

[functions.outreach-retry-worker]
verify_jwt = true

[functions.ai-outreach]
verify_jwt = true

[functions.ai-content-engine]
verify_jwt = true

[functions.ai-intent-scanner]
verify_jwt = true

[functions.ai-job-processor]
verify_jwt = true

[functions.demand-scanner]
verify_jwt = true

[functions.opportunity-scorer]
verify_jwt = true

[functions.lead-hunter]
verify_jwt = true

[functions.auto-closer]
verify_jwt = true

[functions.expansion-engine]
verify_jwt = true

[functions.self-improvement]
verify_jwt = true

[functions.distribution-orchestrator]
verify_jwt = true

[functions.marketing-optimizer]
verify_jwt = true

[functions.landing-ab-test]
verify_jwt = true

[functions.landing-optimizer]
verify_jwt = true

[functions.continuous-optimizer]
verify_jwt = true

[functions.growth-brain]
verify_jwt = true

[functions.dynamic-pricing-engine]
verify_jwt = true

[functions.micro-brain-evaluate]
verify_jwt = true

[functions.micro-dashboard-value]
verify_jwt = true

[functions.guardian-offer]
verify_jwt = true

[functions.reddit-auto-outreach]
verify_jwt = true

[functions.twitter-auto-outreach]
verify_jwt = true

[functions.hacker-news-outreach]
verify_jwt = true

[functions.discord-auto-outreach]
verify_jwt = true

[functions.autonomous-marketer]
verify_jwt = true

[functions.agent-marketplace-engine]
verify_jwt = true

[functions.affiliate-automation-engine]
verify_jwt = true

[functions.daily-signal-report]
verify_jwt = true

[functions.daily-autonomous-report]
verify_jwt = true

[functions.system-health]
verify_jwt = true

# ADMIN_ONLY functions
[functions.provision-api-key]
verify_jwt = true

[functions.provision-free-trial]
verify_jwt = true

[functions.fulfillment-provisioner]
verify_jwt = true

[functions.daily-sweep]
verify_jwt = true
```

## B) Add CRON_SECRET Guard

### Template for all INTERNAL_CRON functions:
```typescript
// Add to top of every internal function
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // CRON_SECRET guard
  const cronSecret = req.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("CRON_SECRET");
  
  if (cronSecret !== expectedSecret) {
    console.error("Unauthorized cron call attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // ... rest of function
});
```

## C) Add Origin Allowlist + Rate Limit for PUBLIC_EVENT

### For free-value-event:
```typescript
const ALLOWED_ORIGINS = [
  "https://id-preview--c789e62a-6c80-4817-af6a-864347682163.lovable.app",
  "https://tokenforge.app", // production
  "http://localhost:5173",  // dev only - remove in prod
];

const origin = req.headers.get("Origin");
if (!ALLOWED_ORIGINS.includes(origin || "")) {
  return new Response("Forbidden", { status: 403, headers: corsHeaders });
}

// Rate limit: max 100 events per IP per hour
const ipHash = await hashIP(req.headers.get("x-forwarded-for") || "unknown");
const { count } = await supabase
  .from("free_value_events")
  .select("*", { count: "exact", head: true })
  .eq("ip_hash", ipHash)
  .gte("created_at", new Date(Date.now() - 3600000).toISOString());

if (count >= 100) {
  return new Response("Rate limited", { status: 429, headers: corsHeaders });
}
```

## D) Add Read-Only Policy for public-api

### Current: Allows any API key holder to query
### Recommended: Add scope-based permissions

```typescript
// Check API key scope
const { data: keyRecord } = await supabase
  .from("api_keys")
  .select("*, users_customers(plan)")
  .eq("key_hash", keyHash)
  .single();

const allowedEndpoints = {
  free: ["signal-wallet", "signal-contract"],
  starter: ["signal-wallet", "signal-contract", "micro-wallet-risk"],
  pro: ["signal-wallet", "signal-contract", "micro-wallet-risk", "micro-webhook-check", "micro-payment-drift"],
};

const plan = keyRecord.users_customers?.plan || "free";
if (!allowedEndpoints[plan]?.includes(endpoint)) {
  return new Response("Endpoint not available in your plan", { status: 403 });
}
```

---

# SECTION 5: EXTERNAL AUDIT EXPORT

## Project Tree

```
/
├── docs/
│   ├── SYSTEM_SPECIFICATION.md
│   └── SECURITY_AUDIT_EXPORT.md
├── public/
│   ├── icons/
│   ├── favicon.ico
│   ├── manifest.json
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── customer/
│   │   ├── landing/
│   │   ├── micro/
│   │   ├── pricing/
│   │   ├── settings/
│   │   ├── treasury/
│   │   ├── ui/ (shadcn components)
│   │   ├── ActivationChecklist.tsx
│   │   ├── AppLayout.tsx
│   │   ├── AppSidebar.tsx
│   │   ├── JobDetails.tsx
│   │   ├── JobsList.tsx
│   │   ├── JobsTable.tsx
│   │   ├── NavLink.tsx
│   │   ├── StatCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── StatusChart.tsx
│   │   ├── TreasuryView.tsx
│   │   └── Web3Provider.tsx
│   ├── data/
│   │   ├── marketingCommunities.ts
│   │   └── mockData.ts
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   ├── useDatabase.ts
│   │   ├── useRevenueData.ts
│   │   ├── useRunPipeline.ts
│   │   ├── useTreasury.ts
│   │   └── useTreasurySettings.ts
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts (auto-generated)
│   │       └── types.ts (auto-generated)
│   ├── lib/
│   │   ├── database.ts
│   │   ├── expansion.ts
│   │   ├── safe.ts
│   │   ├── telegram.ts
│   │   ├── trackEvent.ts
│   │   ├── utils.ts
│   │   ├── web3.ts
│   │   └── zerodev.ts
│   ├── pages/
│   │   ├── AdminApiKeys.tsx
│   │   ├── AdminSecurity.tsx
│   │   ├── AffiliateAdmin.tsx
│   │   ├── AgentMarketplace.tsx
│   │   ├── ApiAccess.tsx
│   │   ├── ApiDocs.tsx
│   │   ├── BrainDashboard.tsx
│   │   ├── Dashboard.tsx
│   │   ├── DigitalProducts.tsx
│   │   ├── Discovery.tsx
│   │   ├── Intelligence.tsx
│   │   ├── JobDetailsPage.tsx
│   │   ├── Jobs.tsx
│   │   ├── Landing.tsx
│   │   ├── MicroAdminDashboard.tsx
│   │   ├── MicroLanding.tsx
│   │   ├── MoneyMachine.tsx
│   │   ├── NotFound.tsx
│   │   ├── PaymentSuccess.tsx
│   │   ├── Purchase.tsx
│   │   ├── Settings.tsx
│   │   ├── Sources.tsx
│   │   ├── SystemDashboard.tsx
│   │   └── Treasury.tsx
│   ├── test/
│   ├── types/
│   ├── workers/
│   │   ├── auditBuilder.ts
│   │   ├── failure-intel.ts
│   │   ├── generator.ts
│   │   ├── judge.ts
│   │   ├── pipeline.ts
│   │   ├── skeptic.ts
│   │   └── treasury.ts
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── supabase/
│   ├── functions/
│   │   ├── _shared/
│   │   │   ├── master-prompt-config.ts
│   │   │   ├── micro-utils.ts
│   │   │   ├── self-heal-policy.ts
│   │   │   └── trust-engine.ts
│   │   ├── affiliate-automation-engine/
│   │   ├── affiliate-click-tracker/
│   │   ├── agent-marketplace-engine/
│   │   ├── ai-content-engine/
│   │   ├── ai-intent-scanner/
│   │   ├── ai-job-processor/
│   │   ├── ai-outreach/
│   │   ├── auto-closer/
│   │   ├── auto-pipeline/
│   │   ├── autonomous-marketer/
│   │   ├── brain-close/
│   │   ├── brain-daily-metrics/
│   │   ├── brain-discover-sources/
│   │   ├── brain-fulfill/
│   │   ├── brain-scan/
│   │   ├── brain-score/
│   │   ├── coinbase-webhook/
│   │   ├── confirm-payout/
│   │   ├── continuous-optimizer/
│   │   ├── create-coinbase-checkout/
│   │   ├── create-payout-request/
│   │   ├── create-withdrawal-request/
│   │   ├── daily-autonomous-report/
│   │   ├── daily-report/
│   │   ├── daily-signal-report/
│   │   ├── daily-sweep/
│   │   ├── demand-scanner/
│   │   ├── discord-auto-outreach/
│   │   ├── distribution-orchestrator/
│   │   ├── dynamic-pricing/
│   │   ├── dynamic-pricing-engine/
│   │   ├── expansion-engine/
│   │   ├── follow-up-engine/
│   │   ├── free-value-event/
│   │   ├── fulfillment-provisioner/
│   │   ├── full-autonomous-engine/
│   │   ├── growth-brain/
│   │   ├── guardian-offer/
│   │   ├── hacker-news-outreach/
│   │   ├── ingest-webhook/
│   │   ├── landing-ab-test/
│   │   ├── landing-optimizer/
│   │   ├── lead-hunter/
│   │   ├── marketing-optimizer/
│   │   ├── micro-brain-evaluate/
│   │   ├── micro-dashboard-value/
│   │   ├── micro-payment-drift/
│   │   ├── micro-wallet-risk/
│   │   ├── micro-webhook-check/
│   │   ├── opportunity-scorer/
│   │   ├── outreach-queue/
│   │   ├── outreach-retry-worker/
│   │   ├── outreach-sender/
│   │   ├── provision-api-key/
│   │   ├── provision-free-trial/
│   │   ├── public-api/
│   │   ├── reddit-auto-outreach/
│   │   ├── revenue-report/
│   │   ├── safe-tx-tracker/
│   │   ├── sandbox-runner/
│   │   ├── self-audit-brain/
│   │   ├── self-healing-brain/
│   │   ├── self-healing-verifier/
│   │   ├── self-improvement/
│   │   ├── send-test-telegram/
│   │   ├── signal-contract/
│   │   ├── signal-wallet/
│   │   ├── system-health/
│   │   ├── telegram-notify/
│   │   ├── twitter-auto-outreach/
│   │   └── deno.json
│   └── config.toml
├── .env
├── capacitor.config.ts
├── components.json
├── eslint.config.js
├── index.html
├── package.json
├── postcss.config.js
├── README.md
├── tailwind.config.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── vitest.config.ts
```

## Edge Functions Summary

| Function | Purpose | Writes DB | Risk |
|----------|---------|-----------|------|
| **brain-scan** | Scans offer_sources for signals | ✅ demand_signals | HIGH |
| **brain-score** | Scores signals → opportunities | ✅ opportunities | HIGH |
| **brain-close** | Creates checkout links | ✅ closing_attempts | HIGH |
| **brain-fulfill** | Provisions after payment | ✅ fulfillment_jobs, api_keys | CRITICAL |
| **brain-discover-sources** | Discovers new sources | ✅ offer_sources | MEDIUM |
| **brain-daily-metrics** | Calculates daily stats | ✅ brain_metrics_daily | LOW |
| **outreach-sender** | Sends outreach messages | ✅ outreach_jobs | HIGH |
| **outreach-queue** | Queues outreach | ✅ outreach_jobs | MEDIUM |
| **coinbase-webhook** | Receives payments | ✅ payments | CRITICAL |
| **fulfillment-provisioner** | Creates API keys | ✅ api_keys, credit_wallets | CRITICAL |
| **provision-api-key** | Manual key provision | ✅ api_keys | CRITICAL |
| **daily-sweep** | Treasury transfer | ✅ cashout_requests | CRITICAL |
| **full-autonomous-engine** | Main orchestrator | ✅ multiple | CRITICAL |
| **self-healing-brain** | Detects anomalies | ✅ self_heal_patches | CRITICAL |
| **self-healing-verifier** | Monitors KPIs | ✅ self_heal_patches | CRITICAL |
| **free-value-event** | Tracks user events | ✅ free_value_events | LOW |
| **public-api** | Customer API | ✅ api_requests | MEDIUM |
| **signal-wallet** | Wallet risk check | ✅ api_requests | LOW |
| **signal-contract** | Contract risk check | ✅ api_requests | LOW |
| **micro-wallet-risk** | Micro wallet check | ✅ api_requests | LOW |

## Critical Tables Schema

### brain_settings
```sql
CREATE TABLE brain_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  brain_enabled BOOLEAN DEFAULT true,
  emergency_stop BOOLEAN DEFAULT false,
  scan_enabled BOOLEAN DEFAULT true,
  outreach_enabled BOOLEAN DEFAULT true,
  auto_closing_enabled BOOLEAN DEFAULT true,
  fulfillment_enabled BOOLEAN DEFAULT true,
  max_daily_outreach INTEGER DEFAULT 20,
  max_daily_txs INTEGER DEFAULT 20,
  max_daily_value_usd NUMERIC DEFAULT 200,
  max_value_per_tx_usd NUMERIC DEFAULT 50,
  auto_approve_threshold NUMERIC DEFAULT 0.5,
  min_opportunity_value_usd NUMERIC DEFAULT 20,
  throttle_until TIMESTAMPTZ,
  throttle_reason TEXT,
  payout_wallet_address TEXT,
  -- constraints ensure single row
  CONSTRAINT single_row CHECK (id = true)
);
```

### payments
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  charge_id TEXT UNIQUE,
  amount_usd NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  customer_email TEXT,
  product_type TEXT,
  product_id TEXT,
  opportunity_id UUID REFERENCES opportunities(id),
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ
);
```

### decision_traces
```sql
CREATE TABLE decision_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  decision TEXT NOT NULL,
  actor_fingerprint TEXT,
  lead_key TEXT,
  trust_score NUMERIC,
  pain_score NUMERIC,
  intent TEXT,
  reason_codes TEXT[],
  platform TEXT,
  source_url TEXT,
  throttle_state TEXT,
  throttle_until TIMESTAMPTZ,
  interaction_count INTEGER,
  free_value_events_count_24h INTEGER,
  free_value_events_count_30d INTEGER,
  offer_id TEXT,
  trust_cap_applied BOOLEAN
);
```

### actor_profiles
```sql
CREATE TABLE actor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT UNIQUE NOT NULL,
  platform TEXT NOT NULL,
  author TEXT,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  interaction_count_30d INTEGER DEFAULT 0,
  free_value_events_count INTEGER DEFAULT 0,
  outreach_received_count INTEGER DEFAULT 0,
  has_paid BOOLEAN DEFAULT false,
  first_payment_at TIMESTAMPTZ,
  total_paid_usd NUMERIC DEFAULT 0,
  highest_trust_score NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### free_value_events
```sql
CREATE TABLE free_value_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  event_type TEXT NOT NULL,
  actor_fingerprint TEXT,
  lead_key TEXT,
  session_id TEXT,
  page_path TEXT,
  source_url TEXT,
  ip_hash TEXT,
  event_data JSONB,
  dedup_key TEXT UNIQUE,
  is_trusted BOOLEAN DEFAULT false,
  customer_id UUID REFERENCES users_customers(id),
  lead_id UUID REFERENCES leads(id)
);
```

### outreach_jobs
```sql
CREATE TABLE outreach_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  opportunity_id UUID REFERENCES opportunities(id),
  lead_id UUID REFERENCES leads(id),
  platform TEXT NOT NULL,
  channel TEXT,
  message_content TEXT,
  personalization_data JSONB,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  response_received_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ
);
```

## Cron Schedule

| Schedule | Function | Purpose |
|----------|----------|---------|
| Every 1 min | auto-pipeline | Main heartbeat |
| Every 1 min | brain-fulfill | Fulfillment check |
| Every 1 min | safe-tx-tracker | Track Safe txs |
| Every 10 min | brain-scan | Scan sources |
| Every 10 min | brain-score | Score signals |
| Every 10 min | brain-close | Create checkouts |
| Every 15 min | outreach-sender | Send outreach |
| Every 15 min | opportunity-scorer | Re-score |
| Every 30 min | demand-scanner | Scan demand |
| Every 1 hour | lead-hunter | Hunt leads |
| Every 1 hour | auto-closer | Close deals |
| Every 1 hour | ai-intent-scanner | Scan intent |
| Every 1 hour | self-healing-verifier | Verify KPIs |
| Every 2 hours | distribution-orchestrator | Orchestrate |
| 3x daily | ai-content-engine | Create content |
| Every 6 hours | brain-discover-sources | Find sources |
| Daily 07:00 | daily-report | Daily report |
| Daily 07:00 | daily-sweep | Treasury sweep |
| Daily 07:00 | self-improvement | Self improve |
| Daily 07:00 | expansion-engine | Expand |
| Daily 03:00 | self-healing-brain | Self heal |

## Environment Variables (Names Only)

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
COINBASE_COMMERCE_API_KEY
COINBASE_WEBHOOK_SECRET
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
OPENAI_API_KEY
ADMIN_API_TOKEN
CRON_SECRET
SAFE_WALLET_ADDRESS
PAYOUT_WALLET_ADDRESS
ZERODEV_PROJECT_ID
ALCHEMY_API_KEY
BASESCAN_API_KEY
```

---

# SECTION 6: RISK REGISTER

## Top 10 Risks

| # | Risk | Severity | Likelihood | Impact | Mitigation | Owner |
|---|------|----------|------------|--------|------------|-------|
| 1 | **Unauthenticated provision-api-key** | 🔴 CRITICAL | HIGH | API keys issued without payment | Add ADMIN_API_TOKEN guard | Security |
| 2 | **Unauthenticated fulfillment-provisioner** | 🔴 CRITICAL | HIGH | Free provisioning bypass | Add ADMIN_API_TOKEN guard | Security |
| 3 | **Unauthenticated daily-sweep** | 🔴 CRITICAL | MEDIUM | Unauthorized treasury ops | Add CRON_SECRET guard | Security |
| 4 | **No CRON_SECRET on brain-**** | 🔴 HIGH | HIGH | Spam/DoS of brain functions | Add CRON_SECRET to all | Security |
| 5 | **Ingest-webhook no auth** | 🔴 HIGH | MEDIUM | Fake signals injected | Add token/HMAC auth | Security |
| 6 | **Outreach spam risk** | 🟡 MEDIUM | MEDIUM | Reputation damage | Throttle + sticky throttle | Ops |
| 7 | **FVE abuse for trust score** | 🟡 MEDIUM | MEDIUM | Fake trust accumulation | Rate limit + fingerprint | Security |
| 8 | **Self-healing false patch** | 🟡 MEDIUM | LOW | Bad auto-fix deployed | Max 1 patch/24h + rollback | Ops |
| 9 | **Coinbase webhook replay** | 🟢 LOW | LOW | Double fulfillment | charge_id uniqueness | Security |
| 10 | **API key brute force** | 🟢 LOW | LOW | Key discovery | Rate limit + long keys | Security |

---

# SECTION 7: IMMEDIATE ACTIONS

## 🔥 TOP 5 IMMEDIATE FIXES

1. **ADD ADMIN_API_TOKEN to provision-api-key**
   ```typescript
   const adminToken = req.headers.get("x-admin-token");
   if (adminToken !== Deno.env.get("ADMIN_API_TOKEN")) {
     return new Response("Unauthorized", { status: 401 });
   }
   ```

2. **ADD ADMIN_API_TOKEN to fulfillment-provisioner**
   - Same pattern as above

3. **ADD CRON_SECRET to daily-sweep**
   ```typescript
   const cronSecret = req.headers.get("x-cron-secret");
   if (cronSecret !== Deno.env.get("CRON_SECRET")) {
     return new Response("Unauthorized", { status: 401 });
   }
   ```

4. **ADD CRON_SECRET to all brain-* functions**
   - brain-scan, brain-score, brain-close, brain-fulfill, brain-discover-sources

5. **ADD TOKEN AUTH to ingest-webhook**
   ```typescript
   const ingestToken = req.headers.get("authorization");
   if (ingestToken !== `Bearer ${Deno.env.get("INGEST_WEBHOOK_TOKEN")}`) {
     return new Response("Unauthorized", { status: 401 });
   }
   ```

## ✅ SAFE MINIMAL CHANGESET

These changes can be applied immediately without breaking functionality:

1. Add `ADMIN_API_TOKEN` secret to Cloud
2. Add `CRON_SECRET` secret to Cloud
3. Add `INGEST_WEBHOOK_TOKEN` secret to Cloud
4. Update 3 critical functions with auth guards
5. Test with existing cron caller (add header)

## 🧪 VERIFICATION QUERIES

### Check for unauthorized API key provisioning:
```sql
SELECT 
  ak.id,
  ak.created_at,
  ak.key_prefix,
  ak.customer_id,
  uc.email
FROM api_keys ak
LEFT JOIN users_customers uc ON ak.customer_id = uc.id
WHERE ak.created_at > now() - interval '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM payments p 
    WHERE p.customer_email = uc.email 
      AND p.status = 'confirmed'
  )
ORDER BY ak.created_at DESC;
```

### Check for suspicious FVE patterns:
```sql
SELECT 
  ip_hash,
  actor_fingerprint,
  COUNT(*) as event_count,
  COUNT(DISTINCT session_id) as sessions,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM free_value_events
WHERE created_at > now() - interval '24 hours'
GROUP BY ip_hash, actor_fingerprint
HAVING COUNT(*) > 50
ORDER BY event_count DESC;
```

### Check for outreach during throttle:
```sql
SELECT 
  oj.id,
  oj.created_at,
  oj.status,
  bs.throttle_activated_at,
  bs.throttle_until
FROM outreach_jobs oj
CROSS JOIN brain_settings bs
WHERE oj.status = 'sent'
  AND bs.throttle_until IS NOT NULL
  AND oj.created_at BETWEEN bs.throttle_activated_at AND bs.throttle_until;
```

### Check for duplicate payments:
```sql
SELECT 
  charge_id,
  COUNT(*) as count,
  array_agg(id) as payment_ids
FROM payments
WHERE charge_id IS NOT NULL
GROUP BY charge_id
HAVING COUNT(*) > 1;
```

### Check fulfillment without payment:
```sql
SELECT 
  fj.id,
  fj.created_at,
  fj.status,
  fj.payment_id,
  p.status as payment_status
FROM fulfillment_jobs fj
LEFT JOIN payments p ON fj.payment_id = p.id
WHERE fj.status = 'completed'
  AND (p.id IS NULL OR p.status != 'confirmed');
```

---

# FINAL AUDIT MANIFEST

```json
{
  "exported_at": "2026-02-02T12:00:00Z",
  "project_id": "flsdahpijdvkohwiinqm",
  "system_name": "Token Forge Factory",
  "version": "Self-Healing Brain v2",
  "functions_total": 56,
  "functions_critical_unprotected": 5,
  "tables_total": 40,
  "migrations_total": 28,
  "risks_critical": 3,
  "risks_high": 3,
  "risks_medium": 3,
  "risks_low": 1,
  "immediate_fixes_required": 5,
  "estimated_fix_time_hours": 4,
  "audit_status": "REQUIRES_SECURITY_HARDENING",
  "notes": [
    "All internal functions currently have verify_jwt=false",
    "Critical provisioning endpoints lack authentication",
    "Treasury function (daily-sweep) accessible without auth",
    "Recommend implementing CRON_SECRET for all scheduled functions",
    "Coinbase webhook properly secured with HMAC"
  ]
}
```

---

*Document generated for external security audit. All secrets REDACTED.*
