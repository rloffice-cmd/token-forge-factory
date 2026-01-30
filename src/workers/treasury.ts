/**
 * Treasury Worker
 * Manages token ledger (Watch-Only mode)
 * No private keys - just tracking
 */

import type { TreasuryEntry } from '@/types';

// Mock asset configuration
const MOCK_ASSET = 'DTF-TOKEN';
const MOCK_REWARD_PER_PASS = 50; // Base reward
const MOCK_SCORE_MULTIPLIER = 2; // Bonus based on score

/**
 * Calculate reward for a passed job
 */
export function calculateReward(score: number): number {
  if (score < 0.95) {
    return 0; // Must pass threshold
  }
  
  // Base reward + bonus for high scores
  const baseReward = MOCK_REWARD_PER_PASS;
  const bonusMultiplier = 1 + (score - 0.95) * MOCK_SCORE_MULTIPLIER;
  
  return Math.round(baseReward * bonusMultiplier * 100) / 100;
}

/**
 * Create a treasury entry for a rewarded job
 */
export function createTreasuryEntry(
  jobId: string,
  score: number
): TreasuryEntry | null {
  const amount = calculateReward(score);
  
  if (amount === 0) {
    return null;
  }
  
  return {
    id: `treasury-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    asset: MOCK_ASSET,
    amount,
    job_id: jobId,
    created_at: new Date().toISOString(),
  };
}

/**
 * Calculate total balance from entries
 */
export function calculateTotalBalance(entries: TreasuryEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.amount, 0);
}

/**
 * Group entries by asset
 */
export function groupByAsset(entries: TreasuryEntry[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  
  for (const entry of entries) {
    grouped[entry.asset] = (grouped[entry.asset] || 0) + entry.amount;
  }
  
  return grouped;
}

/**
 * Generate treasury summary
 */
export function generateTreasurySummary(entries: TreasuryEntry[]): string {
  const lines: string[] = [];
  const total = calculateTotalBalance(entries);
  const byAsset = groupByAsset(entries);
  
  lines.push('=== Treasury Summary (MOCK) ===');
  lines.push('');
  lines.push('Balances:');
  for (const [asset, amount] of Object.entries(byAsset)) {
    lines.push(`  ${asset}: ${amount.toFixed(2)}`);
  }
  lines.push('');
  lines.push(`Total Value: ${total.toFixed(2)} (MOCK)`);
  lines.push('');
  lines.push(`Transactions: ${entries.length}`);
  lines.push('');
  lines.push('⚠️ Watch-Only Mode');
  lines.push('No private keys stored. Manual redemption required.');
  
  return lines.join('\n');
}

/**
 * Generate notification message for user
 */
export function generateRewardNotification(entry: TreasuryEntry): {
  title: string;
  message: string;
} {
  return {
    title: '🎉 תגמול התקבל!',
    message: `קיבלת ${entry.amount.toFixed(2)} ${entry.asset} עבור ${entry.job_id}. ` +
      `הטוקנים זמינים למימוש ב-CEX.`,
  };
}

/**
 * Validate wallet address format (basic check)
 */
export function isValidWalletAddress(address: string): boolean {
  // Basic Ethereum-style address check
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Format wallet address for display
 */
export function formatWalletAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
