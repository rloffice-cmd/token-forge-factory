/**
 * Withdraw Panel Component
 * Handles withdrawal requests with WalletConnect signing
 */

import { useState } from 'react';
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
  Wallet
} from 'lucide-react';
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { useTreasuryBalance, useCreateCashoutRequest, useUpdateCashoutRequest } from '@/hooks/useTreasury';
import { 
  USER_WALLET_ADDRESS, 
  MIN_WITHDRAWAL_DTF, 
  ETH_USD_RATE, 
  DTF_USD_RATE,
  dtfToEth,
  dtfToUsd,
  getEtherscanUrl,
  formatAddress,
  web3Modal,
} from '@/lib/web3';
import { toast } from 'sonner';

export function WithdrawPanel() {
  const [amount, setAmount] = useState<string>('');
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  
  const { address, isConnected } = useAccount();
  const { data: balance } = useTreasuryBalance();
  const createCashout = useCreateCashoutRequest();
  const updateCashout = useUpdateCashoutRequest();
  
  const { 
    sendTransaction, 
    data: txHash,
    isPending: isSending,
    isSuccess: isSent,
    error: sendError,
  } = useSendTransaction();
  
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  
  const numAmount = parseFloat(amount) || 0;
  const ethAmount = dtfToEth(numAmount, ETH_USD_RATE);
  const usdAmount = dtfToUsd(numAmount);
  const availableBalance = balance?.available_dtf || 0;
  
  const canWithdraw = 
    isConnected && 
    numAmount >= MIN_WITHDRAWAL_DTF && 
    numAmount <= availableBalance &&
    !isSending &&
    !isConfirming;
  
  const handleConnect = () => {
    web3Modal.open();
  };
  
  const handleWithdraw = async () => {
    if (!canWithdraw || !address) return;
    
    try {
      // 1. Create cashout request in database
      const request = await createCashout.mutateAsync({
        amount_dtf: numAmount,
        amount_usd: usdAmount,
        amount_eth: ethAmount,
        eth_price_usd: ETH_USD_RATE,
        wallet_address: USER_WALLET_ADDRESS,
        network: 'ethereum',
      });
      
      setPendingRequestId(request.id);
      
      toast.info('נא לאשר את העסקה בארנק שלך');
      
      // 2. Send transaction via connected wallet
      sendTransaction({
        to: USER_WALLET_ADDRESS,
        value: parseEther(ethAmount.toFixed(18)),
      });
      
    } catch (error) {
      console.error('Withdrawal failed:', error);
      toast.error('שגיאה ביצירת בקשת משיכה');
    }
  };
  
  // Update status when transaction is sent
  if (isSent && txHash && pendingRequestId) {
    updateCashout.mutate({
      id: pendingRequestId,
      status: 'submitted',
      tx_hash: txHash,
    });
    toast.success('העסקה נשלחה!');
    setPendingRequestId(null);
  }
  
  // Update status when transaction is confirmed
  if (isConfirmed && txHash && pendingRequestId) {
    updateCashout.mutate({
      id: pendingRequestId,
      status: 'confirmed',
    });
    toast.success('העסקה אושרה ב-blockchain!');
  }
  
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          משיכת כספים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning */}
        <Alert>
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            משיכה דורשת חתימה מהארנק שלך. לא נשמרים מפתחות פרטיים.
          </AlertDescription>
        </Alert>
        
        {/* Connect Wallet if not connected */}
        {!isConnected && (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              יש לחבר ארנק כדי לבצע משיכה
            </p>
            <Button onClick={handleConnect} size="lg" className="gap-2">
              <Wallet className="w-5 h-5" />
              חבר ארנק
            </Button>
          </div>
        )}
        
        {/* Withdrawal Form */}
        {isConnected && (
          <>
            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">סכום למשיכה (DTF)</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  placeholder={`מינימום ${MIN_WITHDRAWAL_DTF} DTF`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={MIN_WITHDRAWAL_DTF}
                  max={availableBalance}
                  className="pr-16"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-7 text-xs"
                  onClick={() => setAmount(availableBalance.toString())}
                >
                  מקסימום
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                זמין: {availableBalance.toFixed(2)} DTF
              </p>
            </div>
            
            {/* Conversion Display */}
            {numAmount > 0 && (
              <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">שווי ב-USD:</span>
                  <span className="font-medium">${usdAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">שווי ב-ETH:</span>
                  <span className="font-medium font-mono">{ethAmount.toFixed(6)} ETH</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Gas (משוער):</span>
                  <span className="font-medium">~0.001 ETH</span>
                </div>
              </div>
            )}
            
            {/* Destination */}
            <div className="space-y-2">
              <Label>כתובת יעד</Label>
              <div className="p-3 rounded-lg bg-muted/30 font-mono text-sm break-all">
                {USER_WALLET_ADDRESS}
              </div>
            </div>
            
            {/* Error Display */}
            {sendError && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  {sendError.message.slice(0, 100)}...
                </AlertDescription>
              </Alert>
            )}
            
            {/* Success Display */}
            {txHash && (
              <Alert className="border-success/50 bg-success/10">
                <CheckCircle2 className="w-4 h-4 text-success" />
                <AlertDescription className="flex items-center justify-between">
                  <span>העסקה נשלחה!</span>
                  <a
                    href={getEtherscanUrl(txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    צפה ב-Etherscan
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </AlertDescription>
              </Alert>
            )}
            
            {/* Submit Button */}
            <Button
              onClick={handleWithdraw}
              disabled={!canWithdraw}
              size="lg"
              className="w-full gap-2"
            >
              {isSending || isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isSending ? 'ממתין לחתימה...' : 'ממתין לאישור...'}
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  בקש משיכה
                </>
              )}
            </Button>
            
            {/* Validation Messages */}
            {numAmount > 0 && numAmount < MIN_WITHDRAWAL_DTF && (
              <p className="text-sm text-warning text-center">
                מינימום למשיכה: {MIN_WITHDRAWAL_DTF} DTF
              </p>
            )}
            {numAmount > availableBalance && (
              <p className="text-sm text-destructive text-center">
                הסכום עולה על היתרה הזמינה
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
