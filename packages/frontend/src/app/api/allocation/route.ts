import { ethers } from "ethers";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/allocation
 * Returns the live portfolio allocation by reading directly from
 * VIGILVault.sol on Mantle Sepolia. Also reads total AUM via Chainlink feeds.
 */

import deployments from "../../../../../config/deployments.sepolia.json";

const MANTLE_RPC  = deployments.rpc;
const VAULT_ADDR  = deployments.contracts.VIGILVault;

// Token addresses from config
const TOKEN_ADDRESSES: Record<string, string> = deployments.tokens;

// Colors for the allocation bars in the War Room UI
const TOKEN_COLORS: Record<string, string> = {
  mETH:  "#00D097",
  USDY:  "#60A5FA",
  NVDAx: "#F472B6",
  AAPLx: "#C084FC",
  TSLAx: "#F59E0B",
  MNT:   "#6B8EFF",
};

const VAULT_ABI = [
  "function allocation(address token) view returns (uint256)",
  "function getTotalValue() view returns (uint256)",
  "function whitelistedTokens(address) view returns (bool)",
];

export async function GET() {
  if (!VAULT_ADDR) {
    return NextResponse.json(
      { error: "VIGIL_VAULT_ADDRESS not configured" },
      { status: 503 }
    );
  }

  try {
    const provider = new ethers.JsonRpcProvider(MANTLE_RPC, undefined, { batchMaxCount: 1 });
    const vault    = new ethers.Contract(VAULT_ADDR, VAULT_ABI, provider);

    // Read allocation basis points for every token (sequential to avoid batch rate-limits)
    const tokenEntries = Object.entries(TOKEN_ADDRESSES).filter(([, addr]) => !!addr);
    const allocations: { symbol: string; address: string; bps: number }[] = [];
    for (const [symbol, address] of tokenEntries) {
      try {
        const bps: bigint = await vault.allocation(address);
        allocations.push({ symbol, address, bps: Number(bps) });
      } catch {
        allocations.push({ symbol, address, bps: 0 });
      }
    }
    const totalValueRaw = await vault.getTotalValue().catch(() => 0n);

    // Filter to only tokens with non-zero allocation
    const activeAllocations = allocations.filter(a => a.bps > 0);

    // Total bps should be ≤ 10000 (100%)
    const totalBps = activeAllocations.reduce((sum, a) => sum + a.bps, 0);

    return NextResponse.json({
      allocations: activeAllocations.map(a => ({
        symbol:   a.symbol,
        address:  a.address,
        bps:      a.bps,
        pct:      (a.bps / 100).toFixed(2),
        color:    TOKEN_COLORS[a.symbol] || "#888",
      })),
      total_bps:      totalBps,
      total_value_usd: Number(ethers.formatUnits(totalValueRaw as bigint, 6)),
      vault_address:  VAULT_ADDR,
      network:        "Mantle Sepolia",
      fetched_at:     Date.now(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to read allocation from Mantle Sepolia: ${err.message}` },
      { status: 500 }
    );
  }
}
