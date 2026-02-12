/**
 * ContentForge - Marketing content templates for each partner
 * Pre-built promotional templates for LinkedIn, Twitter, WhatsApp
 * with automatic placeholder replacement
 */

export interface ContentTemplate {
  platform: 'linkedin' | 'twitter' | 'whatsapp';
  label: string;
  emoji: string;
  template: string;
}

interface PartnerContent {
  hook: string;
  valueProposition: string;
  templates: ContentTemplate[];
}

const CONTENT_TEMPLATES: Record<string, PartnerContent> = {
  woodpecker: {
    hook: 'cold email deliverability',
    valueProposition: 'automate cold outreach with human-like sending patterns that actually land in inboxes',
    templates: [
      {
        platform: 'linkedin',
        label: 'LinkedIn',
        emoji: '💼',
        template: `🚀 Struggling with cold email deliverability?\n\nI found a tool that changed everything for our outreach game.\n\nInstead of blasting generic emails, {{PARTNER_NAME}} lets you:\n\n✅ Send human-like sequences that bypass spam filters\n✅ Auto-rotate sending accounts for max deliverability\n✅ A/B test subject lines with real-time analytics\n\nOur reply rates jumped 3x in the first month.\n\nIf you're serious about outbound — check it out 👇\n{{AFFILIATE_LINK}}\n\n#ColdEmail #SalesAutomation #B2B`,
      },
      {
        platform: 'twitter',
        label: 'Twitter/X',
        emoji: '🐦',
        template: `cold email tip 🧵\n\nstop using generic templates. start using smart sequences.\n\n{{PARTNER_NAME}} helped us 3x our reply rates by:\n→ human-like sending patterns\n→ auto warmup\n→ deliverability monitoring\n\ntry it 👇\n{{AFFILIATE_LINK}}`,
      },
      {
        platform: 'whatsapp',
        label: 'WhatsApp',
        emoji: '💬',
        template: `Hey! 👋\n\nJust wanted to share something that really helped our outreach.\n\n{{PARTNER_NAME}} automates cold email with smart sending patterns — our reply rates went up 3x.\n\nWorth checking out: {{AFFILIATE_LINK}}`,
      },
    ],
  },
  emaillistverify: {
    hook: 'email list hygiene',
    valueProposition: 'verify email lists in bulk to eliminate bounces and protect sender reputation',
    templates: [
      {
        platform: 'linkedin',
        label: 'LinkedIn',
        emoji: '💼',
        template: `📧 Your email bounce rate is killing your sender reputation.\n\nBefore every campaign, I run my list through {{PARTNER_NAME}}.\n\nWhy?\n\n✅ Catches invalid emails before they bounce\n✅ Removes spam traps & disposable addresses\n✅ Keeps deliverability above 98%\n\nClean lists = better inbox placement = more revenue.\n\n{{AFFILIATE_LINK}}\n\n#EmailMarketing #Deliverability #MarketingOps`,
      },
      {
        platform: 'twitter',
        label: 'Twitter/X',
        emoji: '🐦',
        template: `your email bounce rate is destroying your sender score 📉\n\nfix it before your next campaign:\n\n{{PARTNER_NAME}} catches bad emails, spam traps, and disposables in seconds.\n\nresult: 98%+ deliverability\n\n{{AFFILIATE_LINK}}`,
      },
      {
        platform: 'whatsapp',
        label: 'WhatsApp',
        emoji: '💬',
        template: `Quick tip 💡\n\nIf you're sending email campaigns, verify your list first with {{PARTNER_NAME}}.\n\nIt removes bad emails and spam traps so your campaigns actually reach inboxes.\n\nCheck it out: {{AFFILIATE_LINK}}`,
      },
    ],
  },
  compass: {
    hook: 'eCommerce analytics',
    valueProposition: 'get actionable eCommerce insights to optimize product performance and scale revenue',
    templates: [
      {
        platform: 'linkedin',
        label: 'LinkedIn',
        emoji: '💼',
        template: `📊 Most eCommerce brands are drowning in data but starving for insights.\n\n{{PARTNER_NAME}} changed how we look at our store:\n\n✅ Real-time product performance analytics\n✅ Revenue attribution across channels\n✅ Growth opportunities you're missing\n\nIf you're scaling an online store, this is the analytics layer you need 👇\n{{AFFILIATE_LINK}}\n\n#eCommerce #Analytics #DTC #Growth`,
      },
      {
        platform: 'twitter',
        label: 'Twitter/X',
        emoji: '🐦',
        template: `most ecom brands track vanity metrics 📊\n\n{{PARTNER_NAME}} shows you what actually drives revenue:\n→ product-level analytics\n→ channel attribution\n→ growth signals\n\nstop guessing, start scaling\n{{AFFILIATE_LINK}}`,
      },
      {
        platform: 'whatsapp',
        label: 'WhatsApp',
        emoji: '💬',
        template: `Hey! 🛒\n\nIf you run an online store, check out {{PARTNER_NAME}}.\n\nIt gives you real analytics on what products and channels actually drive revenue.\n\nWay better than GA: {{AFFILIATE_LINK}}`,
      },
    ],
  },
  'adturbo ai': {
    hook: 'ad spend optimization',
    valueProposition: 'maximize ROAS with intelligent ad optimization across all channels',
    templates: [
      {
        platform: 'linkedin',
        label: 'LinkedIn',
        emoji: '💼',
        template: `💰 Tired of wasting ad budget on underperforming campaigns?\n\n{{PARTNER_NAME}} optimizes your ad spend automatically:\n\n✅ Cross-channel ROAS optimization\n✅ Smart budget allocation in real-time\n✅ Performance predictions before you spend\n\nWe cut our CPA by 40% in the first quarter.\n\n{{AFFILIATE_LINK}}\n\n#DigitalMarketing #PPC #ROAS #AdTech`,
      },
      {
        platform: 'twitter',
        label: 'Twitter/X',
        emoji: '🐦',
        template: `stop burning ad budget 🔥\n\n{{PARTNER_NAME}} optimizes your ROAS across every channel automatically.\n\nwe cut CPA by 40% — no manual tweaking.\n\n{{AFFILIATE_LINK}}`,
      },
      {
        platform: 'whatsapp',
        label: 'WhatsApp',
        emoji: '💬',
        template: `Hey! 📊\n\nWanted to share {{PARTNER_NAME}} — it optimizes your ad spend across all channels automatically.\n\nWe reduced our cost-per-acquisition by 40%.\n\nCheck it: {{AFFILIATE_LINK}}`,
      },
    ],
  },
  'lucro crm': {
    hook: 'sales pipeline management',
    valueProposition: 'streamline your sales pipeline with intelligent CRM that closes more deals',
    templates: [
      {
        platform: 'linkedin',
        label: 'LinkedIn',
        emoji: '💼',
        template: `🎯 Your CRM shouldn't just store contacts — it should close deals.\n\n{{PARTNER_NAME}} transformed our sales process:\n\n✅ Intelligent deal scoring & prioritization\n✅ Automated follow-up sequences\n✅ Revenue forecasting you can trust\n\nOur close rate improved 25% in 90 days.\n\n{{AFFILIATE_LINK}}\n\n#Sales #CRM #B2B #Revenue`,
      },
      {
        platform: 'twitter',
        label: 'Twitter/X',
        emoji: '🐦',
        template: `your CRM should close deals, not just store contacts 🎯\n\n{{PARTNER_NAME}} = smart deal scoring + auto follow-ups + real forecasting\n\nour close rate: +25% in 90 days\n\n{{AFFILIATE_LINK}}`,
      },
      {
        platform: 'whatsapp',
        label: 'WhatsApp',
        emoji: '💬',
        template: `Hey! 🎯\n\nCheck out {{PARTNER_NAME}} if you need a CRM that actually helps close deals.\n\nIt scores leads, automates follow-ups, and our close rate jumped 25%.\n\n{{AFFILIATE_LINK}}`,
      },
    ],
  },
  easyfund: {
    hook: 'fundraising management',
    valueProposition: 'simplify fundraising with tools that help you raise more, faster',
    templates: [
      {
        platform: 'linkedin',
        label: 'LinkedIn',
        emoji: '💼',
        template: `💸 Fundraising shouldn't be chaotic.\n\n{{PARTNER_NAME}} gives you:\n\n✅ Investor pipeline management\n✅ Smart document sharing & tracking\n✅ Real-time fundraising analytics\n\nWhether you're raising seed or Series B — this streamlines everything.\n\n{{AFFILIATE_LINK}}\n\n#Fundraising #Startups #VentureCapital #Finance`,
      },
      {
        platform: 'twitter',
        label: 'Twitter/X',
        emoji: '🐦',
        template: `fundraising doesn't have to be chaos 💸\n\n{{PARTNER_NAME}} = investor pipeline + doc tracking + fundraising analytics\n\nfrom seed to series B, it just works.\n\n{{AFFILIATE_LINK}}`,
      },
      {
        platform: 'whatsapp',
        label: 'WhatsApp',
        emoji: '💬',
        template: `Hey! 💰\n\nIf you're raising funds, check out {{PARTNER_NAME}}.\n\nIt organizes your investor pipeline, tracks documents, and gives you real analytics.\n\nSuper useful: {{AFFILIATE_LINK}}`,
      },
    ],
  },
  webinargeek: {
    hook: 'webinar hosting',
    valueProposition: 'host professional live and automated webinars with built-in marketing tools',
    templates: [
      {
        platform: 'linkedin',
        label: 'LinkedIn',
        emoji: '💼',
        template: `🎥 Webinars are still the #1 conversion tool for B2B — if done right.\n\n{{PARTNER_NAME}} makes it effortless:\n\n✅ Live & automated webinars\n✅ Built-in registration funnels\n✅ Engagement analytics & replay automation\n\nNo more Zoom fatigue — this is a real webinar platform.\n\n{{AFFILIATE_LINK}}\n\n#Webinars #B2B #LeadGeneration #ContentMarketing`,
      },
      {
        platform: 'twitter',
        label: 'Twitter/X',
        emoji: '🐦',
        template: `webinars still convert better than anything in B2B 🎥\n\nbut zoom calls aren't webinars.\n\n{{PARTNER_NAME}} = real webinar platform with registration funnels, replays, and analytics.\n\n{{AFFILIATE_LINK}}`,
      },
      {
        platform: 'whatsapp',
        label: 'WhatsApp',
        emoji: '💬',
        template: `Hey! 🎥\n\nIf you do webinars, {{PARTNER_NAME}} is way better than Zoom.\n\nIt has built-in registration pages, automated replays, and real engagement analytics.\n\nCheck it out: {{AFFILIATE_LINK}}`,
      },
    ],
  },
};

export function getPartnerContent(partnerName: string): PartnerContent | null {
  return CONTENT_TEMPLATES[partnerName.toLowerCase()] || null;
}

export function renderTemplate(
  template: string,
  partnerName: string,
  affiliateLink: string,
): string {
  return template
    .replace(/\{\{PARTNER_NAME\}\}/g, partnerName)
    .replace(/\{\{AFFILIATE_LINK\}\}/g, affiliateLink);
}
