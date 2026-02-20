/**
 * /research/[slug] — Public SEO Forensic Report Page
 * Renders a full investigation page for each research finding.
 * Optimised for SEO: semantic HTML, meta tags injected via document, structured data.
 */

import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowUpRight, ArrowLeft, ShieldCheck, Radio, Clock, ExternalLink,
  TrendingUp, AlertTriangle, Eye, CheckCircle2, XCircle, Activity,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { commissionBadgeStyle } from '@/lib/affiliatePartners';

// ─── Types ──────────────────────────────────────────────────────────────────

interface EvidenceItem {
  timestamp: string;
  source: string;
  signal: string;
  intent: string;
  trust_score: number;
}

interface ResearchFinding {
  id: string;
  slug: string;
  title: string;
  summary: string;
  verdict: string;
  confidence: number;
  evidence: EvidenceItem[];
  source_url: string | null;
  platform: string | null;
  entity_type: string | null;
  affiliate_partner: string | null;
  affiliate_url: string | null;
  affiliate_commission: string | null;
  meta_description: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function verdictConfig(verdict: string): { label: string; color: string; glow: string; Icon: typeof ShieldCheck } {
  switch (verdict) {
    case 'VERIFIED':
      return { label: 'VERIFIED', color: 'text-[hsl(160_84%_39%)]', glow: '0 0 16px hsl(160 84% 39% / 0.6)', Icon: ShieldCheck };
    case 'REJECTED':
      return { label: 'REJECTED', color: 'text-[hsl(0_72%_51%)]', glow: '0 0 16px hsl(0 72% 51% / 0.6)', Icon: XCircle };
    case 'MONITORING':
      return { label: 'MONITORING', color: 'text-[hsl(270_80%_60%)]', glow: '0 0 16px hsl(270 80% 60% / 0.6)', Icon: Eye };
    default:
      return { label: verdict, color: 'text-[hsl(199_89%_48%)]', glow: '0 0 16px hsl(199 89% 48% / 0.6)', Icon: Activity };
  }
}

function intentColor(intent: string) {
  if (intent === 'BUYING_SIGNAL') return 'text-[hsl(160_84%_39%)]';
  if (intent === 'ACTIVE_PAIN') return 'text-[hsl(38_92%_50%)]';
  return 'text-[hsl(199_89%_48%)]';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Circular Confidence Gauge ────────────────────────────────────────────────

function ConfidenceGauge({ value }: { value: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;
  const color = value >= 80 ? 'hsl(160 84% 39%)' : value >= 60 ? 'hsl(38 92% 50%)' : 'hsl(0 72% 51%)';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          {/* Track */}
          <circle cx="64" cy="64" r={radius} fill="none" stroke="hsl(222 47% 12%)" strokeWidth="10" />
          {/* Progress */}
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold font-mono" style={{ color, textShadow: `0 0 12px ${color}` }}>
            {value}
          </span>
          <span className="text-xs text-muted-foreground font-mono">/100</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-mono tracking-widest">CONFIDENCE SCORE</span>
    </div>
  );
}

// ─── Affiliate Action CTA ────────────────────────────────────────────────────

function AffiliateActionCTA({
  partner,
  url,
  commission,
}: {
  partner: string;
  url: string;
  commission: string | null;
}) {
  const commissionValue = parseInt((commission ?? '0').replace(/\D/g, ''), 10);
  const style = commissionBadgeStyle(commissionValue);

  return (
    <div
      className="rounded-xl border border-[hsl(160_84%_39%/0.35)] bg-[hsl(160_84%_39%/0.06)] p-8 text-center relative overflow-hidden"
      style={{ boxShadow: '0 0 40px hsl(160 84% 39% / 0.12)' }}
    >
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(160 84% 39%) 3px, hsl(160 84% 39%) 4px)',
        }}
      />

      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground tracking-widest">OPPORTUNITY_DETECTED</span>
          {commission && (
            <span
              className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-bold', style.bg, style.text)}
              style={{ textShadow: style.glow }}
            >
              <TrendingUp className="w-3 h-3" />
              {commission}
            </span>
          )}
        </div>

        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Based on verified market demand, <strong className="text-foreground">{partner}</strong> is the recommended solution for this signal cluster.
        </p>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center justify-center gap-3 w-full max-w-sm mx-auto',
            'px-8 py-5 rounded-xl font-bold text-lg tracking-wide',
            'bg-[hsl(160_84%_39%)] text-[hsl(222_47%_6%)]',
            'hover:bg-[hsl(160_84%_46%)] active:scale-[0.98]',
            'transition-all duration-200',
          )}
          style={{ boxShadow: '0 0 32px hsl(160 84% 39% / 0.5), 0 4px 24px hsl(160 84% 39% / 0.3)' }}
        >
          <ArrowUpRight className="w-5 h-5" />
          Get Started via {partner}
        </a>

        <p className="text-[10px] text-muted-foreground/60 font-mono">
          AFFILIATE_LINK · COMMISSION_TRACKED · VERIFIED_PARTNER
        </p>
      </div>
    </div>
  );
}

// ─── Evidence Timeline ───────────────────────────────────────────────────────

function EvidenceTimeline({ items }: { items: EvidenceItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-lg border border-[hsl(160_84%_39%/0.15)] bg-[hsl(222_47%_6%)] p-4 font-mono text-xs"
        >
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-muted-foreground/60">
              {new Date(item.timestamp).toISOString().replace('T', ' ').slice(0, 19)}Z
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-[hsl(199_89%_48%)]">{item.source}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className={cn('font-bold tracking-widest text-[10px]', intentColor(item.intent))}>
              [{item.intent}]
            </span>
            <span className="ml-auto text-muted-foreground/60">
              trust={item.trust_score?.toFixed(2)}
            </span>
          </div>
          <p className="text-foreground/80 leading-relaxed">&ldquo;{item.signal}&rdquo;</p>
        </div>
      ))}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="min-h-screen bg-background animate-pulse">
      <div className="max-w-4xl mx-auto px-6 pt-32 space-y-8">
        <div className="h-6 w-32 bg-muted rounded" />
        <div className="h-12 w-3/4 bg-muted rounded" />
        <div className="h-4 w-full bg-muted rounded" />
        <div className="h-4 w-2/3 bg-muted rounded" />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ResearchFindingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: finding, isLoading, isError } = useQuery<ResearchFinding>({
    queryKey: ['research-finding', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('research_findings')
        .select('*')
        .eq('slug', slug!)
        .eq('is_published', true)
        .single();
      if (error) throw error;
      return { ...data, evidence: Array.isArray(data.evidence) ? data.evidence : JSON.parse(data.evidence as unknown as string) };
    },
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });

  // SEO meta injection
  useEffect(() => {
    if (!finding) return;
    document.title = `${finding.title} | SignalForge Forensic Report`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', finding.meta_description ?? finding.summary);
    else {
      const tag = document.createElement('meta');
      tag.name = 'description';
      tag.content = finding.meta_description ?? finding.summary;
      document.head.appendChild(tag);
    }
    // JSON-LD structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: finding.title,
      description: finding.summary,
      datePublished: finding.created_at,
      publisher: { '@type': 'Organization', name: 'SignalForge' },
    });
    script.id = 'research-ld-json';
    document.querySelector('#research-ld-json')?.remove();
    document.head.appendChild(script);
  }, [finding]);

  if (isLoading) return <Skeleton />;

  if (isError || !finding) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
        <AlertTriangle className="w-16 h-16 text-destructive mb-6" />
        <h1 className="text-3xl font-bold mb-4">Finding Not Found</h1>
        <p className="text-muted-foreground mb-8">This forensic report doesn't exist or has been removed.</p>
        <Link to="/" className="text-primary hover:underline">← Return to SignalForge</Link>
      </div>
    );
  }

  const vc = verdictConfig(finding.verdict);
  const VerdictIcon = vc.Icon;

  return (
    <div className="min-h-screen bg-background text-foreground" dir="ltr">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <Radio className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">SignalForge</span>
          </Link>
          <Badge variant="outline" className="font-mono text-[10px] tracking-widest">
            FORENSIC REPORT
          </Badge>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative pt-28 pb-12 overflow-hidden border-b border-border/30">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top, hsl(160 84% 39% / 0.06), transparent 60%)' }} />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.02]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(160 84% 39%) 3px, hsl(160 84% 39%) 4px)' }}
        />

        <div className="relative max-w-5xl mx-auto px-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground mb-6" aria-label="Breadcrumb">
            <Link to="/" className="hover:text-foreground transition-colors">signalforge.io</Link>
            <span>/</span>
            <span className="text-muted-foreground/60">research</span>
            <span>/</span>
            <span className="text-foreground truncate">{finding.slug}</span>
          </nav>

          <div className="grid lg:grid-cols-[1fr_180px] gap-10 items-start">
            <div className="space-y-4">
              {/* Verdict badge */}
              <div className="flex items-center gap-3">
                <VerdictIcon className="w-5 h-5" style={{ color: vc.color.replace('text-[', '').replace(']', ''), filter: `drop-shadow(${vc.glow})` }} />
                <span
                  className={cn('font-mono text-sm font-bold tracking-widest', vc.color)}
                  style={{ textShadow: vc.glow }}
                >
                  [{vc.label}]
                </span>
                {finding.platform && (
                  <Badge variant="outline" className="font-mono text-[10px] capitalize">{finding.platform}</Badge>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold leading-tight">{finding.title}</h1>
              <p className="text-lg text-muted-foreground leading-relaxed">{finding.summary}</p>

              <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(finding.created_at)}
                </span>
                {finding.source_url && (
                  <a href={finding.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <ExternalLink className="w-3 h-3" />
                    Source Signal
                  </a>
                )}
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[hsl(160_84%_39%)]" />
                  Autonomous scan verified
                </span>
              </div>
            </div>

            {/* Gauge */}
            <div className="flex justify-center lg:justify-end">
              <ConfidenceGauge value={finding.confidence} />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-16 space-y-14">

        {/* Affiliate CTA — prominent at top */}
        {finding.affiliate_partner && finding.affiliate_url && (
          <section>
            <div className="flex items-center gap-2 mb-4 font-mono text-xs text-muted-foreground tracking-widest uppercase">
              <TrendingUp className="w-3 h-3" />
              Recommended Action
            </div>
            <AffiliateActionCTA
              partner={finding.affiliate_partner}
              url={finding.affiliate_url}
              commission={finding.affiliate_commission}
            />
          </section>
        )}

        {/* Evidence */}
        <section>
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Evidence Chain
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {finding.evidence.length} verified signal{finding.evidence.length !== 1 ? 's' : ''} extracted from live community feeds.
          </p>
          <EvidenceTimeline items={finding.evidence} />
        </section>

        {/* Affiliate CTA — repeated at bottom for conversion */}
        {finding.affiliate_partner && finding.affiliate_url && (
          <section>
            <div className="flex items-center gap-2 mb-4 font-mono text-xs text-muted-foreground tracking-widest uppercase">
              <ArrowUpRight className="w-3 h-3" />
              Take Action on This Signal
            </div>
            <AffiliateActionCTA
              partner={finding.affiliate_partner}
              url={finding.affiliate_url}
              commission={finding.affiliate_commission}
            />
          </section>
        )}

        {/* About */}
        <section className="rounded-xl border border-border/30 bg-card/30 p-8">
          <div className="flex items-center gap-3 mb-4">
            <Radio className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">About SignalForge</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            SignalForge is an autonomous demand intelligence engine that monitors 30+ digital ecosystems in real-time,
            identifying high-intent purchase signals and matching them to the world's leading SaaS solutions.
            Every forensic report is generated by our AI scanner — no manual curation, no sponsored content.
          </p>
          <div className="flex items-center gap-4 mt-6 flex-wrap">
            <Link to="/" className="text-primary text-sm hover:underline flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              Back to SignalForge
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-6">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between gap-4 text-xs text-muted-foreground font-mono flex-wrap">
          <span>© 2026 SignalForge · Autonomous Demand Intelligence</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(160_84%_39%)] animate-pulse" />
            LIVE SCAN ACTIVE
          </span>
        </div>
      </footer>
    </div>
  );
}
