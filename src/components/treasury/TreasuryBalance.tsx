/**
 * Treasury Balance Card V2
 * Shows REAL on-chain balance from Safe (not DB ledger)
 */

import { Card, CardContent } from '@/components/ui/card';
import { Shield, TrendingUp, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { 
  TREASURY_SAFE_ADDRESS,
  getSafeBalance,
  getEthPrice,
  formatSafeBalance,
  getSafeExplorerUrl,
} from '@/lib/safe';
import { formatAddress } from '@/lib/web3';

export function TreasuryBalanceCard() {
  // Get Safe balance from chain (REAL SOURCE OF TRUTH)
  const { 
    data: safeBalance, 
    isLoading: balanceLoading, 
    refetch: refetchBalance,
    error: balanceError,
  } = useQuery({
    queryKey: ['safe-balance', TREASURY_SAFE_ADDRESS],
    queryFn: () => getSafeBalance(TREASURY_SAFE_ADDRESS),
    enabled: !!TREASURY_SAFE_ADDRESS,
    refetchInterval: 30000,
  });
  
  // Get ETH price from oracle
  const { data: ethPrice, isLoading: priceLoading } = useQuery({
    queryKey: ['eth-price'],
    queryFn: getEthPrice,
    refetchInterval: 60000,
  });
  
  const isLoading = balanceLoading || priceLoading;
  
  // No Safe configured
  if (!TREASURY_SAFE_ADDRESS) {
    return (
      <Card className="glass-card glow-border">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <p className="text-lg font-bold text-destructive">Treasury Safe לא מוגדר</p>
              <p className="text-sm text-muted-foreground mt-2">
                יש להוסיף VITE_TREASURY_SAFE_ADDRESS להגדרות
              </p>
              <a
                href="https://app.safe.global"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline mt-4"
              >
                צור Safe חדש
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (isLoading) {
    return (
      <Card className="glass-card glow-border">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <Skeleton className="w-16 h-16 rounded-full mx-auto" />
            <Skeleton className="h-8 w-32 mx-auto" />
            <Skeleton className="h-6 w-24 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (balanceError) {
    return (
      <Card className="glass-card glow-border">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-warning/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
            <div>
              <p className="text-lg font-bold text-warning">שגיאה בטעינת יתרה</p>
              <p className="text-sm text-muted-foreground mt-2">
                לא ניתן להתחבר ל-blockchain
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetchBalance()}
                className="mt-4"
              >
                נסה שוב
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const formatted = formatSafeBalance(safeBalance?.eth || BigInt(0), ethPrice || 0);
  
  return (
    <Card className="glass-card glow-border">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          
          {/* Balance */}
          <div>
            <div className="flex items-center justify-center gap-2">
              <p className="text-sm text-muted-foreground">יתרה On-Chain</p>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-5 w-5" 
                onClick={() => refetchBalance()}
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-4xl font-bold text-primary">
              {formatted.eth} <span className="text-lg">ETH</span>
            </p>
            <p className="text-lg text-muted-foreground">
              ≈ ${formatted.usd} USD
            </p>
          </div>
          
          {/* ETH Price */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="w-4 h-4" />
            <span>ETH = ${ethPrice?.toLocaleString() || '...'}</span>
          </div>
          
          {/* Safe Address */}
          <a
            href={getSafeExplorerUrl(TREASURY_SAFE_ADDRESS)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Shield className="w-4 h-4" />
            <span className="font-mono">{formatAddress(TREASURY_SAFE_ADDRESS)}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
          
          {/* Source of Truth Badge */}
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-success/20 text-success text-xs">
            <span>✓</span>
            <span>מקור אמת: Blockchain</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
