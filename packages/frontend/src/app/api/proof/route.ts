import { NextResponse } from "next/server";
import { ethers } from "ethers";

/**
 * GET /api/proof
 * Returns all ledger entries from VIGILLedger.sol for the Proofs index page.
 */

const MANTLE_RPC    = process.env.MANTLE_RPC_URL    || "https://rpc.sepolia.mantle.xyz";
const LEDGER_ADDR   = process.env.VIGIL_LEDGER_ADDRESS || "";
const MANTLE_EXPLORER = process.env.NEXT_PUBLIC_MANTLE_EXPLORER || "https://sepolia.mantlescan.xyz";

const LEDGER_ABI = [
  "function totalEntries() view returns (uint256)",
  "function getEntry(uint256 entryId) view returns (tuple(uint256 agentId, uint8 entryType, address fromToken, address toToken, uint256 amount, uint256 slippageBps, bytes32 txHash, bytes32 zkProofHash, string skipReason, string reasoning, uint256 timestamp))",
];

const ENTRY_TYPE_LABELS = ["SKIP", "EXECUTE", "CROSS-CHAIN", "CLMM"];

export async function GET() {
  if (!LEDGER_ADDR) {
    return NextResponse.json({ entries: [], error: "VIGIL_LEDGER_ADDRESS not configured" });
  }

  try {
    const provider = new ethers.JsonRpcProvider(MANTLE_RPC);
    const ledger   = new ethers.Contract(LEDGER_ADDR, LEDGER_ABI, provider);
    const total    = Number(await ledger.totalEntries());

    // Fetch last 20 entries
    const startId = Math.max(1, total - 19);
    const ids = Array.from({ length: total - startId + 1 }, (_, i) => startId + i);

    const entries = await Promise.allSettled(
      ids.map(async (id) => {
        const e = await ledger.getEntry(id);
        const txHashStr = e.txHash !== ethers.ZeroHash ? e.txHash : null;
        const zkStr     = e.zkProofHash !== ethers.ZeroHash ? e.zkProofHash : null;
        return {
          entryId:     id,
          agentId:     Number(e.agentId),
          entryType:   Number(e.entryType),
          label:       ENTRY_TYPE_LABELS[Number(e.entryType)] || "UNKNOWN",
          fromToken:   e.fromToken,
          toToken:     e.toToken,
          amount:      Number(e.amount),
          slippageBps: Number(e.slippageBps),
          txHash:      txHashStr,
          zkProofHash: zkStr,
          skipReason:  e.skipReason || null,
          reasoning:   e.reasoning || null,
          timestamp:   Number(e.timestamp) * 1000,
          mantlescanUrl: txHashStr ? `${MANTLE_EXPLORER}/tx/${txHashStr}` : null,
        };
      })
    );

    const resolved = entries
      .filter(r => r.status === "fulfilled")
      .map(r => (r as PromiseFulfilledResult<any>).value)
      .reverse(); // newest first

    return NextResponse.json({ entries: resolved, total, fetchedAt: Date.now() });
  } catch (err: any) {
    return NextResponse.json({ entries: [], error: err.message }, { status: 500 });
  }
}
