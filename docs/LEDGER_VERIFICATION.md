# Ledger Verification

Local: every record stores prevHash and hash. verifyChain() finds edits, and replay() rechecks the snapshot hash and rescoring.

On-chain: **the new decision hashes are not anchored yet.** A local hash is not an on-chain record. Anchoring needs a funded testnet wallet. VIGILLedger.log accepts only the vault, so it also needs a vault call or a small new anchor contract.

Do not reuse the older README stats without rechecking them. The repo names several different vault and ledger addresses.
