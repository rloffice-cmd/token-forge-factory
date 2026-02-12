/**
 * Neural Forge V4.0 — Command Center
 * The Ultimate Affiliate Arbitrage Dashboard
 */

import { AppLayout } from '@/components/AppLayout';
import { SignalRadar } from '@/components/forge/SignalRadar';
import { DispatchLedger } from '@/components/forge/DispatchLedger';
import { FinancialHealth } from '@/components/forge/FinancialHealth';
import { ForgeHeader } from '@/components/forge/ForgeHeader';
import { ClickTicker } from '@/components/forge/ClickTicker';
import { ArenaScore } from '@/components/forge/ArenaScore';
import { LiveRevenueFeed } from '@/components/forge/LiveRevenueFeed';

export default function ForgeMoneyMachine() {
  return (
    <AppLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <ForgeHeader />
        <FinancialHealth />

        {/* Command Center: Revenue + Arena */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LiveRevenueFeed />
          </div>
          <ArenaScore />
        </div>

        {/* Signals + Clicks */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SignalRadar />
          <ClickTicker />
        </div>

        {/* Dispatch Ledger */}
        <DispatchLedger />
      </div>
    </AppLayout>
  );
}
