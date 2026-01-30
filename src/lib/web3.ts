/**
 * Web3 Configuration for WalletConnect + wagmi
 * Ethereum Mainnet configuration for Treasury operations
 */

import { http, createConfig } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { createWeb3Modal } from '@web3modal/wagmi';
import { walletConnect, injected, coinbaseWallet } from 'wagmi/connectors';

// WalletConnect Project ID - get from cloud.walletconnect.com
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id';

// Metadata for WalletConnect
const metadata = {
  name: 'Data Factory Treasury',
  description: 'Autonomous AI Treasury System',
  url: window.location.origin,
  icons: [window.location.origin + '/favicon.ico'],
};

// Wagmi configuration
export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  connectors: [
    walletConnect({ projectId, metadata, showQrModal: false }),
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: metadata.name,
      appLogoUrl: metadata.icons[0],
    }),
  ],
});

// Initialize Web3Modal
export const web3Modal = createWeb3Modal({
  wagmiConfig,
  projectId,
  enableAnalytics: false,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': 'hsl(var(--primary))',
  },
});

// User's fixed withdrawal wallet address
export const USER_WALLET_ADDRESS = '0xA3A10bf24FE60f1733CC77E6D00763E9C12a9d0C' as const;

// Supported networks
export const SUPPORTED_NETWORKS = {
  ethereum: mainnet,
  sepolia: sepolia,
} as const;

// Default network for production
export const DEFAULT_NETWORK = 'ethereum' as const;

// ETH to USD mock rate (in production, fetch from oracle/API)
export const ETH_USD_RATE = 3500;

// Minimum withdrawal amount in DTF
export const MIN_WITHDRAWAL_DTF = 1000;

// DTF to USD conversion rate
export const DTF_USD_RATE = 0.42;

/**
 * Format address for display
 */
export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Get Etherscan URL for transaction
 */
export function getEtherscanUrl(txHash: string, network: 'ethereum' | 'sepolia' = 'ethereum'): string {
  const baseUrl = network === 'ethereum' 
    ? 'https://etherscan.io' 
    : 'https://sepolia.etherscan.io';
  return `${baseUrl}/tx/${txHash}`;
}

/**
 * Get Etherscan URL for address
 */
export function getEtherscanAddressUrl(address: string, network: 'ethereum' | 'sepolia' = 'ethereum'): string {
  const baseUrl = network === 'ethereum' 
    ? 'https://etherscan.io' 
    : 'https://sepolia.etherscan.io';
  return `${baseUrl}/address/${address}`;
}

/**
 * Convert DTF to ETH
 */
export function dtfToEth(dtfAmount: number, ethPriceUsd: number = ETH_USD_RATE): number {
  const usdValue = dtfAmount * DTF_USD_RATE;
  return usdValue / ethPriceUsd;
}

/**
 * Convert DTF to USD
 */
export function dtfToUsd(dtfAmount: number): number {
  return dtfAmount * DTF_USD_RATE;
}

/**
 * Estimate gas for ETH transfer (in gwei)
 */
export function estimateGas(): bigint {
  // Standard ETH transfer gas limit
  return BigInt(21000);
}
