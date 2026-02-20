/**
 * Affiliate partner registry — maps keywords/entity_types found in decision_traces
 * to partner metadata for the monetization layer in the Activity Log.
 */

export interface AffiliatePartner {
  name: string;
  url: string;
  commission: string; // human-readable e.g. "40% Rev-share"
  commissionValue: number; // numeric % for badge colour bucketing
  category: string;
}

/** Keyword → partner. Checked against source_url, entity_type, intent, reason_codes */
export const AFFILIATE_KEYWORD_MAP: Array<{ keywords: string[]; partner: AffiliatePartner }> = [
  {
    keywords: ['email', 'outreach', 'cold', 'woodpecker'],
    partner: {
      name: 'Woodpecker',
      url: 'https://woodpecker.co/?red=ram9a0bca',
      commission: '20% Rev-share',
      commissionValue: 20,
      category: 'Email Automation',
    },
  },
  {
    keywords: ['crm', 'sales', 'lucro', 'pipeline', 'deal'],
    partner: {
      name: 'Lucro CRM',
      url: 'https://web.lucrocrm.app/?red=ram9a0bca',
      commission: '40% Rev-share',
      commissionValue: 40,
      category: 'CRM / Sales',
    },
  },
  {
    keywords: ['ad', 'roas', 'adturbo', 'ads', 'campaign', 'marketing'],
    partner: {
      name: 'AdTurbo AI',
      url: 'https://adturbo.ai/?red=ram9a0bca',
      commission: '50% Rev-share',
      commissionValue: 50,
      category: 'Marketing / ROAS',
    },
  },
  {
    keywords: ['fund', 'finance', 'fundrais', 'easyfund', 'capital'],
    partner: {
      name: 'EasyFund',
      url: 'https://easyfund.me/?red=ram9a0bca',
      commission: '30% Rev-share',
      commissionValue: 30,
      category: 'Fundraising / Finance',
    },
  },
  {
    keywords: ['ecommerce', 'shop', 'compass', 'store', 'analytics'],
    partner: {
      name: 'Compass',
      url: 'https://icompass.io/?red=ram9a0bca',
      commission: '20% Rev-share',
      commissionValue: 20,
      category: 'eCommerce Analytics',
    },
  },
  {
    keywords: ['webinar', 'webinargeek', 'event', 'workshop', 'course'],
    partner: {
      name: 'WebinarGeek',
      url: 'https://webinargeek.com/?red=ram8a0bca',
      commission: '25% Rev-share',
      commissionValue: 25,
      category: 'Webinar Platforms',
    },
  },
  {
    keywords: ['verify', 'email list', 'emaillist', 'list clean', 'bounce'],
    partner: {
      name: 'EmailListVerify',
      url: 'https://www.emaillistverify.com/?red=ram6a0bca',
      commission: '15% Rev-share',
      commissionValue: 15,
      category: 'Email Verification',
    },
  },
];

/** Resolve a partner for a given trace based on fuzzy keyword matching */
export function resolveAffiliate(haystack: string): AffiliatePartner | null {
  const lower = haystack.toLowerCase();
  for (const entry of AFFILIATE_KEYWORD_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.partner;
    }
  }
  return null;
}

/** Badge colour class based on commission value */
export function commissionBadgeStyle(commissionValue: number): {
  bg: string;
  text: string;
  glow: string;
} {
  if (commissionValue >= 40)
    return {
      bg: 'bg-[hsl(160_84%_39%/0.15)]',
      text: 'text-[hsl(160_84%_39%)]',
      glow: '0 0 6px hsl(160 84% 39% / 0.5)',
    };
  if (commissionValue >= 25)
    return {
      bg: 'bg-[hsl(38_92%_50%/0.15)]',
      text: 'text-[hsl(38_92%_50%)]',
      glow: '0 0 6px hsl(38 92% 50% / 0.5)',
    };
  return {
    bg: 'bg-[hsl(199_89%_48%/0.15)]',
    text: 'text-[hsl(199_89%_48%)]',
    glow: '0 0 6px hsl(199 89% 48% / 0.5)',
  };
}
