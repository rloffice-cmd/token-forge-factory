/**
 * Treasury Balance Card
 * Shows current balance in DTF and USD
 */

import { Card, CardContent } from '@/components/ui/card';
import { Wallet, TrendingUp, Clock, ExternalLink } from 'lucide-react';
import { useTreasuryBalance, useTreasuryWallet } from '@/hooks/useTreasury';
import { Skeleton } from '@/components/ui/skeleton';
import { getEtherscanAddressUrl, formatAddress } from '@/lib/web3';

export function TreasuryBalanceCard() {
  const { data: balance, isLoading: balanceLoading } = useTreasuryBalance();
  const { data: wallet, isLoading: walletLoading } = useTreasuryWallet();
  
  const isLoading = balanceLoading || walletLoading;
  
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
  
  return (
    <Card className="glass-card glow-border">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          {/* Icon */}
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center">
            <Wallet className="w-8 h-8 text-primary" />
          </div>
          
          {/* Balance */}
          <div>
            <p className="text-sm text-muted-foreground">יתרה כוללת</p>
            <p className="text-4xl font-bold text-primary">
              {(balance?.total_dtf || 0).toFixed(2)} <span className="text-lg">DTF</span>
            </p>
            <p className="text-lg text-muted-foreground">
              ≈ ${(balance?.total_usd || 0).toFixed(2)} USD
            </p>
          </div>
          
          {/* Available vs Pending */}
          {(balance?.pending_withdrawal_dtf || 0) > 0 && (
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-success">
                <TrendingUp className="w-4 h-4" />
                <span>זמין: {(balance?.available_dtf || 0).toFixed(2)} DTF</span>
              </div>
              <div className="flex items-center gap-1 text-warning">
                <Clock className="w-4 h-4" />
                <span>ממתין: {(balance?.pending_withdrawal_dtf || 0).toFixed(2)} DTF</span>
              </div>
            </div>
          )}
          
          {/* Wallet Address */}
          {wallet && wallet.address !== '0x0000000000000000000000000000000000000000' && (
            <a
              href={getEtherscanAddressUrl(wallet.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <span className="font-mono">{formatAddress(wallet.address)}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
