/**
 * Treasury Types for V2
 */

export type PayoutStatus = 'pending' | 'signed' | 'submitted' | 'confirmed' | 'failed';
export type LedgerDirection = 'IN' | 'OUT';

export interface TreasuryWallet {
  id: string;
  address: string;
  network: string;
  label: string;
  created_at: string;
}

export interface TreasuryLedgerEntry {
  id: string;
  asset: string;
  amount: number;
  job_id: string;
  direction: LedgerDirection;
  tx_hash: string | null;
  created_at: string;
}

export interface CashoutRequest {
  id: string;
  amount_dtf: number;
  amount_usd: number;
  amount_eth: number | null;
  eth_price_usd: number | null;
  wallet_address: string;
  network: string;
  status: PayoutStatus;
  tx_hash: string | null;
  error_message: string | null;
  created_at: string;
  signed_at: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
}

export interface TreasuryBalance {
  total_dtf: number;
  total_usd: number;
  available_dtf: number; // After pending withdrawals
  pending_withdrawal_dtf: number;
}

export interface WithdrawalRequest {
  amount_dtf: number;
  wallet_address: string;
  network: string;
}
