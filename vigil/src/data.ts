/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DecisionItem, SignalItem, MarketPrice } from './types';

// Generates a valid 32-byte (64 hex char) transaction hash format — 0x + 64 chars
export function generateRandomHash(length: number = 64): string {
  const chars = '0123456789abcdef';
  let result = '0x';
  // Always generate 64 hex chars (32 bytes) regardless of length param
  for (let i = 0; i < 64; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

export const INITIAL_ALLOCATION = {
  mETH: 35,
  USDY: 40,
  NVDAx: 15,
  AAPLx: 5,
  TSLAx: 5,
};

export const INITIAL_PRICES: MarketPrice[] = [
  { symbol: 'mETH', name: 'Mantle Staked ETH', price: 3842.15, change24h: 1.84, volume24h: '$124.8M', sparkline: [3780, 3795, 3810, 3802, 3825, 3838, 3842] },
  { symbol: 'USDY', name: 'Ondo US Dollar Yield', price: 1.042, change24h: 0.02, volume24h: '$45.2M', sparkline: [1.041, 1.042, 1.042, 1.042, 1.042, 1.042, 1.042] },
  { symbol: 'NVDAx', name: 'NVIDIA Tokenized Stock', price: 118.40, change24h: -3.42, volume24h: '$84.1M', sparkline: [122.5, 120.8, 121.2, 118.9, 119.5, 117.8, 118.4] },
  { symbol: 'AAPLx', name: 'Apple Tokenized Stock', price: 184.20, change24h: 0.72, volume24h: '$19.4M', sparkline: [183.0, 183.2, 184.5, 183.9, 184.0, 184.1, 184.2] },
  { symbol: 'TSLAx', name: 'Tesla Tokenized Stock', price: 312.20, change24h: -2.15, volume24h: '$31.8M', sparkline: [319.0, 317.5, 315.0, 311.2, 314.8, 310.5, 312.2] },
  { symbol: 'MNT', name: 'Mantle Gas Reserve', price: 1.42, change24h: 4.81, volume24h: '$250.3M', sparkline: [1.35, 1.38, 1.40, 1.39, 1.41, 1.43, 1.42] },
];

export const INITIAL_SIGNALS: SignalItem[] = [
  {
    id: 'sig-001',
    timestamp: '08:05:12 UTC',
    source: 'CHAINLINK',
    description: 'mETH yield oracle reports staking APR increase to 3.84% (+0.08% deviation).',
    status: 'WATCHING',
    weight: 0.38,
    details: { baseApr: '3.76%', newApr: '3.84%', standardDev: '0.04' }
  },
  {
    id: 'sig-002',
    timestamp: '07:45:00 UTC',
    source: 'ELFA',
    description: 'NVDAx negative sentiment spike (-18.2%) observed over 4 hours following revenue guidance revise.',
    status: 'ACTED',
    weight: 0.76,
    details: { keyword: 'NVDAx', count: 184, impactScore: '0.82' }
  },
  {
    id: 'sig-003',
    timestamp: '07:30:15 UTC',
    source: 'NANSEN',
    description: 'Two smart wallets exiting NVDAx with aggregated net flow of -$1.2M.',
    status: 'ACTED',
    weight: 0.81,
    details: { txsCount: 2, netFlowUsd: -1204000, avgGasMnt: 3.4 }
  },
  {
    id: 'sig-004',
    timestamp: '07:15:30 UTC',
    source: 'MANTLE',
    description: 'Ondo USDY 7-day effective yield confirms steady state at 5.05%. Spread vs mETH: 1.21%.',
    status: 'SKIPPED',
    weight: 0.45,
    details: { spread: '1.21%', stabilityFlag: 'HIGH' }
  },
  {
    id: 'sig-005',
    timestamp: '06:50:22 UTC',
    source: 'CHAINLINK',
    description: 'NASDAQ aftermarket reports Apple Inc. major compliance milestone. AAPLx price adjustment imminent.',
    status: 'WATCHING',
    weight: 0.52,
    details: { oracleId: 'backed-cl-feed-41', adjustedValueClass: 'AAPL_EQ' }
  },
  {
    id: 'sig-006',
    timestamp: '06:12:05 UTC',
    source: 'MANTLE',
    description: 'Byreal SOL CLMM MNT-USDC pool APR surges to 7.82% following token bridge incentives launch.',
    status: 'ACTED',
    weight: 0.88,
    details: { poolApr: '7.82%', differential: '3.98%', routingAllowed: true }
  },
  {
    id: 'sig-007',
    timestamp: '05:30:00 UTC',
    source: 'NANSEN',
    description: 'Smart Money on-chain staking accumulations of mETH increase by 420 ETH across 4 separate tracked addresses.',
    status: 'SKIPPED',
    weight: 0.54,
    details: { trackedWallets: 4, aggregateEth: 420 }
  }
];

export const INITIAL_DECISIONS: DecisionItem[] = [
  {
    id: 'dec-100',
    // Real Mantle Sepolia VIGILVault SkipLogged TX
    txHash: '0x2f6dfb055e50408892f9d1ca82d7b86e929692542dfc3d6ed962bfa431f61687',
    timestamp: '09:13:02 UTC',
    action: 'SKIP',
    fromAsset: 'mETH',
    toAsset: 'USDY',
    amount: 0,
    confidence: 0.21,
    reasoning: 'Signal confidence 21.0% below 30% threshold for yield trade. xStock prices stale (market closed) — monitoring yield spread. Switching to YIELD-ONLY mode.',
    signalBundleHash: 'QmXAo2AGBu3JtvEzsAeCpDhij1KQLoC38D2z5cxf5cvb4t',
    zkProofHash: '0xc0660c51ce7b2acc2a149071e3dae99042e20fb09f5756a0d9f9c5c12977d8a1',
    erc8004TaskId: 'task_0x2f6dfb',
    status: 'success',
    outcomeDelta: 'No loss (Position stabilized)',
    gasCost: '0.0031 MNT',
    reputationBefore: 851,
    reputationAfter: 851,
    allocationBefore: { mETH: 40, USDY: 35, NVDAx: 15, AAPLx: 7, TSLAx: 3 },
    allocationAfter: { mETH: 40, USDY: 35, NVDAx: 15, AAPLx: 7, TSLAx: 3 }
  },
  {
    id: 'dec-099',
    // Real Mantle Sepolia VIGILVault SkipLogged TX
    txHash: '0x547cca510e52f250ee6a0c1414109f7032a229d4feff483a36cd1adcc4bbfb57',
    timestamp: '06:23:39 UTC',
    action: 'SKIP',
    fromAsset: 'mETH',
    toAsset: 'USDY',
    amount: 0,
    confidence: 0.20,
    reasoning: 'Signal confidence 20.3% below 30% threshold. Market closed — xStock prices stale by 44,983s. Byreal PENGUIN/USDC APR 89.30% noted but confidence threshold not met. Monitoring.',
    signalBundleHash: 'QmYGHRYGtdzVM9trQj7feVDMerciTu52ezj6f2nKrxkWgW',
    zkProofHash: '0xc0660c51ce7b2acc2a149071e3dae99042e20fb09f5756a0d9f9c5c12977d8a1',
    erc8004TaskId: 'task_0x547cca',
    status: 'success',
    outcomeDelta: 'No loss (Position stabilized)',
    gasCost: '0.0031 MNT',
    reputationBefore: 851,
    reputationAfter: 851,
    allocationBefore: { mETH: 40, USDY: 35, NVDAx: 15, AAPLx: 7, TSLAx: 3 },
    allocationAfter: { mETH: 40, USDY: 35, NVDAx: 15, AAPLx: 7, TSLAx: 3 }
  },
  {
    id: 'dec-098',
    txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: '03:30:00 UTC',
    action: 'SKIP',
    fromAsset: 'TSLAx',
    toAsset: 'USDY',
    amount: 0,
    confidence: 0.41,
    reasoning: 'TSLAx negative social noise flagged, but aggregated signal weight (0.41) does not exceed configured cognitive execution threshold of 0.55. System will continue surveillance with neutral portfolio stance.',
    signalBundleHash: 'QmX6wAPzEwnPyf1DTSA2DcA219uV39w9w3j255S6uSj1L1A',
    zkProofHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    erc8004TaskId: 'task_0x12c441',
    status: 'success',
    outcomeDelta: 'No loss (Position stabilized)',
    gasCost: '0 MNT',
    reputationBefore: 841,
    reputationAfter: 841,
    allocationBefore: { mETH: 45, USDY: 40, NVDAx: 5, AAPLx: 5, TSLAx: 5 },
    allocationAfter: { mETH: 45, USDY: 40, NVDAx: 5, AAPLx: 5, TSLAx: 5 }
  }
];


export const TEMPLATE_PHRASES = {
  narratives: [
    "Macro analysis signals premium yield deviation. Adjusting staking balances to protect principal and optimize capital efficiency.",
    "Significant high-frequency on-chain volume shifts from whale accumulation index. Initiating guardrail checks.",
    "Volatility patterns detected relative to after-hours geopolitical news. Shifting equity ratios into Ondo US Dollar Yield stable positions.",
    "Dynamic liquidity rebalancing triggered via Mantle Super Portal cross-chain module for high-capacity yield pools.",
  ],
  assets: ['mETH', 'USDY', 'NVDAx', 'AAPLx', 'TSLAx'],
};
