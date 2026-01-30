/**
 * Safe (Gnosis Safe) Integration
 * Treasury wallet management via Safe multisig
 * 
 * CRITICAL: This is the REAL treasury - a Safe that holds actual funds
 * User signs proposals as Safe owner, NOT sends from personal wallet
 */

import SafeApiKit from '@safe-global/api-kit';
import Safe from '@safe-global/protocol-kit';
import { MetaTransactionData } from '@safe-global/safe-core-sdk-types';
import { parseEther, formatEther, createPublicClient, http } from 'viem';
import { mainnet, sepolia } from 'viem/chains';

// Network configuration
export const NETWORK_CONFIG = {
  ethereum: {
    chainId: 1,
    chain: mainnet,
    rpcUrl: 'https://eth.llamarpc.com',
    safeApiUrl: 'https://safe-transaction-mainnet.safe.global',
  },
  sepolia: {
    chainId: 11155111,
    chain: sepolia,
    rpcUrl: 'https://rpc.sepolia.org',
    safeApiUrl: 'https://safe-transaction-sepolia.safe.global',
  },
} as const;

export type NetworkType = keyof typeof NETWORK_CONFIG;

// Treasury Safe address - THIS IS WHERE THE MONEY LIVES
// Replace with your actual Safe address after creation
export const TREASURY_SAFE_ADDRESS = import.meta.env.VITE_TREASURY_SAFE_ADDRESS || '';

// User's destination wallet for payouts
export const USER_PAYOUT_ADDRESS = '0xA3A10bf24FE60f1733CC77E6D00763E9C12a9d0C' as const;

// Minimum withdrawal threshold
export const MIN_WITHDRAWAL_ETH = 0.01;

/**
 * Get public client for on-chain queries
 */
export function getPublicClient(network: NetworkType = 'ethereum') {
  const config = NETWORK_CONFIG[network];
  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
}

/**
 * Get Safe API Kit for transaction service
 */
export function getSafeApiKit(network: NetworkType = 'ethereum'): SafeApiKit {
  const config = NETWORK_CONFIG[network];
  return new SafeApiKit({
    chainId: BigInt(config.chainId),
  });
}

/**
 * Get Safe balance from chain (REAL SOURCE OF TRUTH)
 */
export async function getSafeBalance(
  safeAddress: string,
  network: NetworkType = 'ethereum'
): Promise<{ eth: bigint; ethFormatted: string }> {
  const client = getPublicClient(network);
  const balance = await client.getBalance({ address: safeAddress as `0x${string}` });
  
  return {
    eth: balance,
    ethFormatted: formatEther(balance),
  };
}

/**
 * Get current ETH price from CoinGecko (FREE, no API key)
 * CRITICAL: Do NOT use hardcoded prices for real money
 */
export async function getEthPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    const data = await response.json();
    return data.ethereum.usd;
  } catch (error) {
    console.error('Failed to fetch ETH price:', error);
    // Fallback - but log warning
    console.warn('⚠️ Using fallback ETH price - NOT FOR PRODUCTION');
    return 3500;
  }
}

/**
 * Check if address is a Safe owner
 */
export async function isSafeOwner(
  safeAddress: string,
  ownerAddress: string,
  network: NetworkType = 'ethereum'
): Promise<boolean> {
  try {
    const apiKit = getSafeApiKit(network);
    const safeInfo = await apiKit.getSafeInfo(safeAddress);
    return safeInfo.owners.some(
      (owner) => owner.toLowerCase() === ownerAddress.toLowerCase()
    );
  } catch (error) {
    console.error('Failed to check Safe owner:', error);
    return false;
  }
}

/**
 * Get pending transactions for a Safe
 */
export async function getPendingTransactions(
  safeAddress: string,
  network: NetworkType = 'ethereum'
) {
  const apiKit = getSafeApiKit(network);
  return apiKit.getPendingTransactions(safeAddress);
}

/**
 * Create a payout transaction proposal
 * This creates a proposal in the Safe - does NOT execute yet
 */
export async function createPayoutProposal(
  safeAddress: string,
  toAddress: string,
  amountEth: string,
  signerAddress: string,
  network: NetworkType = 'ethereum'
): Promise<{ safeTxHash: string }> {
  const config = NETWORK_CONFIG[network];
  
  // Initialize Safe Protocol Kit
  const protocolKit = await Safe.init({
    provider: config.rpcUrl,
    safeAddress,
    signer: signerAddress, // This will need wallet connection
  });
  
  // Create transaction data
  const txData: MetaTransactionData = {
    to: toAddress,
    value: parseEther(amountEth).toString(),
    data: '0x', // Simple ETH transfer
  };
  
  // Create Safe transaction
  const safeTx = await protocolKit.createTransaction({
    transactions: [txData],
  });
  
  // Get transaction hash
  const safeTxHash = await protocolKit.getTransactionHash(safeTx);
  
  // Propose to Safe Transaction Service
  const apiKit = getSafeApiKit(network);
  await apiKit.proposeTransaction({
    safeAddress,
    safeTransactionData: safeTx.data,
    safeTxHash,
    senderAddress: signerAddress,
    senderSignature: '', // Will be signed by wallet
  });
  
  return { safeTxHash };
}

/**
 * Verify a transaction on-chain
 * CRITICAL: Always verify before marking as confirmed
 */
export async function verifyTransaction(
  txHash: string,
  expectedTo: string,
  expectedValue: bigint,
  network: NetworkType = 'ethereum'
): Promise<{
  verified: boolean;
  status: 'pending' | 'confirmed' | 'failed';
  blockNumber?: bigint;
  error?: string;
}> {
  try {
    const client = getPublicClient(network);
    
    // Get transaction receipt
    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
    
    if (!receipt) {
      return { verified: false, status: 'pending' };
    }
    
    // Get original transaction
    const tx = await client.getTransaction({
      hash: txHash as `0x${string}`,
    });
    
    // Verify destination and value
    const toMatches = tx.to?.toLowerCase() === expectedTo.toLowerCase();
    const valueMatches = tx.value === expectedValue;
    
    if (!toMatches || !valueMatches) {
      return {
        verified: false,
        status: 'failed',
        error: `Transaction mismatch: to=${toMatches}, value=${valueMatches}`,
      };
    }
    
    // Check if successful
    if (receipt.status === 'success') {
      return {
        verified: true,
        status: 'confirmed',
        blockNumber: receipt.blockNumber,
      };
    } else {
      return {
        verified: false,
        status: 'failed',
        error: 'Transaction reverted',
      };
    }
  } catch (error) {
    console.error('Failed to verify transaction:', error);
    return {
      verified: false,
      status: 'pending',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Format Safe balance for display
 */
export function formatSafeBalance(ethBalance: bigint, ethPrice: number): {
  eth: string;
  usd: string;
} {
  const ethFormatted = formatEther(ethBalance);
  const ethNum = parseFloat(ethFormatted);
  const usdValue = ethNum * ethPrice;
  
  return {
    eth: ethNum.toFixed(6),
    usd: usdValue.toFixed(2),
  };
}

/**
 * Get Etherscan URL for Safe
 */
export function getSafeExplorerUrl(safeAddress: string, network: NetworkType = 'ethereum'): string {
  const baseUrl = network === 'ethereum' 
    ? 'https://app.safe.global/home?safe=eth:'
    : 'https://app.safe.global/home?safe=sep:';
  return `${baseUrl}${safeAddress}`;
}

/**
 * Get Etherscan TX URL
 */
export function getTxExplorerUrl(txHash: string, network: NetworkType = 'ethereum'): string {
  const baseUrl = network === 'ethereum' 
    ? 'https://etherscan.io/tx/'
    : 'https://sepolia.etherscan.io/tx/';
  return `${baseUrl}${txHash}`;
}
