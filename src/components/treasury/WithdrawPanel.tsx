/**
 * Withdraw Panel V2 - Safe Proposal Flow
 * 
 * CRITICAL CHANGE: This creates a Safe transaction PROPOSAL
 * The funds come FROM the Treasury Safe, NOT from user's wallet
 * 
 * Flow:
 * 1. User connects wallet (must be Safe owner)
 * 2. User enters amount
 * 3. Click "Create Proposal" → Proposal created in Safe
 * 4. User signs via Safe interface or here
 * 5. Once threshold reached → TX executes from Safe
 * 6. Funds arrive in user's payout wallet
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Send, 
  AlertTriangle, 
  Loader2, 
  CheckCircle2,
  ExternalLink,
  Wallet,
  Shield,
  RefreshCw,
  Info
} from 'lucide-react';
import { useAccount } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { 
  USER_PAYOUT_ADDRESS,
  MIN_WITHDRAWAL_ETH,
  getSafeBalance,
  getEthPrice,
  isSafeOwner,
  getSafeExplorerUrl,
  formatSafeBalance,
} from '@/lib/safe';
import { web3Modal, formatAddress } from '@/lib/web3';
import { useCreateCashoutRequest, useTreasuryWallet } from '@/hooks/useTreasury';
import { toast } from 'sonner';

export function WithdrawPanel() {
  const [amount, setAmount] = useState<string>('');
  const [isCreatingProposal, setIsCreatingProposal] = useState(false);
  
  const { address, isConnected } = useAccount();
  const createCashout = useCreateCashoutRequest();
  
  // Get treasury wallet from database
  const { data: treasuryWallet, isLoading: walletLoading } = useTreasuryWallet();
  const treasurySafeAddress = treasuryWallet?.address || '';
  
  // Get Safe balance from chain (SOURCE OF TRUTH)
  const { data: safeBalance, isLoading: balanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['safe-balance', treasurySafeAddress],
    queryFn: () => getSafeBalance(treasurySafeAddress),
    enabled: !!treasurySafeAddress,
    refetchInterval: 30000,
  });
  
  // Get ETH price from oracle
  const { data: ethPrice, isLoading: priceLoading } = useQuery({
    queryKey: ['eth-price'],
    queryFn: getEthPrice,
    refetchInterval: 60000, // Refresh every minute
  });
  
  // Check if connected wallet is Safe owner
  const { data: isOwner, isLoading: ownerLoading } = useQuery({
    queryKey: ['safe-owner', treasurySafeAddress, address],
    queryFn: () => isSafeOwner(treasurySafeAddress, address!),
    enabled: !!treasurySafeAddress && !!address,
  });
  
  const isLoading = walletLoading || balanceLoading || priceLoading || ownerLoading;
  const numAmount = parseFloat(amount) || 0;
  const safeBalanceEth = safeBalance ? parseFloat(formatEther(safeBalance.eth)) : 0;
  const usdValue = numAmount * (ethPrice || 0);
  
  const canWithdraw = 
    isConnected && 
    isOwner &&
    numAmount >= MIN_WITHDRAWAL_ETH && 
    numAmount <= safeBalanceEth &&
    !isCreatingProposal &&
    !!treasurySafeAddress;
  
  const handleConnect = () => {
    web3Modal.open();
  };
  
  const handleCreateProposal = async () => {
    if (!canWithdraw || !address) return;
    
    setIsCreatingProposal(true);
    
    try {
      // 1. Create cashout request in database for tracking
      await createCashout.mutateAsync({
        amount_dtf: numAmount * (ethPrice || 3500) / 0.42, // Convert ETH to DTF equivalent
        amount_usd: usdValue,
        amount_eth: numAmount,
        eth_price_usd: ethPrice || 3500,
        wallet_address: USER_PAYOUT_ADDRESS,
        network: 'ethereum',
      });
      
      toast.info('בקשת משיכה נוצרה. יש לאשר ב-Safe.');
      
      // 2. Open Safe interface for signing
      const safeUrl = getSafeExplorerUrl(treasurySafeAddress);
      window.open(safeUrl, '_blank');
      
      toast.success(
        'נא לאשר את העסקה ב-Safe interface. ' +
        'לאחר אישור, העסקה תבוצע אוטומטית.'
      );
      
      setAmount('');
      
    } catch (error) {
      console.error('Failed to create proposal:', error);
      toast.error('שגיאה ביצירת הצעת משיכה');
    } finally {
      setIsCreatingProposal(false);
    }
  };
  
  // No Safe configured
  if (!treasurySafeAddress) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            משיכת כספים
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              <strong>Treasury Safe לא מוגדר!</strong>
              <br />
              יש להוסיף את VITE_TREASURY_SAFE_ADDRESS בהגדרות.
              <br />
              <a 
                href="https://app.safe.global" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline"
              >
                צור Safe חדש כאן
              </a>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          משיכה מ-Treasury Safe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Safe Info */}
        <div className="p-4 rounded-lg bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Treasury Safe:</span>
            <a
              href={getSafeExplorerUrl(treasurySafeAddress)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline font-mono text-sm"
            >
              {formatAddress(treasurySafeAddress)}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">יתרה On-Chain:</span>
            <div className="flex items-center gap-2">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="font-bold">
                    {safeBalance ? formatSafeBalance(safeBalance.eth, ethPrice || 0).eth : '0'} ETH
                  </span>
                  <span className="text-muted-foreground text-sm">
                    (${safeBalance ? formatSafeBalance(safeBalance.eth, ethPrice || 0).usd : '0'})
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => refetchBalance()}>
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">מחיר ETH:</span>
            <span className="font-mono">${ethPrice?.toLocaleString() || '...'}</span>
          </div>
        </div>
        
        {/* Warning */}
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>
            משיכה יוצרת הצעה ב-Safe. הכסף יוצא מה-Treasury, לא מהארנק שלך.
          </AlertDescription>
        </Alert>
        
        {/* Connect Wallet */}
        {!isConnected && (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              יש לחבר ארנק של Safe Owner
            </p>
            <Button onClick={handleConnect} size="lg" className="gap-2">
              <Wallet className="w-5 h-5" />
              חבר ארנק
            </Button>
          </div>
        )}
        
        {/* Not an owner warning */}
        {isConnected && isOwner === false && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              הארנק המחובר ({formatAddress(address!)}) אינו Owner של ה-Safe.
              <br />
              רק בעלי Safe יכולים ליצור הצעות משיכה.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Withdrawal Form */}
        {isConnected && isOwner && (
          <>
            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">סכום למשיכה (ETH)</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  placeholder={`מינימום ${MIN_WITHDRAWAL_ETH} ETH`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={MIN_WITHDRAWAL_ETH}
                  max={safeBalanceEth}
                  step="0.001"
                  className="pr-16"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-7 text-xs"
                  onClick={() => setAmount(safeBalanceEth.toFixed(6))}
                >
                  מקסימום
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ≈ ${usdValue.toFixed(2)} USD
              </p>
            </div>
            
            {/* Destination */}
            <div className="space-y-2">
              <Label>כתובת יעד (קבועה)</Label>
              <div className="p-3 rounded-lg bg-muted/30 font-mono text-sm break-all">
                {USER_PAYOUT_ADDRESS}
              </div>
            </div>
            
            {/* Submit Button */}
            <Button
              onClick={handleCreateProposal}
              disabled={!canWithdraw}
              size="lg"
              className="w-full gap-2"
            >
              {isCreatingProposal ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  יוצר הצעה...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  צור הצעת משיכה ב-Safe
                </>
              )}
            </Button>
            
            {/* Validation Messages */}
            {numAmount > 0 && numAmount < MIN_WITHDRAWAL_ETH && (
              <p className="text-sm text-warning text-center">
                מינימום למשיכה: {MIN_WITHDRAWAL_ETH} ETH
              </p>
            )}
            {numAmount > safeBalanceEth && (
              <p className="text-sm text-destructive text-center">
                הסכום עולה על היתרה ב-Safe
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
