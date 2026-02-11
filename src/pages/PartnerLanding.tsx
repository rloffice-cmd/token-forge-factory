import { Globe, Monitor, Radio, Shield, ArrowRight, Linkedin, Mail, Clock, Layers, BarChart3, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const PARTNERS = [
  { name: 'HubSpot', category: 'CRM & Sales' },
  { name: 'Monday.com', category: 'Workflow' },
  { name: 'Vercel', category: 'Infrastructure' },
  { name: 'Snyk', category: 'Security' },
  { name: 'Vanta', category: 'Compliance' },
];

const TRUST_ITEMS = [
  { icon: Globe, title: 'Global Coverage', desc: '30+ digital sources scanned continuously' },
  { icon: Clock, title: '24/7 Monitoring', desc: 'Real-time demand detection around the clock' },
  { icon: Layers, title: 'Multi-Platform', desc: 'Reddit, HN, Discord, Twitter & more' },
  { icon: Shield, title: 'Privacy-First', desc: 'GDPR-ready infrastructure' },
];

const METRICS = [
  { value: '30+', label: 'Signal Sources' },
  { value: '24/7', label: 'Active Monitoring' },
  { value: '<50ms', label: 'Response Time' },
  { value: '99.9%', label: 'Uptime SLA' },
];

export default function PartnerLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground" dir="ltr">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg tracking-tight">Token Forge AI</span>
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
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--gradient-glow)' }} />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-8">
            <Zap className="w-3 h-3" />
            Now accepting partner integrations
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            The Future of
            <span className="text-primary block">Demand Signaling</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Identifying high-intent leads across 30+ digital sources using advanced pattern recognition — then connecting them with the right solution, instantly.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <a href="mailto:hello@token-forge.ai">
              <Button size="lg" className="gap-2">
                <Mail className="w-4 h-4" />
                Partner With Us
              </Button>
            </a>
            <a href="#how-it-works">
              <Button variant="outline" size="lg" className="gap-2">
                Learn More
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

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

      {/* How it works */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
            Our autonomous system identifies high-intent users, matches them to your solution, and confirms revenue through real-time postback webhooks. Zero manual overhead.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: Radio,
                title: 'Autonomous Signal Detection',
                desc: 'AI continuously monitors 30+ sources (Reddit, HackerNews, Discord) to identify users expressing specific pain points. Each signal is scored for intent and urgency.',
              },
              {
                step: '02',
                icon: BarChart3,
                title: 'AI Contextual Matching',
                desc: 'Our engine matches high-intent leads to your specific product category using semantic analysis and behavioral patterns. Outreach is hyper-personalized and value-first.',
              },
              {
                step: '03',
                icon: CheckCircle2,
                title: 'Revenue Confirmation via Postback',
                desc: 'When a user converts, your API triggers our postback webhook. We instantly confirm the lead, credit your account, and schedule payment settlement.',
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
      <section className="py-24 border-t border-border/30">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">For Partners</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
            Join our network and receive pre-qualified, high-intent leads matched specifically to your product category.
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

      {/* CTA */}
      <section className="py-24 border-t border-border/30">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="glass-card p-12 glow-border">
            <h2 className="text-3xl font-bold mb-2">Ready to Partner?</h2>
            <p className="text-muted-foreground mb-3 font-medium">hello@token-forge.ai</p>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              We're onboarding select SaaS partners for our demand signaling network. Get in touch to learn more about integration, affiliate terms, and API documentation.
            </p>
            <a href="mailto:hello@token-forge.ai">
              <Button size="lg" className="gap-2">
                <Mail className="w-4 h-4" />
                Contact Us
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            <span>© 2026 Token Forge AI. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="mailto:hello@token-forge.ai" className="hover:text-foreground transition-colors">Contact</a>
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
