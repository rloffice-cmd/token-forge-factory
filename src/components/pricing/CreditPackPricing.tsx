/**
 * Credit Pack Pricing Component
 * Shows available credit packs with "Buy with ETH" buttons
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Zap, Rocket, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';

interface CreditPack {
  id: string;
  name: string;
  name_he: string;
  description: string | null;
  description_he: string | null;
  credits: number;
  price_usd: number;
  is_popular: boolean;
  features: string[] | null;
}

const packIcons: Record<string, React.ReactNode> = {
  starter: <Zap className="w-6 h-6" />,
  pro: <Sparkles className="w-6 h-6" />,
  business: <Rocket className="w-6 h-6" />,
};

export function CreditPackPricing({ customerEmail }: { customerEmail?: string }) {
  const [loadingPack, setLoadingPack] = useState<string | null>(null);

  const { data: packs, isLoading } = useQuery({
    queryKey: ['credit-packs'],
    queryFn: async (): Promise<CreditPack[]> => {
      const { data, error } = await supabase
        .from('credit_packs')
        .select('*')
        .eq('is_active', true)
        .order('price_usd', { ascending: true });
      
      if (error) throw error;
      return data as CreditPack[];
    },
  });

  const handleBuy = async (pack: CreditPack) => {
    if (!customerEmail) {
      toast.error('יש להזין כתובת אימייל קודם');
      return;
    }

    setLoadingPack(pack.id);

    try {
      const response = await supabase.functions.invoke('create-coinbase-checkout', {
        body: {
          pack_id: pack.id,
          customer_email: customerEmail,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'שגיאה ביצירת תשלום');
      }

      const { hosted_url } = response.data;
      
      if (hosted_url) {
        // Open Coinbase Commerce checkout
        window.open(hosted_url, '_blank');
        toast.success('מעביר לדף תשלום...');
      } else {
        throw new Error('לא התקבל קישור לתשלום');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error instanceof Error ? error.message : 'שגיאה ביצירת תשלום');
    } finally {
      setLoadingPack(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!packs || packs.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center text-muted-foreground">
          אין חבילות קרדיטים זמינות כרגע
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {packs.map((pack) => (
        <Card 
          key={pack.id} 
          className={`glass-card relative overflow-hidden transition-all hover:scale-[1.02] ${
            pack.is_popular ? 'ring-2 ring-primary' : ''
          }`}
        >
          {pack.is_popular && (
            <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-center py-1 text-sm font-medium">
              הכי פופולרי
            </div>
          )}
          
          <CardHeader className={pack.is_popular ? 'pt-10' : ''}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                {packIcons[pack.id] || <Zap className="w-6 h-6" />}
              </div>
              <div>
                <CardTitle>{pack.name_he}</CardTitle>
                <CardDescription>{pack.name}</CardDescription>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <p className="text-4xl font-bold text-primary">
                ${pack.price_usd}
              </p>
              <p className="text-muted-foreground">
                {pack.credits.toLocaleString()} קרדיטים
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                ${(pack.price_usd / pack.credits).toFixed(4)} לקרדיט
              </p>
            </div>

            {pack.description_he && (
              <p className="text-sm text-muted-foreground text-center">
                {pack.description_he}
              </p>
            )}

            {pack.features && Array.isArray(pack.features) && pack.features.length > 0 && (
              <ul className="space-y-2 text-sm">
                {pack.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-primary">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          
          <CardFooter>
            <Button 
              className="w-full gap-2"
              variant={pack.is_popular ? 'default' : 'outline'}
              onClick={() => handleBuy(pack)}
              disabled={loadingPack === pack.id || !customerEmail}
            >
              {loadingPack === pack.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  מכין תשלום...
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  קנה ב-ETH
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
