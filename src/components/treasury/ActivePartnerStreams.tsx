/**
 * Active Partner Revenue Streams
 * Shows verified affiliate partners with tracked outbound links
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, TrendingUp } from 'lucide-react';
import { getPartnerBrand } from '@/lib/partnerLogos';

interface Partner {
  id: string;
  name: string;
  affiliate_base_url: string;
  commission_rate: number;
  category_tags: string[];
  is_active: boolean;
}

export function ActivePartnerStreams() {
  const { data: partners, isLoading } = useQuery({
    queryKey: ['active-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('m2m_partners')
        .select('id, name, affiliate_base_url, commission_rate, category_tags, is_active')
        .eq('is_active', true)
        .order('commission_rate', { ascending: false });
      if (error) throw error;
      return data as Partner[];
    },
  });

  const { data: clickStats } = useQuery({
    queryKey: ['partner-click-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('click_analytics')
        .select('partner_slug, id')
        .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString());
      if (error) return {};
      const counts: Record<string, number> = {};
      (data || []).forEach((c: { partner_slug: string }) => {
        counts[c.partner_slug] = (counts[c.partner_slug] || 0) + 1;
      });
      return counts;
    },
  });

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card glow-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          שותפים פעילים
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          {partners?.length || 0} פעילים
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        {partners?.map((partner) => {
          const slug = partner.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const clicks = clickStats?.[slug] || 0;
          const commissionPct = partner.commission_rate <= 1
            ? (partner.commission_rate * 100).toFixed(0)
            : partner.commission_rate.toFixed(0);

          return (
            <div
              key={partner.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-accent/10 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {(() => {
                  const brand = getPartnerBrand(partner.name);
                  return (
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: brand?.color || 'hsl(var(--primary))' }}
                    >
                      {brand?.initials || partner.name.slice(0, 2).toUpperCase()}
                    </div>
                  );
                })()}
                <div className="min-w-0">
                  <p className="font-medium truncate">{partner.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(() => {
                      const brand = getPartnerBrand(partner.name);
                      return brand ? (
                        <Badge variant="outline" className="text-[10px] opacity-70">
                          {brand.category}
                        </Badge>
                      ) : null;
                    })()}
                    <Badge variant="secondary" className="text-xs">
                      {commissionPct}% עמלה
                    </Badge>
                    {clicks > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {clicks} קליקים (30 יום)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(partner.affiliate_base_url, '_blank', 'noopener,noreferrer')}
                className="shrink-0"
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          );
        })}
        {(!partners || partners.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-4">
            אין שותפים פעילים
          </p>
        )}
      </CardContent>
    </Card>
  );
}
