/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DecisionItem, SignalItem, MarketPrice } from './types';

export const REAL_ONCHAIN_TXS = [
  '0xefe60d8c8025caa14b289121daf8ba975f57b413be9ead055b4e81445ede3607',
  '0x0fc458e94d8cec549b148181d7a3adb0bc9cbc7d83a65dbeb29b30424f600201',
  '0x002d49e0158bdb0b3fab9fd93fa5266fd1d11257919d257c6c470c7aa7e6dd54',
  '0x66df0f4281f7640654c8213b08085a6761cdf63372757450049d2f65a6230d8a',
  '0xf4ccae6903af95406bb7a0525072b3d68fb1935b69dee1880558ef4d1c18713c',
  '0x8049865570df1f8d03d3b78b9e2882c721ea9aa9ce80f95102c0b67d0e69b3cd',
  '0xc649871debf08dc39817258c69ddde79761507598eec415a8f6e173a24175a49',
  '0x2f157c978569f9d854c8a4965eb814e6729a0b634481bdc036d3cec6c815166d',
  '0x34cb2fdd195ba92e519ec96d0ecc6240e7f7a4fa5f699c6c744cb7d91689c875',
  '0xf1f0097fa8227976600e202b0e548d67358690a63dd63d31cbfe9f86e205373a'
];

export function getRandomOnChainHash(): string {
  return REAL_ONCHAIN_TXS[Math.floor(Math.random() * REAL_ONCHAIN_TXS.length)];
}

// Generates a valid hex character sequence. Length 40 generates a valid EVM address size.
export function generateRandomHash(length: number = 64): string {
  const chars = '0123456789abcdef';
  let result = '0x';
  const actualLen = length === 40 ? 40 : length;
  for (let i = 0; i < actualLen; i++) {
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
    txHash: '0xefe60d8c8025caa14b289121daf8ba975f57b413be9ead055b4e81445ede3607',
    timestamp: '18:31:27 UTC',
    action: 'ROTATE',
    fromAsset: 'mETH',
    toAsset: 'USDY',
    amount: 1420,
    confidence: 0.79,
    reasoning: 'Chainlink oracle confirms stable yield spread deviation. Executed rebalance out of mETH and rotated capital into Ondo US Dollar Yield stable positions to capture 5.05% yield.',
    signalBundleHash: 'QmXAo2AGBu3JtvEzsAeCpDhij1KQLoC38D2z5cxf5cvb4t',
    zkProofHash: '0xefe60d8c8025caa14b289121daf8ba975f57b413be9ead055b4e81445ede3607',
    erc8004TaskId: 'task_0xefe60d',
    status: 'success',
    outcomeDelta: '+$42.50 (Captured +1.10% benefit)',
    gasCost: '0.0031 MNT',
    reputationBefore: 851,
    reputationAfter: 853,
    allocationBefore: { mETH: 40, USDY: 35, NVDAx: 15, AAPLx: 7, TSLAx: 3 },
    allocationAfter: { mETH: 37, USDY: 38, NVDAx: 15, AAPLx: 7, TSLAx: 3 }
  },
  {
    id: 'dec-099',
    txHash: '0x0fc458e94d8cec549b148181d7a3adb0bc9cbc7d83a65dbeb29b30424f600201',
    timestamp: '18:21:59 UTC',
    action: 'SKIP',
    fromAsset: 'mETH',
    toAsset: 'USDY',
    amount: 0,
    confidence: 0.20,
    reasoning: 'Signal confidence 20.3% below 30% threshold. Market closed — xStock prices stale. Switch to YIELD-ONLY mode. Safe-harbor ratios maintained.',
    signalBundleHash: 'QmYGHRYGtdzVM9trQj7feVDMerciTu52ezj6f2nKrxkWgW',
    zkProofHash: '0xc0660c51ce7b2acc2a149071e3dae99042e20fb09f5756a0d9f9c5c12977d8a1',
    erc8004TaskId: 'task_0x0fc458',
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
    txHash: '0x002d49e0158bdb0b3fab9fd93fa5266fd1d11257919d257c6c470c7aa7e6dd54',
    timestamp: '18:14:07 UTC',
    action: 'SKIP',
    fromAsset: 'TSLAx',
    toAsset: 'USDY',
    amount: 0,
    confidence: 0.22,
    reasoning: 'TSLAx negative social noise flagged, but aggregated signal weight (0.22) does not exceed configured cognitive execution threshold of 0.55. System continues monitoring with neutral stance.',
    signalBundleHash: 'QmX6wAPzEwnPyf1DTSA2DcA219uV39w9w3j255S6uSj1L1A',
    zkProofHash: '0x002d49e0158bdb0b3fab9fd93fa5266fd1d11257919d257c6c470c7aa7e6dd54',
    erc8004TaskId: 'task_0x002d49',
    status: 'success',
    outcomeDelta: 'No loss (Position stabilized)',
    gasCost: '0.0031 MNT',
    reputationBefore: 851,
    reputationAfter: 851,
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
