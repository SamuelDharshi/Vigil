import * as fs from "fs";
import * as path from "path";
import { ethers } from "ethers";
import { DecisionLog } from "./agent";

const ACTIONS = ["BUY", "EXIT", "HOLD", "NO_TRADE"];

/**
 * Anchors unanchored decision hashes on Mantle Sepolia. A receipt file entry is written only
 * after a transaction has been mined successfully, so it can never claim an unconfirmed anchor.
 */
async function main() {
  const { VIGIL_ANCHOR_ADDRESS, AGENT_PRIVATE_KEY, MANTLE_RPC_URL } = process.env;
  if (!VIGIL_ANCHOR_ADDRESS || !AGENT_PRIVATE_KEY) throw new Error("VIGIL_ANCHOR_ADDRESS and AGENT_PRIVATE_KEY are required");

  const dir = path.resolve(__dirname, "../../data");
  const receipts = path.join(dir, "anchors.jsonl");
  const done = new Set(fs.existsSync(receipts)
    ? fs.readFileSync(receipts, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l).hash) : []);

  const provider = new ethers.JsonRpcProvider(MANTLE_RPC_URL || "https://rpc.sepolia.mantle.xyz");
  const network = await provider.getNetwork();
  if (network.chainId !== 5003n) throw new Error(`refusing to anchor on chain ${network.chainId}: testnet only`);
  const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(VIGIL_ANCHOR_ADDRESS, ["function anchor(bytes32,bytes32,uint8)"], wallet);

  for (const r of new DecisionLog(path.join(dir, "decisions.jsonl")).read()) {
    if (done.has(r.hash)) continue;
    const tx = await contract.anchor(`0x${r.hash}`, `0x${r.snapshot.snapshotId}`, ACTIONS.indexOf(r.action));
    const receipt = await tx.wait();
    if (receipt?.status !== 1) throw new Error(`anchor failed: ${tx.hash}`);
    fs.appendFileSync(receipts, JSON.stringify({ decisionId: r.decisionId, hash: r.hash, txHash: tx.hash, block: receipt.blockNumber, chainId: 5003 }) + "\n");
    console.log(`[Anchor] ${r.decisionId} ${tx.hash}`);
  }
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
