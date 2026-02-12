/**
 * AutomatedMarketingHub - Dedicated Marketing Kit for all partners
 * Shows all 7 partners with Generate Social Post, category badges, and copy functionality
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Copy, Check, Sparkles, Eye, Linkedin, Twitter, MessageCircle, Megaphone } from 'lucide-react';
import { PARTNER_BRANDS, getPartnerBrand } from '@/lib/partnerLogos';
import { getPartnerContent, renderTemplate } from '@/lib/contentForgeTemplates';

interface PartnerRow {
  id: string;
  name: string;
  affiliate_base_url: string;
  commission_rate: number;
  is_active: boolean;
}

const PLATFORM_ICONS: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  twitter: Twitter,
  whatsapp: MessageCircle,
};

export function AutomatedMarketingHub() {
  const [expandedPartner, setExpandedPartner] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState<string | null>(null);

  const { data: partners = [] } = useQuery<PartnerRow[]>({
    queryKey: ['marketing-hub-partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('m2m_partners')
        .select('id, name, affiliate_base_url, commission_rate, is_active')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as PartnerRow[];
    },
  });

  const handleCopy = async (text: string, partnerId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(partnerId);
      toast({ title: '📋 הועתק!', description: 'תוכן מוכן להדבקה ברשתות החברתיות' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({ title: 'שגיאה בהעתקה', variant: 'destructive' });
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary" />
          ContentForge — Automated Marketing Hub
          <Badge variant="outline" className="ml-auto text-xs">
            {partners.length} Partners
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {partners.map((partner) => {
          const brand = getPartnerBrand(partner.name);
          const content = getPartnerContent(partner.name);
          const isExpanded = expandedPartner === partner.id;
          const platform = activePlatform[partner.id] || 'linkedin';
          const activeTemplate = content?.templates.find(t => t.platform === platform) || content?.templates[0];
          const slug = partner.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const effectiveLink = partner.affiliate_base_url || `${window.location.origin}/go/${slug}`;

          return (
            <div
              key={partner.id}
              className="rounded-lg border border-border/40 bg-background/30 backdrop-blur-xl overflow-hidden transition-all"
            >
              {/* Partner Header */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-lg"
                    style={{ backgroundColor: brand?.color || 'hsl(var(--primary))' }}
                  >
                    {brand?.initials || partner.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">{partner.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {brand && (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{ borderColor: brand.color, color: brand.color }}
                        >
                          {brand.category}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {partner.commission_rate <= 1
                          ? `${(partner.commission_rate * 100).toFixed(0)}%`
                          : `${partner.commission_rate.toFixed(0)}%`} commission
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => setExpandedPartner(isExpanded ? null : partner.id)}
                  size="sm"
                  variant={isExpanded ? 'secondary' : 'default'}
                  className="gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isExpanded ? 'Close' : 'Generate Social Post'}
                </Button>
              </div>

              {/* Expanded Content */}
              {isExpanded && content && activeTemplate && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3">
                  {/* Platform tabs */}
                  <Tabs
                    value={platform}
                    onValueChange={(v) => setActivePlatform(prev => ({ ...prev, [partner.id]: v }))}
                  >
                    <TabsList className="w-full grid grid-cols-3 h-9">
                      {content.templates.map((tpl) => {
                        const Icon = PLATFORM_ICONS[tpl.platform] || MessageCircle;
                        return (
                          <TabsTrigger
                            key={tpl.platform}
                            value={tpl.platform}
                            className="text-xs gap-1.5"
                          >
                            <Icon className="w-3.5 h-3.5" />
                            {tpl.label}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>

                    {content.templates.map((tpl) => {
                      const rendered = renderTemplate(tpl.template, brand?.name || partner.name, effectiveLink);
                      return (
                        <TabsContent key={tpl.platform} value={tpl.platform} className="mt-3 space-y-3">
                          <Textarea
                            value={rendered}
                            readOnly
                            className="min-h-[200px] text-xs leading-relaxed bg-background/20 backdrop-blur-sm border-border/30 resize-none font-mono"
                            dir="ltr"
                          />

                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleCopy(rendered, `${partner.id}-${tpl.platform}`)}
                              size="sm"
                              className="flex-1 gap-2"
                            >
                              {copiedId === `${partner.id}-${tpl.platform}` ? (
                                <><Check className="w-3.5 h-3.5" /> Copied!</>
                              ) : (
                                <><Copy className="w-3.5 h-3.5" /> Flex-Copy</>
                              )}
                            </Button>
                            <Button
                              onClick={() => setShowPreview(showPreview === `${partner.id}-${tpl.platform}` ? null : `${partner.id}-${tpl.platform}`)}
                              size="sm"
                              variant="outline"
                              className="gap-2"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Preview
                            </Button>
                          </div>

                          {showPreview === `${partner.id}-${tpl.platform}` && (
                            <div className="rounded-lg border border-border/40 bg-card/80 backdrop-blur-sm p-4 space-y-3">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                                Visual Asset Preview — {tpl.label}
                              </p>
                              <div className="rounded-lg bg-background/60 border border-border/30 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                    style={{ backgroundColor: brand?.color || 'hsl(var(--primary))' }}
                                  >
                                    {brand?.initials || 'TF'}
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold">TruthToken</p>
                                    <p className="text-[10px] text-muted-foreground">Just now</p>
                                  </div>
                                </div>
                                <p className="text-xs whitespace-pre-line leading-relaxed line-clamp-6" dir="ltr">
                                  {rendered.slice(0, 300)}...
                                </p>
                                <div className="mt-3 flex items-center gap-2">
                                  <Badge
                                    className="text-[9px] text-white"
                                    style={{ backgroundColor: brand?.color }}
                                  >
                                    {brand?.category || 'Partner'}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    🔗 {(() => { try { return new URL(effectiveLink).hostname; } catch { return effectiveLink; } })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </div>
              )}

              {/* No template fallback */}
              {isExpanded && !content && (
                <div className="px-4 pb-4 border-t border-border/30 pt-3">
                  <p className="text-sm text-muted-foreground text-center py-4">
                    תבנית תוכן עבור {partner.name} טרם הוגדרה. ניתן להוסיף בעתיד.
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {partners.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No active partners found.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
