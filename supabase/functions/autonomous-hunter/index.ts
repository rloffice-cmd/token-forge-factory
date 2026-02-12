/**
 * Autonomous Hunter Engine
 * Discovers leads via AI analysis of demand signals and dispatches outreach
 * 
 * SECURITY: INTERNAL_CRON - requires x-cron-secret
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

// Partner category to keyword mapping for lead discovery
const CATEGORY_KEYWORDS: Record<string, { keywords: string[]; partner: string }> = {
  'email_automation': {
    keywords: ['cold email', 'email outreach', 'email deliverability', 'warming', 'cold outbound', 'email sequences'],
    partner: 'Woodpecker',
  },
  'email_verification': {
    keywords: ['email verification', 'bounce rate', 'email list cleaning', 'email validation', 'list hygiene'],
    partner: 'EmailListVerify',
  },
  'ecommerce_analytics': {
    keywords: ['ecommerce analytics', 'product analytics', 'shopify analytics', 'store optimization', 'revenue analytics', 'DTC analytics'],
    partner: 'Compass',
  },
  'marketing_roas': {
    keywords: ['ad optimization', 'ROAS', 'ad spend', 'PPC optimization', 'campaign optimization', 'CPA reduction'],
    partner: 'AdTurbo AI',
  },
  'crm_sales': {
    keywords: ['CRM', 'sales pipeline', 'deal tracking', 'lead management', 'sales automation', 'close rate'],
    partner: 'Lucro CRM',
  },
  'fundraising': {
    keywords: ['fundraising', 'investor pipeline', 'seed round', 'series A', 'capital raising', 'pitch deck'],
    partner: 'EasyFund',
  },
  'webinar': {
    keywords: ['webinar platform', 'online events', 'live streaming', 'virtual events', 'webinar hosting', 'audience engagement'],
    partner: 'WebinarGeek',
  },
};

// Content templates per partner (simplified versions for email)
const EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  'Woodpecker': {
    subject: 'Quick tip on improving cold email deliverability',
    body: `Hi {{NAME}},\n\nI noticed you might be working on scaling outreach — one thing that made a huge difference for teams I've seen is using smart sending patterns instead of generic blasts.\n\nWoodpecker automates this with human-like sequences that bypass spam filters and auto-rotate sending accounts.\n\nMight be worth a look: {{LINK}}\n\nBest,\nSignalForge Team`,
  },
  'EmailListVerify': {
    subject: 'Your bounce rate might be hurting deliverability',
    body: `Hi {{NAME}},\n\nHigh bounce rates are a silent reputation killer. Before your next campaign, running your list through EmailListVerify catches invalid emails, spam traps, and disposable addresses.\n\nTeams using it consistently see 98%+ deliverability.\n\nCheck it out: {{LINK}}\n\nBest,\nSignalForge Team`,
  },
  'Compass': {
    subject: 'Are you tracking the right eCommerce metrics?',
    body: `Hi {{NAME}},\n\nMost eCommerce teams drown in data but miss the insights that drive revenue. Compass gives you product-level analytics and channel attribution out of the box.\n\nWorth exploring: {{LINK}}\n\nBest,\nSignalForge Team`,
  },
  'AdTurbo AI': {
    subject: 'Cut your ad CPA by 40% — here\'s how',
    body: `Hi {{NAME}},\n\nIf you\'re running paid campaigns, AdTurbo AI optimizes your ROAS across all channels automatically. Teams I've seen cut their CPA by 40% in the first quarter.\n\nTake a look: {{LINK}}\n\nBest,\nSignalForge Team`,
  },
  'Lucro CRM': {
    subject: 'Your CRM should be closing deals, not just storing contacts',
    body: `Hi {{NAME}},\n\nLucro CRM brings intelligent deal scoring, automated follow-ups, and revenue forecasting that actually works. Teams see 25%+ improvement in close rates.\n\nWorth trying: {{LINK}}\n\nBest,\nSignalForge Team`,
  },
  'EasyFund': {
    subject: 'Simplify your fundraising process',
    body: `Hi {{NAME}},\n\nIf you're raising capital, EasyFund streamlines your investor pipeline, document sharing, and fundraising analytics in one place.\n\nCheck it out: {{LINK}}\n\nBest,\nSignalForge Team`,
  },
  'WebinarGeek': {
    subject: 'Webinars still convert better than anything in B2B',
    body: `Hi {{NAME}},\n\nWebinarGeek gives you a real webinar platform with registration funnels, automated replays, and engagement analytics — way beyond a basic video call.\n\nTake a look: {{LINK}}\n\nBest,\nSignalForge Team`,
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Auth: verify cron secret or admin token
  const cronSecret = req.headers.get('x-cron-secret');
  const adminToken = req.headers.get('x-admin-token');
  const expectedCron = Deno.env.get('CRON_SECRET');
  const expectedAdmin = Deno.env.get('ADMIN_API_TOKEN');
  
  if (cronSecret !== expectedCron && adminToken !== expectedAdmin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Emergency stop check
  const { data: brain } = await supabase
    .from('brain_settings')
    .select('emergency_stop, brain_enabled')
    .limit(1)
    .maybeSingle();

  if (brain?.emergency_stop || !brain?.brain_enabled) {
    return new Response(JSON.stringify({ status: 'emergency_stop_active' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch hunter settings
  const { data: settings } = await supabase
    .from('hunter_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (!settings?.monster_mode) {
    return new Response(JSON.stringify({ status: 'monster_mode_off' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const isDryRun = settings.dry_run_mode;
  const dailyLimit = settings.daily_limit || 50;

  // Reset daily counter if needed
  const lastReset = new Date(settings.last_reset_at);
  const now = new Date();
  let sendsToday = settings.sends_today || 0;
  if (now.toDateString() !== lastReset.toDateString()) {
    sendsToday = 0;
    await supabase
      .from('hunter_settings')
      .update({ sends_today: 0, last_reset_at: now.toISOString() })
      .eq('id', true);
  }

  if (sendsToday >= dailyLimit) {
    await logActivity(supabase, 'rate_limit', null, null, `Daily limit reached: ${sendsToday}/${dailyLimit}`, 'warning', isDryRun);
    return new Response(JSON.stringify({ status: 'daily_limit_reached', sends: sendsToday }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action || 'full_cycle';

    const results: any = { discovered: 0, sent: 0, skipped: 0, dry_run: isDryRun };

    // Step 1: Discover leads from demand_signals
    if (action === 'discover' || action === 'full_cycle') {
      const discovered = await discoverLeads(supabase, isDryRun);
      results.discovered = discovered;
    }

    // Step 2: Send outreach to discovered leads
    if (action === 'send' || action === 'full_cycle') {
      const { sent, skipped } = await sendOutreach(supabase, settings, isDryRun, dailyLimit - sendsToday);
      results.sent = sent;
      results.skipped = skipped;
    }

    // Update last run
    await supabase
      .from('hunter_settings')
      .update({ last_run_at: now.toISOString() })
      .eq('id', true);

    return new Response(JSON.stringify({ ok: true, ...results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Hunter error:', err);
    await logActivity(supabase, 'error', null, null, `Engine error: ${err instanceof Error ? err.message : 'unknown'}`, 'error', isDryRun);
    return new Response(JSON.stringify({ error: 'internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Discover leads from existing demand signals using AI categorization
async function discoverLeads(supabase: any, isDryRun: boolean): Promise<number> {
  // Find recent signals not yet processed by hunter
  const { data: signals } = await supabase
    .from('demand_signals')
    .select('id, query_text, source_url, payload_json, relevance_score')
    .in('status', ['new', 'approved'])
    .gte('relevance_score', 0.6)
    .order('created_at', { ascending: false })
    .limit(50);

  if (!signals || signals.length === 0) return 0;

  let discovered = 0;

  for (const signal of signals) {
    const text = (signal.query_text || '').toLowerCase();
    const payload = signal.payload_json || {};
    const author = payload.author || payload.user || payload.username;
    const email = payload.email;

    // Skip if no email/contact info
    if (!email && !author) continue;

    // Match to partner category
    let matchedCategory = '';
    let matchedPartner = '';
    for (const [cat, config] of Object.entries(CATEGORY_KEYWORDS)) {
      if (config.keywords.some(kw => text.includes(kw))) {
        matchedCategory = cat;
        matchedPartner = config.partner;
        break;
      }
    }

    if (!matchedCategory) continue;

    // Check for duplicate
    const contactId = email || `${author}@signal`;
    const { data: existing } = await supabase
      .from('auto_leads')
      .select('id')
      .eq('email', contactId)
      .limit(1)
      .maybeSingle();

    if (existing) continue;

    // Check denylist
    if (email) {
      const { data: denied } = await supabase
        .from('denylist')
        .select('id')
        .eq('value', email)
        .eq('active', true)
        .limit(1)
        .maybeSingle();

      if (denied) continue;
    }

    // Insert lead
    const { data: lead } = await supabase
      .from('auto_leads')
      .insert({
        email: contactId,
        name: author || null,
        company: payload.company || null,
        lead_category: matchedCategory,
        matched_partner: matchedPartner,
        source: 'demand_signal',
        source_url: signal.source_url,
        confidence: signal.relevance_score || 0,
        dry_run: isDryRun,
        metadata: { signal_id: signal.id, query: signal.query_text },
      })
      .select('id')
      .single();

    if (lead) {
      discovered++;
      await logActivity(supabase, 'lead_discovered', lead.id, matchedPartner,
        `Found lead "${author || email}" → ${matchedPartner} (${matchedCategory})`, 'success', isDryRun);
    }
  }

  return discovered;
}

// Send outreach emails to discovered leads
async function sendOutreach(supabase: any, settings: any, isDryRun: boolean, remainingQuota: number): Promise<{ sent: number; skipped: number }> {
  // Fetch unsent leads
  const { data: leads } = await supabase
    .from('auto_leads')
    .select('*')
    .eq('status', 'discovered')
    .order('confidence', { ascending: false })
    .limit(Math.min(remainingQuota, 20));

  if (!leads || leads.length === 0) return { sent: 0, skipped: 0 };

  // Fetch partner links
  const { data: partners } = await supabase
    .from('m2m_partners')
    .select('name, affiliate_base_url')
    .eq('is_active', true);

  const partnerLinks: Record<string, string> = {};
  (partners || []).forEach((p: any) => {
    partnerLinks[p.name] = p.affiliate_base_url;
  });

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const domain = settings.domain || 'getsignalforge.com';

  let sent = 0;
  let skipped = 0;

  for (const lead of leads) {
    const partnerName = lead.matched_partner;
    const template = EMAIL_TEMPLATES[partnerName];
    const affiliateLink = partnerLinks[partnerName];

    if (!template || !affiliateLink) {
      skipped++;
      continue;
    }

    // Skip non-email leads
    if (!lead.email || lead.email.includes('@signal')) {
      await supabase.from('auto_leads').update({ status: 'skipped' }).eq('id', lead.id);
      skipped++;
      await logActivity(supabase, 'lead_skipped', lead.id, partnerName,
        `No valid email for "${lead.name || lead.email}"`, 'warning', isDryRun);
      continue;
    }

    const personalizedBody = template.body
      .replace('{{NAME}}', lead.name || 'there')
      .replace('{{LINK}}', affiliateLink);

    if (isDryRun) {
      // Dry run: log without sending
      await supabase.from('auto_leads').update({ status: 'dry_run_ready' }).eq('id', lead.id);
      sent++;
      await logActivity(supabase, 'dry_run_send', lead.id, partnerName,
        `[DRY RUN] Would send "${template.subject}" to ${lead.email}`, 'info', true);
      continue;
    }

    // Real send via Resend
    if (!resendKey) {
      await logActivity(supabase, 'error', lead.id, partnerName,
        'RESEND_API_KEY not configured', 'error', false);
      break;
    }

    try {
      // Human-like delay (15-60s between sends)
      if (sent > 0) {
        const delay = 15000 + Math.random() * 45000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `SignalForge <outreach@${domain}>`,
          to: [lead.email],
          subject: template.subject,
          text: personalizedBody,
          headers: {
            'List-Unsubscribe': `<https://getsignalforge.com/unsubscribe?email=${encodeURIComponent(lead.email)}>`,
          },
        }),
      });

      if (emailRes.ok) {
        await supabase.from('auto_leads').update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        }).eq('id', lead.id);

        sent++;
        await logActivity(supabase, 'email_sent', lead.id, partnerName,
          `Sent "${template.subject}" to ${lead.email} → ${partnerName} offer`, 'success', false);

        // Update daily counter
        await supabase.from('hunter_settings').update({
          sends_today: (settings.sends_today || 0) + sent,
        }).eq('id', true);
      } else {
        const errText = await emailRes.text();
        await supabase.from('auto_leads').update({ status: 'failed' }).eq('id', lead.id);
        await logActivity(supabase, 'send_failed', lead.id, partnerName,
          `Send failed: ${errText}`, 'error', false);
      }
    } catch (err) {
      await supabase.from('auto_leads').update({ status: 'failed' }).eq('id', lead.id);
      await logActivity(supabase, 'send_error', lead.id, partnerName,
        `Error: ${err instanceof Error ? err.message : 'unknown'}`, 'error', false);
    }
  }

  return { sent, skipped };
}

async function logActivity(
  supabase: any,
  action: string,
  leadId: string | null,
  partnerName: string | null,
  details: string,
  status: string,
  dryRun: boolean,
) {
  await supabase.from('hunter_activity_log').insert({
    action,
    lead_id: leadId,
    partner_name: partnerName,
    details,
    status,
    dry_run: dryRun,
  });
}
