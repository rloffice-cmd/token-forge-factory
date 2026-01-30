/**
 * Treasury Page - V2
 * Complete treasury management with WalletConnect
 */

import { AppLayout } from '@/components/AppLayout';
import { TreasuryBalanceCard } from '@/components/treasury/TreasuryBalance';
import { WithdrawPanel } from '@/components/treasury/WithdrawPanel';
import { LedgerTable } from '@/components/treasury/LedgerTable';
import { CashoutHistory } from '@/components/treasury/CashoutHistory';
import { WalletConnectButton } from '@/components/treasury/WalletConnectButton';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

export default function Treasury() {
  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">קופה</h1>
            <p className="text-muted-foreground mt-1">
              ניהול יתרות ומשיכת כספים
            </p>
          </div>
          <WalletConnectButton />
        </div>
        
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Balance & Withdraw */}
          <div className="space-y-6">
            <TreasuryBalanceCard />
            <WithdrawPanel />
          </div>
          
          {/* Right Column - History */}
          <div className="space-y-6">
            <CashoutHistory />
          </div>
        </div>
        
        {/* Ledger Table - Full Width */}
        <div className="mt-6">
          <LedgerTable />
        </div>
        
        {/* Security Notice */}
        <Card className="mt-6 glass-card border-warning/30">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 shrink-0 rounded-full bg-warning/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold">אבטחת כספים</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• אין מפתחות פרטיים (Private Keys) בשרת</li>
                  <li>• כל משיכה דורשת חתימה ידנית מהארנק שלך</li>
                  <li>• כל העסקאות מתועדות ב-blockchain</li>
                  <li>• Human-in-the-Loop - אין העברות אוטומטיות</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
