/**
 * ContentForge - Marketing Kit for Partner Cards
 * Generates ready-to-post content for LinkedIn, Twitter, WhatsApp
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Copy, Check, Sparkles, Eye, Linkedin, Twitter, MessageCircle } from 'lucide-react';
import { getPartnerContent, renderTemplate, type ContentTemplate } from '@/lib/contentForgeTemplates';
import { getPartnerBrand } from '@/lib/partnerLogos';

interface ContentForgeCardProps {
  partnerName: string;
  affiliateLink: string;
  fallbackLink?: string;
}

const PLATFORM_ICONS: Record<string, typeof Linkedin> = {
  linkedin: Linkedin,
  twitter: Twitter,
  whatsapp: MessageCircle,
};

export function ContentForgeCard({ partnerName, affiliateLink, fallbackLink }: ContentForgeCardProps) {
  const [activeTemplate, setActiveTemplate] = useState<ContentTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);

  const content = getPartnerContent(partnerName);
  const brand = getPartnerBrand(partnerName);

  // Use affiliate link, or fallback to internal app link if DNS pending
  const effectiveLink = affiliateLink || fallbackLink || '#';

  if (!content) return null;

  const handleGenerate = () => {
    setActiveTemplate(content.templates[0]);
    setGenerated(true);
  };

  const getRenderedContent = (tpl: ContentTemplate) => {
    return renderTemplate(tpl.template, brand?.name || partnerName, effectiveLink);
  };

  const handleCopy = async (tpl: ContentTemplate) => {
    const text = getRenderedContent(tpl);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: '📋 הועתק!',
        description: `תוכן ${tpl.label} מוכן להדבקה`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'שגיאה בהעתקה', variant: 'destructive' });
    }
  };

  return (
    <Card className="border border-border/30 bg-background/40 backdrop-blur-xl shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Marketing Kit
          </CardTitle>
          {brand && (
            <Badge
              variant="outline"
              className="text-[10px]"
              style={{ borderColor: brand.color, color: brand.color }}
            >
              {brand.category}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!generated ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground mb-3">
              צור תוכן שיווקי מותאם ל-{brand?.name || partnerName}
            </p>
            <Button
              onClick={handleGenerate}
              size="sm"
              className="gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Content
            </Button>
          </div>
        ) : (
          <Tabs
            defaultValue={content.templates[0].platform}
            onValueChange={(v) => {
              const tpl = content.templates.find(t => t.platform === v);
              if (tpl) setActiveTemplate(tpl);
            }}
          >
            <TabsList className="w-full grid grid-cols-3 h-8">
              {content.templates.map((tpl) => {
                const Icon = PLATFORM_ICONS[tpl.platform] || MessageCircle;
                return (
                  <TabsTrigger
                    key={tpl.platform}
                    value={tpl.platform}
                    className="text-xs gap-1 data-[state=active]:bg-primary/10"
                  >
                    <Icon className="w-3 h-3" />
                    {tpl.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {content.templates.map((tpl) => (
              <TabsContent key={tpl.platform} value={tpl.platform} className="mt-3 space-y-3">
                {/* Content area - glassmorphism */}
                <div className="relative">
                  <Textarea
                    value={getRenderedContent(tpl)}
                    readOnly
                    className="min-h-[180px] text-xs leading-relaxed bg-background/30 backdrop-blur-sm border-border/40 resize-none font-mono"
                    dir="ltr"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => handleCopy(tpl)}
                    size="sm"
                    variant="default"
                    className="flex-1 gap-2 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Flex-Copy
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowPreview(!showPreview)}
                    size="sm"
                    variant="outline"
                    className="gap-2 text-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview
                  </Button>
                </div>

                {/* Visual Asset Preview */}
                {showPreview && (
                  <div className="rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm p-4 space-y-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                      Visual Asset Preview — {tpl.label}
                    </p>
                    <div className="rounded-lg bg-background/60 border border-border/30 p-4">
                      {/* Simulated social post */}
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
                        {getRenderedContent(tpl).slice(0, 280)}...
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge
                          className="text-[9px]"
                          style={{ backgroundColor: brand?.color, color: 'white' }}
                        >
                          {brand?.category || 'Partner'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          🔗 {new URL(effectiveLink).hostname}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
