import { Globe, Radio, Shield, ArrowRight, Linkedin, Clock, Layers, BarChart3, Zap, CheckCircle2, Brain, Target, Sparkles, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { VaultTicker } from '@/components/VaultTicker';


const PARTNERS = [
  { name: 'HubSpot', category: 'CRM & Sales' },
  { name: 'Monday.com', category: 'Workflow' },
  { name: 'Vercel', category: 'Infrastructure' },
  { name: 'Snyk', category: 'Security' },
  { name: 'Vanta', category: 'Compliance' },
];

const TRUST_ITEMS = [
  { icon: Globe, title: 'כיסוי סיגנל גלובלי', desc: '30+ digital ecosystems under continuous semantic analysis' },
  { icon: Clock, title: 'מעקב מתמיד', desc: 'Round-the-clock intent scoring and demand classification' },
  { icon: Layers, title: 'Multi-Source Synthesis', desc: 'Reddit, HN, Discord, Twitter & professional communities' },
  { icon: Shield, title: 'תאימות ארגונית', desc: 'GDPR-ready infrastructure with SOC 2 readiness' },
];

const METRICS = [
  { value: '30+', label: 'מקורות סיגנל' },
  { value: '24/7', label: 'ניתוח מתמיד' },
  { value: '<50ms', label: 'זמן עיבוד AI' },
  { value: '99.9%', label: 'זמינות SLA' },
];

const GROWTH_DRIVERS = [
  {
    icon: Brain,
    title: 'זיהוי כוונה קונטקסטואלית',
    desc: 'Our proprietary scoring engine identifies transactional demand within professional communities — distinguishing genuine purchase intent from informational queries with 94% precision.',
  },
  {
    icon: Target,
    title: 'Value-First Outreach',
    desc: 'Every touchpoint delivers standalone technical insight before any recommendation. This builds authority and trust, resulting in 3x higher engagement versus traditional affiliate methods.',
  },
  {
    icon: Sparkles,
    title: 'נתיבי המרה מוסמכים',
    desc: 'We map verified pain points to premium SaaS solutions through semantic matching. Each lead is pre-qualified, ensuring your sales team receives only high-probability conversion opportunities.',
  },
];

export default function PartnerLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground" dir="ltr">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg tracking-tight">SignalForge</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/search/results/all/?keywords=token%20forge%20ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Linkedin className="w-5 h-5" />
            </a>
            <Link to="/login">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowRight className="w-3 h-3" />
                Partner Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Multi-layer neon glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-glow)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-neon-cyan)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-neon-violet)' }} />

        {/* Pulsing neon orbs */}
        <div className="absolute top-20 left-1/4 w-64 h-64 rounded-full opacity-20 animate-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(185 90% 50% / 0.3), transparent 70%)' }} />
        <div className="absolute bottom-10 right-1/4 w-48 h-48 rounded-full opacity-15 animate-pulse pointer-events-none" style={{ background: 'radial-gradient(circle, hsl(270 80% 60% / 0.3), transparent 70%)', animationDelay: '1s' }} />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-8">
            <Activity className="w-3 h-3 animate-pulse" />
            Live Signal Scanning Active
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            The Global Standard for
            <span className="text-primary block">איתות ביקוש אוטונומי</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            We synthesize high-intent demand signals from 30+ digital ecosystems and connect them to the world's leading SaaS solutions through precision lead matching.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/login">
              <Button size="lg" className="gap-2">
                <ArrowRight className="w-4 h-4" />
                Request Lead Access
              </Button>
            </Link>
            <a href="#how-we-drive-growth">
              <Button variant="outline" size="lg" className="gap-2">
                Our Methodology
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Live from the Vault Ticker */}
      <VaultTicker />

      {/* Metrics bar */}
      <section className="border-y border-border/30 bg-card/30 backdrop-blur-sm py-10">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {METRICS.map((m, i) => (
            <div key={i} className="text-center">
              <div className="text-3xl font-bold text-primary mb-1">{m.value}</div>
              <div className="text-sm text-muted-foreground">{m.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Trust Bar - Partner Integrations */}
      <section className="py-8 border-b border-border/30 bg-card/20">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs text-muted-foreground uppercase tracking-wider mb-6">
            Integrated with industry leaders
          </p>
          <div className="flex flex-wrap justify-center items-center gap-6 md:gap-10">
            {PARTNERS.map((p, i) => (
              <div key={i} className="text-center">
                <div className="font-medium text-sm mb-1">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.category}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How We Drive Growth */}
      <section id="how-we-drive-growth" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-neon-cyan)' }} />
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <h2 className="text-3xl font-bold text-center mb-4">איך אנחנו מניעים צמיחה</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
            A three-pillar methodology engineered for predictable, high-quality lead generation at scale.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {GROWTH_DRIVERS.map((item, i) => (
              <div key={i} className="glass-card p-8 text-center group hover:glow-border transition-all duration-300 relative overflow-hidden">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'var(--gradient-neon-violet)' }} />
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition-colors" style={{ boxShadow: 'var(--shadow-neon-cyan)' }}>
                    <item.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 border-t border-border/30">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">ארכיטקטורה טכנית</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
            From signal ingestion to revenue confirmation — a fully autonomous pipeline with zero manual overhead.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: Radio,
                title: 'קליטת סיגנל סמנטי',
                desc: 'Our scoring engine continuously monitors 30+ digital ecosystems, applying linguistic DNA analysis and pain-point mapping to extract high-confidence demand signals.',
              },
              {
                step: '02',
                icon: BarChart3,
                title: 'סינתזת לידים מדויקת',
                desc: 'Qualified signals are matched to partner product categories through multi-dimensional semantic analysis, tech stack detection, and behavioral intent profiling.',
              },
              {
                step: '03',
                icon: CheckCircle2,
                title: 'אישור הכנסה Postback',
                desc: 'Conversions are verified through real-time postback webhooks. Leads are credited, commissions recorded, and settlement cycles automated end-to-end.',
              },
            ].map((item, i) => (
              <div key={i} className="glass-card p-8 text-center group hover:glow-border transition-all duration-300">
                <div className="text-xs text-primary font-mono mb-4">{item.step}</div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For Partners */}
      <section className="py-24 border-t border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-neon-violet)' }} />
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <h2 className="text-3xl font-bold text-center mb-4">לשותפים</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
            Vetted, high-quality technical leads from across the internet — pre-scored, pre-matched, and delivered in real-time. No noise. Only verified demand.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TRUST_ITEMS.map((item, i) => (
              <div key={i} className="glass-card p-6 text-center">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Powered By - Tech Stack */}
      <section className="py-24 border-t border-border/30 bg-card/10">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs text-muted-foreground uppercase tracking-wider mb-10">
            Powered by Industry Standards
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            {[
              { name: 'אינטליגנציה סמנטית', icon: '🧠', desc: 'NLP & Intent Scoring' },
              { name: 'תשתית ענן', icon: '☁️', desc: 'Enterprise Grade' },
              { name: 'אבטחה ראשית', icon: '🔒', desc: 'GDPR Compliant' },
              { name: 'Real-Time Processing', icon: '⚡', desc: 'Sub-50ms Latency' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="text-4xl mb-2">{item.icon}</div>
                <div className="text-sm font-semibold">{item.name}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border/30 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-neon-cyan)' }} />
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <div className="glass-card p-12 glow-border">
            <h2 className="text-3xl font-bold mb-4">מוכן לשדרג את הצינור שלך?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              We're selectively onboarding SaaS partners into our demand signaling network. Access pre-qualified leads, real-time conversion tracking, and transparent commission settlement.
            </p>
            <Link to="/login">
              <Button size="lg" className="gap-2">
                <ArrowRight className="w-4 h-4" />
                Partner Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            <span>© 2026 SignalForge. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="mailto:hello@token-forge.ai" className="hover:text-foreground transition-colors">צור קשר</a>
            <a
              href="https://www.linkedin.com/search/results/all/?keywords=token%20forge%20ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-2"
            >
              <Linkedin className="w-4 h-4" />
              LinkedIn
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
