/**
 * Treasury hooks for V2
 * Manages wallet, ledger, and cashout operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TreasuryWallet, TreasuryLedgerEntry, CashoutRequest, TreasuryBalance, LedgerDirection } from '@/types/treasury';

// ==========================================
// TREASURY WALLET
// ==========================================

export function useTreasuryWallet() {
  return useQuery({
    queryKey: ['treasury-wallet'],
    queryFn: async (): Promise<TreasuryWallet | null> => {
      const { data, error } = await supabase
        .from('treasury_wallet')
        .select('*')
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      return {
        id: data.id,
        address: data.address,
        network: data.network,
        label: data.label || 'Treasury',
        created_at: data.created_at,
      };
    },
  });
}

// ==========================================
// TREASURY LEDGER
// ==========================================

export function useTreasuryLedger() {
  return useQuery({
    queryKey: ['treasury-ledger'],
    queryFn: async (): Promise<TreasuryLedgerEntry[]> => {
      const { data, error } = await supabase
        .from('treasury_ledger')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(row => ({
        id: row.id,
        asset: row.asset,
        amount: Number(row.amount),
        job_id: row.job_id,
        direction: (row.direction || 'IN') as LedgerDirection,
        tx_hash: row.tx_hash || null,
        created_at: row.created_at,
      }));
    },
  });
}

// ==========================================
// TREASURY BALANCE
// ==========================================

export function useTreasuryBalance() {
  return useQuery({
    queryKey: ['treasury-balance'],
    queryFn: async (): Promise<TreasuryBalance> => {
      // Fetch ledger entries
      const { data: ledger, error: ledgerError } = await supabase
        .from('treasury_ledger')
        .select('amount, direction');
      
      if (ledgerError) throw ledgerError;
      
      // Fetch pending cashout requests
      const { data: pending, error: pendingError } = await supabase
        .from('cashout_requests')
        .select('amount_dtf')
        .in('status', ['pending', 'signed', 'submitted']);
      
      if (pendingError) throw pendingError;
      
      // Calculate totals
      const totalIn = (ledger || [])
        .filter(e => (e.direction || 'IN') === 'IN')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      
      const totalOut = (ledger || [])
        .filter(e => e.direction === 'OUT')
        .reduce((sum, e) => sum + Number(e.amount), 0);
      
      const pendingWithdrawal = (pending || [])
        .reduce((sum, e) => sum + Number(e.amount_dtf), 0);
      
      const total_dtf = totalIn - totalOut;
      const available_dtf = Math.max(0, total_dtf - pendingWithdrawal);
      
      return {
        total_dtf,
        total_usd: total_dtf * 0.42, // DTF_USD_RATE
        available_dtf,
        pending_withdrawal_dtf: pendingWithdrawal,
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// ==========================================
// CASHOUT REQUESTS
// ==========================================

export function useCashoutRequests() {
  return useQuery({
    queryKey: ['cashout-requests'],
    queryFn: async (): Promise<CashoutRequest[]> => {
      const { data, error } = await supabase
        .from('cashout_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(row => ({
        id: row.id,
        amount_dtf: Number(row.amount_dtf),
        amount_usd: Number(row.amount_usd),
        amount_eth: row.amount_eth ? Number(row.amount_eth) : null,
        eth_price_usd: row.eth_price_usd ? Number(row.eth_price_usd) : null,
        wallet_address: row.wallet_address,
        network: row.network,
        status: row.status as CashoutRequest['status'],
        tx_hash: row.tx_hash,
        error_message: row.error_message,
        created_at: row.created_at,
        signed_at: row.signed_at,
        submitted_at: row.submitted_at,
        confirmed_at: row.confirmed_at,
      }));
    },
  });
}

export function useCreateCashoutRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: {
      amount_dtf: number;
      amount_usd: number;
      amount_eth: number;
      eth_price_usd: number;
      wallet_address: string;
      network: string;
    }): Promise<CashoutRequest> => {
      const { data, error } = await supabase
        .from('cashout_requests')
        .insert({
          amount_dtf: request.amount_dtf,
          amount_usd: request.amount_usd,
          amount_eth: request.amount_eth,
          eth_price_usd: request.eth_price_usd,
          wallet_address: request.wallet_address,
          network: request.network,
          status: 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        id: data.id,
        amount_dtf: Number(data.amount_dtf),
        amount_usd: Number(data.amount_usd),
        amount_eth: data.amount_eth ? Number(data.amount_eth) : null,
        eth_price_usd: data.eth_price_usd ? Number(data.eth_price_usd) : null,
        wallet_address: data.wallet_address,
        network: data.network,
        status: data.status as CashoutRequest['status'],
        tx_hash: data.tx_hash,
        error_message: data.error_message,
        created_at: data.created_at,
        signed_at: data.signed_at,
        submitted_at: data.submitted_at,
        confirmed_at: data.confirmed_at,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashout-requests'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-balance'] });
    },
  });
}

export function useUpdateCashoutRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      tx_hash,
      error_message,
    }: { 
      id: string; 
      status: CashoutRequest['status'];
      tx_hash?: string;
      error_message?: string;
    }) => {
      const updates: Record<string, unknown> = { status };
      
      if (status === 'signed') {
        updates.signed_at = new Date().toISOString();
      } else if (status === 'submitted') {
        updates.submitted_at = new Date().toISOString();
        if (tx_hash) updates.tx_hash = tx_hash;
      } else if (status === 'confirmed') {
        updates.confirmed_at = new Date().toISOString();
      } else if (status === 'failed') {
        if (error_message) updates.error_message = error_message;
      }
      
      const { error } = await supabase
        .from('cashout_requests')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashout-requests'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-balance'] });
      queryClient.invalidateQueries({ queryKey: ['treasury-ledger'] });
    },
  });
}
