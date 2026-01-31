/**
 * Treasury Settings Hook
 * Manages treasury_safe_address and payout_wallet_address
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TreasurySettings {
  id: string;
  treasury_safe_address: string | null;
  payout_wallet_address: string | null;
  network: string;
  min_withdrawal_eth: number;
  alert_threshold_dtf: number | null;
  created_at: string;
  updated_at: string;
}

export function useTreasurySettings() {
  return useQuery({
    queryKey: ['treasury-settings'],
    queryFn: async (): Promise<TreasurySettings | null> => {
      const { data, error } = await supabase
        .from('treasury_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data as TreasurySettings | null;
    },
  });
}

export function useUpdateTreasurySettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (updates: Partial<TreasurySettings>) => {
      // Validate addresses are different
      if (
        updates.treasury_safe_address && 
        updates.payout_wallet_address &&
        updates.treasury_safe_address.toLowerCase() === updates.payout_wallet_address.toLowerCase()
      ) {
        throw new Error('כספת Safe חייבת להיות כתובת שונה מארנק פרטי');
      }

      // Get existing settings
      const { data: existing } = await supabase
        .from('treasury_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('treasury_settings')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('treasury_settings')
          .insert({
            ...updates,
            network: updates.network || 'ethereum',
            min_withdrawal_eth: updates.min_withdrawal_eth || 0.01,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treasury-settings'] });
      toast.success('הגדרות נשמרו בהצלחה');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'שגיאה בשמירת הגדרות');
    },
  });
}

/**
 * Validate that Safe address is a contract (not EOA)
 */
export async function validateSafeAddress(address: string): Promise<boolean> {
  try {
    const response = await fetch(`https://eth.llamarpc.com`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [address, 'latest'],
      }),
    });
    
    const data = await response.json();
    // Contract addresses have code, EOA addresses return '0x'
    return data.result && data.result !== '0x';
  } catch (error) {
    console.error('Failed to validate Safe address:', error);
    return false;
  }
}
