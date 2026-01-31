/**
 * Revenue Data Hook
 * Fetches REAL payment data from confirmed webhooks
 * This is the SOURCE OF TRUTH for revenue
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConfirmedPayment {
  id: string;
  amount_eth: number | null;
  amount_usd: number;
  credits_purchased: number;
  charge_id: string | null;
  charge_code: string | null;
  provider: string;
  confirmed_at: string;
  created_at: string;
  customer_email?: string;
  tx_hash?: string;
  currency?: string;
}

export interface RevenueStats {
  totalEth: number;
  totalUsd: number;
  totalPayments: number;
  todayUsd: number;
  todayPayments: number;
  last7DaysUsd: number;
  last30DaysUsd: number;
}

export interface DailyRevenue {
  date: string;
  amount_usd: number;
  amount_eth: number;
  count: number;
}

/**
 * Fetch all confirmed payments
 */
export function useConfirmedPayments() {
  return useQuery({
    queryKey: ['confirmed-payments'],
    queryFn: async (): Promise<ConfirmedPayment[]> => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          amount_eth,
          amount_usd,
          credits_purchased,
          charge_id,
          charge_code,
          provider,
          confirmed_at,
          created_at,
          metadata,
          users_customers(email)
        `)
        .eq('status', 'confirmed')
        .order('confirmed_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(row => ({
        id: row.id,
        amount_eth: row.amount_eth ? Number(row.amount_eth) : null,
        amount_usd: Number(row.amount_usd),
        credits_purchased: Number(row.credits_purchased),
        charge_id: row.charge_id,
        charge_code: row.charge_code,
        provider: row.provider,
        confirmed_at: row.confirmed_at || row.created_at,
        created_at: row.created_at,
        customer_email: (row.users_customers as any)?.email,
        tx_hash: (row.metadata as any)?.tx_hash,
        currency: (row.metadata as any)?.currency || 'ETH',
      }));
    },
    refetchInterval: 30000,
  });
}

/**
 * Calculate revenue statistics
 */
export function useRevenueStats() {
  return useQuery({
    queryKey: ['revenue-stats'],
    queryFn: async (): Promise<RevenueStats> => {
      const { data, error } = await supabase
        .from('payments')
        .select('amount_eth, amount_usd, confirmed_at')
        .eq('status', 'confirmed');
      
      if (error) throw error;
      
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const payments = data || [];
      
      const totalEth = payments.reduce((sum, p) => sum + (Number(p.amount_eth) || 0), 0);
      const totalUsd = payments.reduce((sum, p) => sum + Number(p.amount_usd), 0);
      
      const todayPayments = payments.filter(p => 
        new Date(p.confirmed_at!) >= todayStart
      );
      const todayUsd = todayPayments.reduce((sum, p) => sum + Number(p.amount_usd), 0);
      
      const last7DaysPayments = payments.filter(p => 
        new Date(p.confirmed_at!) >= last7Days
      );
      const last7DaysUsd = last7DaysPayments.reduce((sum, p) => sum + Number(p.amount_usd), 0);
      
      const last30DaysPayments = payments.filter(p => 
        new Date(p.confirmed_at!) >= last30Days
      );
      const last30DaysUsd = last30DaysPayments.reduce((sum, p) => sum + Number(p.amount_usd), 0);
      
      return {
        totalEth,
        totalUsd,
        totalPayments: payments.length,
        todayUsd,
        todayPayments: todayPayments.length,
        last7DaysUsd,
        last30DaysUsd,
      };
    },
    refetchInterval: 30000,
  });
}

/**
 * Fetch daily revenue breakdown
 */
export function useDailyRevenue(days: number = 30) {
  return useQuery({
    queryKey: ['daily-revenue', days],
    queryFn: async (): Promise<DailyRevenue[]> => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const { data, error } = await supabase
        .from('payments')
        .select('amount_eth, amount_usd, confirmed_at')
        .eq('status', 'confirmed')
        .gte('confirmed_at', startDate.toISOString())
        .order('confirmed_at', { ascending: true });
      
      if (error) throw error;
      
      // Group by date
      const dailyMap = new Map<string, DailyRevenue>();
      
      for (const payment of data || []) {
        const date = new Date(payment.confirmed_at!).toISOString().split('T')[0];
        const existing = dailyMap.get(date) || { date, amount_usd: 0, amount_eth: 0, count: 0 };
        existing.amount_usd += Number(payment.amount_usd);
        existing.amount_eth += Number(payment.amount_eth) || 0;
        existing.count += 1;
        dailyMap.set(date, existing);
      }
      
      return Array.from(dailyMap.values());
    },
    refetchInterval: 60000,
  });
}
