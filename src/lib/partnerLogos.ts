/**
 * Partner logo mappings using high-quality placeholder initials
 * These render as styled avatar badges in the UI
 */

export interface PartnerBrand {
  name: string;
  initials: string;
  color: string; // HSL tailwind-compatible
  category: string;
}

export const PARTNER_BRANDS: Record<string, PartnerBrand> = {
  'woodpecker': {
    name: 'Woodpecker',
    initials: 'WP',
    color: 'hsl(142, 71%, 45%)',
    category: 'Email Automation',
  },
  'emaillistverify': {
    name: 'EmailListVerify',
    initials: 'EV',
    color: 'hsl(210, 79%, 46%)',
    category: 'Email Verification',
  },
  'compass': {
    name: 'Compass',
    initials: 'CO',
    color: 'hsl(262, 83%, 58%)',
    category: 'eCommerce Analytics',
  },
  'adturbo ai': {
    name: 'AdTurbo AI',
    initials: 'AT',
    color: 'hsl(350, 89%, 60%)',
    category: 'Marketing / ROAS',
  },
  'lucro crm': {
    name: 'Lucro CRM',
    initials: 'LC',
    color: 'hsl(38, 92%, 50%)',
    category: 'CRM / Sales',
  },
  'easyfund': {
    name: 'EasyFund',
    initials: 'EF',
    color: 'hsl(170, 70%, 45%)',
    category: 'Fundraising / Finance',
  },
  'webinargeek': {
    name: 'WebinarGeek',
    initials: 'WG',
    color: 'hsl(280, 68%, 55%)',
    category: 'Webinar Platforms',
  },
  'snyk': {
    name: 'Snyk',
    initials: 'SN',
    color: 'hsl(255, 50%, 50%)',
    category: 'Cybersecurity / DevTools',
  },
};

export function getPartnerBrand(name: string): PartnerBrand | null {
  return PARTNER_BRANDS[name.toLowerCase()] || null;
}
