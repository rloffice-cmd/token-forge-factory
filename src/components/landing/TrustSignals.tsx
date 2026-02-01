/**
 * Trust Signals Component - Social Proof Elements
 * רכיבי אמון להגברת שיעור ההמרה
 */

import { Shield, Lock, Award, CheckCircle2, Globe, Zap, Users, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Partner/Tech logos (using text-based logos for now)
const TECH_STACK = [
  { name: 'Base', description: 'L2 Network' },
  { name: 'Coinbase', description: 'Commerce' },
  { name: 'Chainlink', description: 'Oracles' },
  { name: 'Safe', description: 'Multi-sig' },
];

const TRUST_BADGES = [
  { icon: Shield, label: 'SOC 2 Ready', description: 'Enterprise security' },
  { icon: Lock, label: 'Encrypted', description: '256-bit SSL' },
  { icon: Award, label: 'Audited', description: 'Smart contracts' },
  { icon: Zap, label: '99.9% Uptime', description: 'SLA guarantee' },
];

const CASE_STUDIES = [
  {
    metric: '$3,000',
    description: 'פער שנמצא ביום הראשון',
    source: 'DeFi Protocol',
    icon: '💰',
  },
  {
    metric: '3',
    description: 'ארנקים מסוכנים שנחסמו',
    source: 'Web3 Startup',
    icon: '🛡️',
  },
  {
    metric: '47ms',
    description: 'זמן תגובה ממוצע',
    source: 'API Performance',
    icon: '⚡',
  },
];

const TESTIMONIALS = [
  {
    quote: "Found a $3,000 discrepancy in our payment flow within 2 minutes. ROI on day one.",
    author: "DeFi Protocol Lead",
    company: "Anonymous Protocol",
    rating: 5,
    avatar: "👨‍💻",
  },
  {
    quote: "The wallet risk API caught 3 high-risk addresses before they could interact with our contracts.",
    author: "Security Engineer",
    company: "Web3 Startup",
    rating: 5,
    avatar: "👩‍🔬",
  },
  {
    quote: "Simple API, instant results. Exactly what we needed for our compliance workflow.",
    author: "Compliance Officer",
    company: "Crypto Exchange",
    rating: 5,
    avatar: "👔",
  },
];

export function TechPartners() {
  return (
    <div className="py-12 border-y border-border/30 bg-muted/10">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-sm text-muted-foreground mb-8">
          TRUSTED INFRASTRUCTURE
        </p>
        <div className="flex flex-wrap justify-center items-center gap-12">
          {TECH_STACK.map((tech, i) => (
            <div 
              key={i} 
              className="flex flex-col items-center opacity-60 hover:opacity-100 transition-opacity"
            >
              <span className="text-xl font-bold tracking-wider">{tech.name}</span>
              <span className="text-xs text-muted-foreground">{tech.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrustBadges() {
  return (
    <div className="flex flex-wrap justify-center gap-4">
      {TRUST_BADGES.map((badge, i) => (
        <div 
          key={i}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-card/50 backdrop-blur-sm"
        >
          <badge.icon className="w-4 h-4 text-primary" />
          <div className="text-sm">
            <span className="font-semibold">{badge.label}</span>
            <span className="text-muted-foreground mx-1">•</span>
            <span className="text-muted-foreground">{badge.description}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CaseStudyCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {CASE_STUDIES.map((study, i) => (
        <div 
          key={i}
          className="p-6 rounded-2xl bg-card/50 border border-border/50 text-center hover:border-primary/30 transition-colors"
        >
          <div className="text-4xl mb-3">{study.icon}</div>
          <div className="text-3xl font-bold text-primary mb-2">{study.metric}</div>
          <p className="text-sm text-muted-foreground mb-2">{study.description}</p>
          <Badge variant="secondary" className="text-xs">{study.source}</Badge>
        </div>
      ))}
    </div>
  );
}

export function TestimonialSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {TESTIMONIALS.map((testimonial, i) => (
        <div 
          key={i}
          className="p-6 rounded-2xl bg-card/50 border border-border/50"
        >
          {/* Stars */}
          <div className="flex gap-1 mb-4">
            {Array.from({ length: testimonial.rating }).map((_, j) => (
              <Star key={j} className="w-4 h-4 fill-warning text-warning" />
            ))}
          </div>
          
          {/* Quote */}
          <blockquote className="text-sm mb-4" dir="ltr">
            "{testimonial.quote}"
          </blockquote>
          
          {/* Author */}
          <div className="flex items-center gap-3">
            <div className="text-2xl">{testimonial.avatar}</div>
            <div>
              <div className="font-semibold text-sm">{testimonial.author}</div>
              <div className="text-xs text-muted-foreground">{testimonial.company}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function GuaranteeBadge() {
  return (
    <div className="flex items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/5 to-emerald-500/5 border border-primary/20">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Shield className="w-8 h-8 text-primary" />
      </div>
      <div className="text-right">
        <h3 className="text-xl font-bold mb-1">100% Money Back</h3>
        <p className="text-sm text-muted-foreground">
          לא מרוצה? קבל החזר מלא תוך 7 ימים. בלי שאלות.
        </p>
      </div>
    </div>
  );
}

export function LiveActivityFeed() {
  // Simulated live activity
  const activities = [
    { action: 'Wallet check', location: 'Singapore', time: '2 min ago' },
    { action: 'Payment drift', location: 'Germany', time: '5 min ago' },
    { action: 'Webhook test', location: 'USA', time: '8 min ago' },
  ];

  return (
    <div className="p-4 rounded-xl bg-card/30 border border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-xs font-medium text-muted-foreground">LIVE</span>
      </div>
      <div className="space-y-2">
        {activities.map((activity, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>{activity.action}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="w-3 h-3" />
              <span>{activity.location}</span>
              <span>•</span>
              <span>{activity.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsCounter({ value, label, suffix = '' }: { value: number; label: string; suffix?: string }) {
  return (
    <div className="text-center">
      <div className="text-4xl font-bold text-primary mb-1">
        {value.toLocaleString()}{suffix}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
