# Ledger Verification

Local: every record stores prevHash and hash. verifyChain() finds edits, and replay() rechecks the snapshot hash and rescoring.

On-chain: VIGILReasoningAnchor stores record hashes on Mantle Sepolia and emits DecisionAnchored. **It is not deployed yet, and no decision has been anchored.** To anchor: run scripts/deploy-anchor.ts on mantleSepolia, set VIGIL_ANCHOR_ADDRESS, then run npm run research:anchor. The script refuses any chain but 5003 and writes data/anchors.jsonl only after a successful receipt.

Independent check: recompute a record's hash, then find the DecisionAnchored event for 0x plus that hash in the transaction.

Do not reuse the older README stats without rechecking them. The repo names several different vault and ledger addresses.
