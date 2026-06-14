/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SignalSource = 'PYTH' | 'NANSEN' | 'ELFA' | 'MANTLE';
export type SignalStatus = 'ACTED' | 'SKIPPED' | 'WATCHING';

export interface SignalItem {
  id: string;
  timestamp: string; // e.g., "14:15:32 UTC"
  source: SignalSource;
  description: string;
  status: SignalStatus;
  weight: number; // 0 to 1
  details?: Record<string, any>;
}

export type DecisionAction = 'ROTATE' | 'CLMM_OPEN' | 'CLMM_CLOSE' | 'SKIP';

export interface DecisionItem {
  id: string;
  txHash: string;
  timestamp: string;
  action: DecisionAction;
  fromAsset: string;
  toAsset: string;
  amount: number; // in USD
  confidence: number; // 0 to 1
  reasoning: string;
  signalBundleHash: string;
  zkProofHash: string;
  erc8004TaskId: string;
  status: 'pending' | 'success' | 'failed';
  outcomeDelta?: string;
  gasCost?: string;
  reputationBefore: number;
  reputationAfter: number;
  allocationBefore: Record<string, number>;
  allocationAfter: Record<string, number>;
}

export interface MarketPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: string;
  sparkline: number[];
}
