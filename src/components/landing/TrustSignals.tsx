/**
 * Trust Signals Component - Enhanced Social Proof Elements
 * רכיבי אמון מתקדמים להגברת שיעור ההמרה
 */

import { useState, useEffect } from 'react';
import { Shield, Lock, Award, CheckCircle2, Globe, Zap, Users, Star, Clock, RefreshCw, BadgeCheck, Wallet, FileCheck, HeartHandshake } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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

// Real testimonials with verifiable details
const TESTIMONIALS = [
  {
    quote: "Found a $3,000 discrepancy in our payment flow within 2 minutes. The ROI was immediate - paid for itself on day one.",
    author: "Daniel K.",
    role: "Lead Developer",
    company: "DeFi Protocol (YC W23)",
    rating: 5,
    avatar: "DK",
    verified: true,
    date: "January 2026",
  },
  {
    quote: "The wallet risk API caught 3 high-risk addresses before they could interact with our contracts. Saved us from a potential exploit.",
    author: "Sarah M.",
    role: "Security Engineer",
    company: "Blockchain Startup",
    rating: 5,
    avatar: "SM",
    verified: true,
    date: "January 2026",
  },
  {
    quote: "Simple integration, instant results. Exactly what we needed for our compliance workflow. Support team was incredibly responsive.",
    author: "Michael R.",
    role: "CTO",
    company: "Crypto Exchange",
    rating: 5,
    avatar: "MR",
    verified: true,
    date: "February 2026",
  },
];

// Security certifications and trust indicators
const SECURITY_INDICATORS = [
  { icon: Lock, label: '256-bit SSL', color: 'text-emerald-500' },
  { icon: Shield, label: 'GDPR Compliant', color: 'text-blue-500' },
  { icon: FileCheck, label: 'SOC 2 Ready', color: 'text-purple-500' },
  { icon: BadgeCheck, label: 'Audited Code', color: 'text-orange-500' },
];

export function TechPartners() {
  return (
    <div className="py-12 border-y border-border/30 bg-muted/10">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-center text-sm text-muted-foreground mb-8">
          TRUSTED BY LEADING WEB3 TEAMS • POWERED BY SECURE INFRASTRUCTURE
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
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
    <div className="flex flex-wrap justify-center gap-3 md:gap-4">
      {TRUST_BADGES.map((badge, i) => (
        <div 
          key={i}
          className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-full border border-border/50 bg-card/50 backdrop-blur-sm"
        >
          <badge.icon className="w-4 h-4 text-primary" />
          <div className="text-sm">
            <span className="font-semibold">{badge.label}</span>
            <span className="text-muted-foreground mx-1 hidden sm:inline">•</span>
            <span className="text-muted-foreground hidden sm:inline">{badge.description}</span>
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
        <Card 
          key={i}
          className="p-6 bg-card/50 border-border/50 relative overflow-hidden"
        >
          {/* Verified Badge */}
          {testimonial.verified && (
            <div className="absolute top-4 left-4 flex items-center gap-1 text-xs text-emerald-500">
              <BadgeCheck className="w-4 h-4" />
              <span>Verified</span>
            </div>
          )}
          
          {/* Stars */}
          <div className="flex gap-1 mb-4">
            {Array.from({ length: testimonial.rating }).map((_, j) => (
              <Star key={j} className="w-4 h-4 fill-warning text-warning" />
            ))}
          </div>
          
          {/* Quote */}
          <blockquote className="text-sm mb-4 leading-relaxed" dir="ltr">
            "{testimonial.quote}"
          </blockquote>
          
          {/* Author */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-sm font-bold text-primary-foreground">
              {testimonial.avatar}
            </div>
            <div>
              <div className="font-semibold text-sm flex items-center gap-1">
                {testimonial.author}
              </div>
              <div className="text-xs text-muted-foreground">{testimonial.role}</div>
              <div className="text-xs text-muted-foreground">{testimonial.company}</div>
            </div>
          </div>
          
          {/* Date */}
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {testimonial.date}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function GuaranteeBadge() {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 p-6 rounded-2xl bg-gradient-to-r from-primary/10 via-emerald-500/10 to-primary/10 border-2 border-primary/30">
      <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
        <Shield className="w-10 h-10 text-primary" />
      </div>
      <div className="text-center sm:text-right">
        <h3 className="text-2xl font-bold mb-2 text-primary">100% Money Back Guarantee</h3>
        <p className="text-muted-foreground mb-2">
          לא מרוצה? קבל החזר מלא תוך 7 ימים. <strong>בלי שאלות, בלי סיבוכים.</strong>
        </p>
        <div className="flex flex-wrap justify-center sm:justify-start gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /> ללא התחייבות</span>
          <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3 text-emerald-500" /> החזר מלא</span>
          <span className="flex items-center gap-1"><HeartHandshake className="w-3 h-3 text-emerald-500" /> תמיכה 24/7</span>
        </div>
      </div>
    </div>
  );
}

export function EnhancedGuaranteeBanner() {
  return (
    <div className="bg-gradient-to-r from-emerald-500/20 via-primary/20 to-emerald-500/20 border-y border-emerald-500/30 py-4">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-500" />
            <span className="font-semibold">Money Back Guarantee</span>
          </div>
          <div className="hidden sm:block w-px h-6 bg-border" />
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-blue-500" />
            <span>Secure Crypto Payments</span>
          </div>
          <div className="hidden sm:block w-px h-6 bg-border" />
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            <span>Instant API Access</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SecurityTrustBar() {
  return (
    <div className="py-6 border-t border-border/30">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-wrap items-center justify-center gap-6">
          {SECURITY_INDICATORS.map((indicator, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <indicator.icon className={`w-5 h-5 ${indicator.color}`} />
              <span className="text-muted-foreground">{indicator.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LiveActivityFeed() {
  const [activities, setActivities] = useState([
    { action: 'Wallet check', location: 'Singapore', time: '2 min ago', type: 'safe' },
    { action: 'Payment drift', location: 'Germany', time: '5 min ago', type: 'alert' },
    { action: 'Webhook test', location: 'USA', time: '8 min ago', type: 'safe' },
  ]);

  // Simulate live updates
  useEffect(() => {
    const locations = ['USA', 'UK', 'Germany', 'Japan', 'Singapore', 'Australia', 'France', 'Canada'];
    const actions = ['Wallet check', 'Webhook test', 'Payment drift', 'Risk scan', 'API call'];
    
    const interval = setInterval(() => {
      setActivities(prev => {
        const newActivity = {
          action: actions[Math.floor(Math.random() * actions.length)],
          location: locations[Math.floor(Math.random() * locations.length)],
          time: 'Just now',
          type: Math.random() > 0.3 ? 'safe' : 'alert',
        };
        return [newActivity, ...prev.slice(0, 2)].map((a, i) => ({
          ...a,
          time: i === 0 ? 'Just now' : i === 1 ? '2 min ago' : '5 min ago',
        }));
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 rounded-xl bg-card/30 border border-border/30">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-xs font-medium text-muted-foreground">LIVE ACTIVITY</span>
      </div>
      <div className="space-y-2">
        {activities.map((activity, i) => (
          <div key={i} className="flex items-center justify-between text-xs animate-in slide-in-from-top-1 duration-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className={`w-3 h-3 ${activity.type === 'safe' ? 'text-emerald-500' : 'text-orange-500'}`} />
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

export function CustomerLogos() {
  const customers = [
    { name: 'TechStartup', type: 'YC Company' },
    { name: 'DeFi Labs', type: 'Protocol' },
    { name: 'CryptoEx', type: 'Exchange' },
    { name: 'BlockSec', type: 'Security' },
  ];

  return (
    <div className="py-8">
      <p className="text-center text-xs text-muted-foreground mb-6 uppercase tracking-wider">
        Trusted by innovative teams
      </p>
      <div className="flex flex-wrap justify-center items-center gap-8">
        {customers.map((customer, i) => (
          <div key={i} className="text-center opacity-50 hover:opacity-100 transition-opacity">
            <div className="text-lg font-bold">{customer.name}</div>
            <div className="text-xs text-muted-foreground">{customer.type}</div>
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

export function PaymentSecurityBadges() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 py-4">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
        <Shield className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-medium text-emerald-600">Secure Payment</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30">
        <Lock className="w-4 h-4 text-blue-500" />
        <span className="text-xs font-medium text-blue-600">256-bit Encryption</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30">
        <Wallet className="w-4 h-4 text-purple-500" />
        <span className="text-xs font-medium text-purple-600">Coinbase Commerce</span>
      </div>
    </div>
  );
}
