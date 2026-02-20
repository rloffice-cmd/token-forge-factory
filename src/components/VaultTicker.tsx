/**
 * "Live from the Vault" Ticker
 * Shows the latest 3 VERIFIED research findings as a scrolling ticker on the homepage.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FindingSnippet {
  id: string;
  slug: string;
  title: string;
  verdict: string;
  confidence: number;
  affiliate_partner: string | null;
}

export function VaultTicker() {
  const { data } = useQuery<FindingSnippet[]>({
    queryKey: ['vault-ticker'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('research_findings')
        .select('id, slug, title, verdict, confidence, affiliate_partner')
        .eq('is_published', true)
        .eq('verdict', 'VERIFIED')
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data as FindingSnippet[];
    },
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const items = data ?? [];
  if (items.length === 0) return null;

  return (
    <div
      className="border-y border-[hsl(160_84%_39%/0.2)] bg-[hsl(222_47%_5%)] overflow-hidden relative"
      style={{ boxShadow: 'inset 0 0 40px hsl(160 84% 39% / 0.03)' }}
    >
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, hsl(160 84% 39%) 3px, hsl(160 84% 39%) 4px)' }}
      />

      <div className="relative flex items-stretch">
        {/* Label */}
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-r border-[hsl(160_84%_39%/0.2)] bg-[hsl(160_84%_39%/0.08)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(160_84%_39%)] animate-pulse" />
          <Radio className="w-3 h-3 text-[hsl(160_84%_39%)]" />
          <span className="font-mono text-[10px] text-[hsl(160_84%_39%)] tracking-widest whitespace-nowrap"
            style={{ textShadow: '0 0 6px hsl(160 84% 39% / 0.6)' }}
          >
            LIVE FROM THE VAULT
          </span>
        </div>

        {/* Scrolling items */}
        <div className="flex-1 overflow-hidden">
          <div
            className="flex gap-0 animate-[ticker_28s_linear_infinite]"
            style={{ width: `${items.length * 2 * 400}px` }}
          >
            {/* Duplicate for seamless loop */}
            {[...items, ...items].map((finding, i) => (
              <Link
                key={`${finding.id}-${i}`}
                to={`/research/${finding.slug}`}
                className="flex items-center gap-3 px-6 py-3 min-w-[400px] group hover:bg-[hsl(160_84%_39%/0.05)] transition-colors border-r border-[hsl(160_84%_39%/0.08)]"
              >
                <ShieldCheck
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ color: 'hsl(160 84% 39%)', filter: 'drop-shadow(0 0 4px hsl(160 84% 39% / 0.6))' }}
                />
                <span className="font-mono text-[11px] text-foreground/80 truncate group-hover:text-foreground transition-colors">
                  {finding.title}
                </span>
                <span
                  className="font-mono text-[10px] font-bold tracking-widest whitespace-nowrap flex-shrink-0 text-[hsl(160_84%_39%)]"
                  style={{ textShadow: '0 0 4px hsl(160 84% 39% / 0.5)' }}
                >
                  {finding.confidence}% ·
                </span>
                {finding.affiliate_partner && (
                  <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                    via {finding.affiliate_partner}
                  </span>
                )}
                <ArrowRight className="w-3 h-3 text-[hsl(160_84%_39%/0.5)] group-hover:text-[hsl(160_84%_39%)] transition-colors flex-shrink-0 ml-auto" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
