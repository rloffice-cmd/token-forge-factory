/**
 * Token Forge - M2M Money Machine Dashboard
 * Signal Radar → Partner Dispatch → Revenue Tracking
 */

import { AppLayout } from '@/components/AppLayout';
import { SignalRadar } from '@/components/forge/SignalRadar';
import { DispatchLedger } from '@/components/forge/DispatchLedger';
import { FinancialHealth } from '@/components/forge/FinancialHealth';
import { ForgeHeader } from '@/components/forge/ForgeHeader';

export default function ForgeMoneyMachine() {
  return (
    <AppLayout>
      <div className="p-4 lg:p-8 space-y-6">
        <ForgeHeader />
        <FinancialHealth />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SignalRadar />
          <DispatchLedger />
        </div>
      </div>
    </AppLayout>
  );
}
