import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, Terminal, ExternalLink, X, ChevronRight, TrendingUp, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { resolveAffiliate, commissionBadgeStyle, type AffiliatePartner } from '@/lib/affiliatePartners';

interface DecisionTrace {
  id: string;
  created_at: string;
  decision: string;
  intent: string | null;
  entity_type: string;
  actor_fingerprint: string | null;
  source_url: string | null;
  reason_codes: string[] | null;
  trust_score: number | null;
  pain_score: number | null;
  safe_mode_activated: boolean | null;
  throttle_state: string | null;
  emotional_state: string | null;
  buying_style: string | null;
  dna_score: number | null;
  platform: string | null;
  interaction_count: number | null;
}

// Build a single haystack string from a trace for affiliate matching
function buildHaystack(trace: DecisionTrace): string {
  return [
    trace.entity_type,
    trace.intent,
    trace.source_url,
    trace.platform,
    ...(trace.reason_codes ?? []),
  ]
    .filter(Boolean)
    .join(' ');
}

// Map raw decision + intent to a terminal-style status label
function resolveStatus(trace: DecisionTrace): {
  label: string;
  color: string;
  glow: string;
} {
  const d = trace.decision?.toUpperCase();
  const i = (trace.intent ?? '').toUpperCase();

  if (d === 'APPROVE' || d === 'SEND_OUTREACH')
    return { label: 'VERIFIED', color: 'text-[hsl(160_84%_39%)]', glow: '0 0 8px hsl(160 84% 39% / 0.8)' };
  if (d === 'BLOCK' && i === 'NOISE')
    return { label: 'REJECTED', color: 'text-[hsl(0_72%_51%)]', glow: '0 0 8px hsl(0 72% 51% / 0.8)' };
  if (d === 'BLOCK')
    return { label: 'FILTERED', color: 'text-[hsl(38_92%_50%)]', glow: '0 0 8px hsl(38 92% 50% / 0.8)' };
  if (i === 'ACTIVE_PAIN' || i === 'BUYING_SIGNAL')
    return { label: 'RESEARCHING', color: 'text-[hsl(199_89%_48%)]', glow: '0 0 8px hsl(199 89% 48% / 0.8)' };
  if (d === 'WATCH')
    return { label: 'MONITORING', color: 'text-[hsl(270_80%_60%)]', glow: '0 0 8px hsl(270 80% 60% / 0.8)' };

  return { label: d ?? 'PROCESSING', color: 'text-muted-foreground', glow: 'none' };
}

function formatTs(iso: string) {
  const d = new Date(iso);
  return d.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
}

function truncate(str: string | null | undefined, max = 48) {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ─── Earnings Potential Badge ────────────────────────────────────────────────

function EarningsBadge({ partner }: { partner: AffiliatePartner }) {
  const style = commissionBadgeStyle(partner.commissionValue);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider border',
        style.bg,
        style.text,
      )}
      style={{
        textShadow: style.glow,
        borderColor: `hsl(var(--border) / 0.4)`,
      }}
      title={`${partner.name} — ${partner.commission}`}
    >
      <TrendingUp className="w-2 h-2 flex-shrink-0" />
      {partner.commission}
    </span>
  );
}

// ─── Forensic Evidence Modal ─────────────────────────────────────────────────

function JsonModal({
  open,
  onClose,
  trace,
  partner,
}: {
  open: boolean;
  onClose: () => void;
  trace: DecisionTrace | null;
  partner: AffiliatePartner | null;
}) {
  if (!trace) return null;
  const json = JSON.stringify(trace, null, 2);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[hsl(222_47%_6%)] border-[hsl(160_84%_39%/0.3)] p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 font-mono text-sm text-[hsl(160_84%_39%)]">
            <Terminal className="w-4 h-4" />
            FORENSIC EVIDENCE
            <span className="text-muted-foreground font-normal ml-2 text-xs">
              {trace.id.slice(0, 8).toUpperCase()}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Scanline overlay */}
        <div className="relative overflow-hidden" style={{ maxHeight: '52vh' }}>
          <div
            className="absolute inset-0 pointer-events-none z-10 opacity-[0.03]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, hsl(160 84% 39%) 2px, hsl(160 84% 39%) 3px)',
            }}
          />
          <pre
            className="overflow-auto p-5 text-xs font-mono text-[hsl(160_84%_39%)] leading-relaxed"
            style={{
              maxHeight: '52vh',
              textShadow: '0 0 6px hsl(160 84% 39% / 0.5)',
            }}
          >
            {json}
          </pre>
        </div>

        {/* ACTION PANEL */}
        {partner && (
          <div
            className="px-5 py-4 border-t border-[hsl(160_84%_39%/0.2)] bg-[hsl(160_84%_39%/0.06)]"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="font-mono text-[10px] text-muted-foreground tracking-widest mb-0.5">
                  OPPORTUNITY_DETECTED
                </p>
                <p className="font-mono text-xs text-[hsl(160_84%_39%)] truncate">
                  {partner.category} · {partner.commission}
                </p>
              </div>
              <a
                href={partner.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded font-mono text-xs font-bold tracking-wider',
                  'bg-[hsl(160_84%_39%)] text-[hsl(222_47%_6%)]',
                  'hover:bg-[hsl(160_84%_46%)] transition-colors',
                  'shadow-[0_0_16px_hsl(160_84%_39%/0.5)]',
                )}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                Get Started via {partner.name}
              </a>
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-t border-border/40 flex justify-end">
          <Button variant="outline" size="sm" className="font-mono text-xs" onClick={onClose}>
            <X className="w-3 h-3 mr-1" />
            CLOSE_SESSION
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AutonomousActivityLog() {
  const [selectedTrace, setSelectedTrace] = useState<DecisionTrace | null>(null);

  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery<DecisionTrace[]>({
    queryKey: ['autonomous-activity-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('decision_traces')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as DecisionTrace[];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const entries = data ?? [];
  const selectedPartner = selectedTrace
    ? resolveAffiliate(buildHaystack(selectedTrace))
    : null;

  return (
    <>
      {/* Terminal card */}
      <div
        className="rounded-lg border border-[hsl(160_84%_39%/0.25)] bg-[hsl(222_47%_6%)] overflow-hidden relative"
        style={{ boxShadow: '0 0 30px hsl(160 84% 39% / 0.05), inset 0 0 60px hsl(160 84% 39% / 0.03)' }}
      >
        {/* Scanlines */}
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(160 84% 39%) 3px, hsl(160 84% 39%) 4px)',
          }}
        />

        {/* Header bar */}
        <div className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-[hsl(160_84%_39%/0.15)] bg-[hsl(222_47%_5%)]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-destructive/60" />
            <span className="w-3 h-3 rounded-full bg-warning/60" />
            <span className="w-3 h-3 rounded-full bg-success/60" />
            <span className="font-mono text-xs text-[hsl(160_84%_39%)] ml-3 tracking-widest">
              AUTONOMOUS_ACTIVITY_LOG <span className="opacity-50">// last 5 traces</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {dataUpdatedAt > 0 && (
              <span className="font-mono text-[10px] text-muted-foreground">
                SYNC @ {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-muted-foreground hover:text-[hsl(160_84%_39%)] transition-colors"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Log entries */}
        <div className="relative z-10 divide-y divide-[hsl(160_84%_39%/0.08)]">
          {isLoading ? (
            <div className="px-4 py-6 font-mono text-xs text-[hsl(160_84%_39%)] animate-pulse">
              {'> '} Fetching traces from memory…
            </div>
          ) : entries.length === 0 ? (
            <div className="px-4 py-6 font-mono text-xs text-muted-foreground">
              {'> '} No autonomous activity recorded yet.
            </div>
          ) : (
            entries.map((trace, idx) => {
              const status = resolveStatus(trace);
              const actor = trace.actor_fingerprint
                ? truncate(trace.actor_fingerprint.replace('unknown::', ''), 28)
                : 'ANON';
              const url = truncate(trace.source_url, 36);
              const reasons = (trace.reason_codes ?? []).join(', ') || null;
              const affiliate = resolveAffiliate(buildHaystack(trace));

              return (
                <div
                  key={trace.id}
                  className="px-4 py-3 font-mono text-xs hover:bg-[hsl(160_84%_39%/0.04)] transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    {/* Line number */}
                    <span className="text-muted-foreground/40 select-none w-4 flex-shrink-0 pt-0.5">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      {/* Row 1: timestamp + status + earnings badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-muted-foreground text-[10px] tracking-wide">
                          {formatTs(trace.created_at)}
                        </span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
                        <span
                          className={cn('font-bold tracking-widest text-[11px]', status.color)}
                          style={{ textShadow: status.glow }}
                        >
                          [{status.label}]
                        </span>
                        <span className="text-muted-foreground/60 text-[10px]">
                          {trace.entity_type?.toUpperCase()}
                        </span>
                        {/* Earnings Potential Badge */}
                        {affiliate && <EarningsBadge partner={affiliate} />}
                      </div>

                      {/* Row 2: actor + source */}
                      <div className="text-[11px] text-foreground/70 flex gap-2 flex-wrap">
                        <span className="text-[hsl(199_89%_48%/0.8)]">actor=</span>
                        <span>{actor}</span>
                        {trace.source_url && (
                          <>
                            <span className="text-muted-foreground/40">|</span>
                            <span className="text-muted-foreground/60">{url}</span>
                          </>
                        )}
                      </div>

                      {/* Row 3: reason codes */}
                      {reasons && (
                        <div className="text-[10px] text-warning/70">
                          reason_codes: [{reasons}]
                        </div>
                      )}
                    </div>

                    {/* Forensic Evidence button */}
                    <button
                      onClick={() => setSelectedTrace(trace)}
                      className={cn(
                        'flex-shrink-0 flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded',
                        'border border-[hsl(160_84%_39%/0.2)] text-[hsl(160_84%_39%/0.7)]',
                        'hover:border-[hsl(160_84%_39%/0.6)] hover:text-[hsl(160_84%_39%)]',
                        'transition-all opacity-0 group-hover:opacity-100',
                      )}
                      style={{ textShadow: '0 0 4px hsl(160 84% 39% / 0.4)' }}
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      EVIDENCE
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="relative z-10 px-4 py-2 border-t border-[hsl(160_84%_39%/0.1)] bg-[hsl(222_47%_5%)] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(160_84%_39%)] animate-pulse" />
          <span className="font-mono text-[10px] text-muted-foreground tracking-widest">
            HIBERNATION MODE ACTIVE — READ-ONLY FEED
          </span>
        </div>
      </div>

      {/* JSON Modal */}
      <JsonModal
        open={!!selectedTrace}
        onClose={() => setSelectedTrace(null)}
        trace={selectedTrace}
        partner={selectedPartner}
      />
    </>
  );
}
