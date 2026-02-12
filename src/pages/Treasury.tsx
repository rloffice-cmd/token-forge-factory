/**
 * Treasury Page - V3
 * Production-grade revenue dashboard
 * SOURCE OF TRUTH: Confirmed webhook payments
 */

import { AppLayout } from '@/components/AppLayout';
import { TreasuryBalanceCard } from '@/components/treasury/TreasuryBalance';
import { WithdrawPanel } from '@/components/treasury/WithdrawPanel';
import { PayPalPayoutPanel } from '@/components/treasury/PayPalPayoutPanel';
import { LedgerTable } from '@/components/treasury/LedgerTable';
import { CashoutHistory } from '@/components/treasury/CashoutHistory';
import { WalletConnectButton } from '@/components/treasury/WalletConnectButton';
import { RevenueOverview } from '@/components/treasury/RevenueOverview';
import { PaymentHistory } from '@/components/treasury/PaymentHistory';
import { RevenueChart } from '@/components/treasury/RevenueChart';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, TrendingUp, Wallet, History } from 'lucide-react';

export default function Treasury() {
  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">קופה</h1>
            <p className="text-muted-foreground mt-1">
              הכנסות אמיתיות מתשלומי קריפטו
            </p>
          </div>
          <WalletConnectButton />
        </div>
        
        {/* Revenue Overview - Top Stats */}
        <div className="mb-8">
          <RevenueOverview />
        </div>
        
        {/* Tabs for different views */}
        <Tabs defaultValue="revenue" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="revenue" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              הכנסות
            </TabsTrigger>
            <TabsTrigger value="wallet" className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              ארנק
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              היסטוריה
            </TabsTrigger>
          </TabsList>
          
          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RevenueChart />
              <PaymentHistory />
            </div>
          </TabsContent>
          
          {/* Wallet Tab */}
          <TabsContent value="wallet" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <TreasuryBalanceCard />
                <WithdrawPanel />
              </div>
              <div className="space-y-6">
                <PayPalPayoutPanel />
                <CashoutHistory />
              </div>
            </div>
          </TabsContent>
          
          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <LedgerTable />
          </TabsContent>
        </Tabs>
        
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
                  <li>• <strong>Zero Custody</strong> - אין מפתחות פרטיים בשרת</li>
                  <li>• כל תשלום מאומת דרך Coinbase Commerce Webhooks</li>
                  <li>• כל העסקאות מתועדות ב-blockchain</li>
                  <li>• <strong>Human-in-the-Loop</strong> - אין משיכות אוטומטיות</li>
                  <li>• התראות Telegram על כל תשלום</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
