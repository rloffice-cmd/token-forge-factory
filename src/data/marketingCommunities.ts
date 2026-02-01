/**
 * Marketing Communities Database
 * רשימת קהילות לשיווק אקטיבי - Discord, Telegram, Reddit, Twitter
 */

export interface Community {
  name: string;
  platform: 'discord' | 'telegram' | 'reddit' | 'twitter' | 'forum';
  url: string;
  members: string;
  relevance: 'high' | 'medium' | 'low';
  focus: string[];
  notes: string;
  bestTimeToPost?: string;
  rules?: string;
}

export const DISCORD_COMMUNITIES: Community[] = [
  {
    name: 'Ethereum',
    platform: 'discord',
    url: 'https://discord.gg/ethereum',
    members: '150K+',
    relevance: 'high',
    focus: ['Ethereum', 'DeFi', 'Smart Contracts'],
    notes: 'הקהילה הגדולה ביותר. יש channel ל-developers',
    bestTimeToPost: 'UTC 14:00-20:00',
    rules: 'אין spam, רק תוכן שימושי',
  },
  {
    name: 'OpenZeppelin',
    platform: 'discord',
    url: 'https://discord.gg/openzeppelin',
    members: '30K+',
    relevance: 'high',
    focus: ['Security', 'Smart Contracts', 'Audits'],
    notes: 'מפתחי אבטחה - קהל יעד מושלם',
    rules: 'מותר לשתף כלים שימושיים',
  },
  {
    name: 'Chainlink',
    platform: 'discord',
    url: 'https://discord.gg/chainlink',
    members: '50K+',
    relevance: 'medium',
    focus: ['Oracles', 'DeFi', 'Data'],
    notes: 'מפתחים שעובדים עם נתונים חיצוניים',
  },
  {
    name: 'Safe (Gnosis)',
    platform: 'discord',
    url: 'https://discord.gg/safe',
    members: '20K+',
    relevance: 'high',
    focus: ['Multi-sig', 'Treasury', 'Security'],
    notes: 'קהל יעד מדויק - מנהלי Treasury',
  },
  {
    name: 'Base',
    platform: 'discord',
    url: 'https://discord.gg/base',
    members: '100K+',
    relevance: 'high',
    focus: ['Base L2', 'Coinbase', 'DeFi'],
    notes: 'הרשת שאנחנו עובדים עליה',
  },
  {
    name: 'DeFi Llama',
    platform: 'discord',
    url: 'https://discord.gg/defillama',
    members: '25K+',
    relevance: 'medium',
    focus: ['DeFi', 'Analytics', 'TVL'],
    notes: 'אנליסטים ופרוטוקולים',
  },
];

export const TELEGRAM_COMMUNITIES: Community[] = [
  {
    name: 'DeFi Israel 🇮🇱',
    platform: 'telegram',
    url: 'https://t.me/DeFiIsrael',
    members: '5K+',
    relevance: 'high',
    focus: ['DeFi', 'Hebrew', 'Israel'],
    notes: 'קהילה ישראלית - שפה משותפת',
  },
  {
    name: 'Ethereum Developers',
    platform: 'telegram',
    url: 'https://t.me/ethereumdev',
    members: '15K+',
    relevance: 'high',
    focus: ['Ethereum', 'Development', 'Solidity'],
    notes: 'מפתחי Ethereum פעילים',
  },
  {
    name: 'DeFi Million',
    platform: 'telegram',
    url: 'https://t.me/defimillion',
    members: '40K+',
    relevance: 'medium',
    focus: ['DeFi', 'Yield', 'Trading'],
    notes: 'יותר מסחר, פחות פיתוח',
  },
  {
    name: 'Crypto Security',
    platform: 'telegram',
    url: 'https://t.me/cryptosecurity',
    members: '8K+',
    relevance: 'high',
    focus: ['Security', 'Hacks', 'Protection'],
    notes: 'אנשי אבטחה - קהל יעד מושלם',
  },
  {
    name: 'Smart Contract Auditors',
    platform: 'telegram',
    url: 'https://t.me/scauditors',
    members: '3K+',
    relevance: 'high',
    focus: ['Audits', 'Security', 'Code Review'],
    notes: 'אודיטורים - יכולים להמליץ ללקוחות',
  },
];

export const REDDIT_COMMUNITIES: Community[] = [
  {
    name: 'r/ethereum',
    platform: 'reddit',
    url: 'https://reddit.com/r/ethereum',
    members: '2M+',
    relevance: 'high',
    focus: ['Ethereum', 'DeFi', 'Development'],
    notes: 'הקהילה הכי גדולה',
    rules: 'אין self-promotion ישיר',
  },
  {
    name: 'r/ethdev',
    platform: 'reddit',
    url: 'https://reddit.com/r/ethdev',
    members: '150K+',
    relevance: 'high',
    focus: ['Development', 'Solidity', 'Tools'],
    notes: 'מפתחים בלבד - מושלם',
  },
  {
    name: 'r/defi',
    platform: 'reddit',
    url: 'https://reddit.com/r/defi',
    members: '300K+',
    relevance: 'medium',
    focus: ['DeFi', 'Yield', 'Protocols'],
    notes: 'מעורב - גם משקיעים וגם מפתחים',
  },
  {
    name: 'r/CryptoSecurity',
    platform: 'reddit',
    url: 'https://reddit.com/r/CryptoSecurity',
    members: '20K+',
    relevance: 'high',
    focus: ['Security', 'Scams', 'Protection'],
    notes: 'אנשי אבטחה',
  },
];

export const TWITTER_ACCOUNTS: Community[] = [
  {
    name: '@ethereum',
    platform: 'twitter',
    url: 'https://twitter.com/ethereum',
    members: '3M+',
    relevance: 'medium',
    focus: ['Ethereum', 'News', 'Updates'],
    notes: 'לעקוב ולהגיב על פוסטים רלוונטיים',
  },
  {
    name: '@samczsun',
    platform: 'twitter',
    url: 'https://twitter.com/samczsun',
    members: '500K+',
    relevance: 'high',
    focus: ['Security', 'Hacks', 'Research'],
    notes: 'מומחה אבטחה מוביל - להגיב על פוסטים שלו',
  },
  {
    name: '@base',
    platform: 'twitter',
    url: 'https://twitter.com/base',
    members: '1M+',
    relevance: 'high',
    focus: ['Base', 'Coinbase', 'L2'],
    notes: 'הרשת שאנחנו עובדים עליה',
  },
  {
    name: '@safe',
    platform: 'twitter',
    url: 'https://twitter.com/safe',
    members: '200K+',
    relevance: 'high',
    focus: ['Multi-sig', 'Treasury', 'Security'],
    notes: 'קהל יעד מדויק',
  },
];

export const FORUMS: Community[] = [
  {
    name: 'Ethereum Magicians',
    platform: 'forum',
    url: 'https://ethereum-magicians.org/',
    members: '10K+',
    relevance: 'medium',
    focus: ['EIPs', 'Standards', 'Development'],
    notes: 'דיונים טכניים ברמה גבוהה',
  },
  {
    name: 'ETHResearch',
    platform: 'forum',
    url: 'https://ethresear.ch/',
    members: '5K+',
    relevance: 'low',
    focus: ['Research', 'Theory', 'Scaling'],
    notes: 'מחקר - פחות רלוונטי למוצר',
  },
];

// Summary by priority
export const PRIORITY_COMMUNITIES = {
  immediate: [
    // Start here - highest conversion potential
    'Safe Discord',
    'OpenZeppelin Discord',
    'Base Discord',
    'DeFi Israel Telegram',
    'r/ethdev',
  ],
  secondary: [
    // Next wave
    'Ethereum Discord',
    'Smart Contract Auditors Telegram',
    'r/ethereum',
    '@samczsun Twitter',
  ],
  long_term: [
    // Content marketing
    'Chainlink Discord',
    'DeFi Llama Discord',
    'r/defi',
  ],
};

// Outreach templates per platform
export const OUTREACH_TEMPLATES = {
  discord: {
    intro: `Hey! Built a small API that checks wallet risk scores before transactions. Found it useful when we got hit by a bad actor last month. Free trial available if anyone wants to test: [link]`,
    helpful_reply: `Had the same issue. We started using an API to pre-screen wallets - caught 3 risky addresses last week. Happy to share if helpful.`,
  },
  telegram: {
    intro: `שלום! בניתי API שבודק סיכון ארנקים לפני טרנזקציות. אחרי שנתקענו עם ארנק בעייתי, החלטתי לבנות כלי שימנע את זה. יש Free Trial למי שרוצה לנסות.`,
    helpful_reply: `היה לי בדיוק את אותו הדבר. התחלתי לבדוק ארנקים לפני כל אינטראקציה - חסך לי כבר כמה כאבי ראש.`,
  },
  reddit: {
    post_title: `[Tool] Built a wallet risk-check API after getting burned by a bad actor`,
    post_body: `Last month we had an incident where a wallet we interacted with turned out to be linked to a mixer. Since then, I built a simple API that gives risk scores for wallets before transactions.\n\nFree trial available, no credit card needed. Would love feedback from other devs.\n\n[link to landing page]`,
  },
  twitter: {
    thread: [
      `🔍 Just shipped a wallet risk-check API.\n\nAfter getting burned by a bad actor last month, I built this for our own use.\n\nNow opening it up. Free trial, no CC required.\n\nThread on why this matters 👇`,
      `The problem: You interact with a wallet. Later you find out it was linked to a mixer, or sanctioned, or part of a phishing ring.\n\nBy then it's too late. Your reputation is tied to that address on-chain forever.`,
      `The solution: Check before you interact.\n\nOne API call. 47ms response. Risk score 0-100 + flags.\n\n$0.02 per call after the free trial.`,
      `Try it free: [link]\n\nNo credit card. 10 free calls.\n\nBuilt on Base. Payments via Coinbase Commerce.\n\nFeedback welcome 🙏`,
    ],
  },
};

// Action items for the user
export const ACTION_ITEMS = [
  {
    priority: 1,
    action: 'הצטרף ל-5 קהילות עדיפות גבוהה',
    communities: PRIORITY_COMMUNITIES.immediate,
    time: '30 דקות',
  },
  {
    priority: 2,
    action: 'פרסם את הפוסט הראשון ב-r/ethdev',
    template: OUTREACH_TEMPLATES.reddit,
    time: '15 דקות',
  },
  {
    priority: 3,
    action: 'שלח הודעה ב-DeFi Israel',
    template: OUTREACH_TEMPLATES.telegram.intro,
    time: '5 דקות',
  },
  {
    priority: 4,
    action: 'פרסם Thread ב-Twitter',
    template: OUTREACH_TEMPLATES.twitter.thread,
    time: '20 דקות',
  },
];
