/**
 * WalletConnect Button Component
 * Handles wallet connection via Web3Modal
 */

import { useAccount, useDisconnect, useChainId } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, AlertCircle } from 'lucide-react';
import { formatAddress } from '@/lib/web3';
import { web3Modal } from '@/lib/web3';
import { mainnet } from 'wagmi/chains';

export function WalletConnectButton() {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  
  const isWrongNetwork = isConnected && chainId !== mainnet.id;
  
  const handleConnect = () => {
    web3Modal.open();
  };
  
  const handleDisconnect = () => {
    disconnect();
  };
  
  if (isConnecting) {
    return (
      <Button variant="outline" disabled className="gap-2">
        <Wallet className="w-4 h-4 animate-pulse" />
        מתחבר...
      </Button>
    );
  }
  
  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        {isWrongNetwork && (
          <div className="flex items-center gap-1 text-warning text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>רשת שגויה</span>
          </div>
        )}
        <div className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
          <span className="font-mono text-sm text-primary">
            {formatAddress(address)}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDisconnect}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    );
  }
  
  return (
    <Button onClick={handleConnect} className="gap-2">
      <Wallet className="w-4 h-4" />
      חבר ארנק
    </Button>
  );
}
